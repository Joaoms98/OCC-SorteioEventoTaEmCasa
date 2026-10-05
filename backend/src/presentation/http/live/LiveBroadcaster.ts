import type { Request, Response } from 'express';
import type { LiveDrawChannel, LiveDrawMessage } from '../../../application/ports/LiveDrawChannel.ts';
import type { GetLiveBoard, LiveBoard } from '../../../application/use-cases/live/GetLiveBoard.ts';
import { NotFoundError } from '../../../domain/errors/DomainError.ts';
import type { Logger } from '../Logger.ts';
import { presentLiveMessage, presentLiveSnapshot } from '../presenters/livePresenters.ts';

export interface LiveBroadcasterOptions {
  heartbeatMs?: number;
  /** How long a computed board is reused for new viewers (many phones connect at once). */
  boardCacheMs?: number;
  /** Groups bursts of changes (e.g. registrations) into a single push. */
  refreshDebounceMs?: number;
  viewersDebounceMs?: number;
}

interface Room {
  clients: Set<Response>;
  unsubscribe: () => void;
  refreshTimer: NodeJS.Timeout | null;
  viewersTimer: NodeJS.Timeout | null;
}

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

/**
 * Server-Sent Events hub of the live draw. Viewers of an event share one "room": the board is
 * computed once per change and pushed to everyone, and draw messages are relayed as they happen.
 */
export class LiveBroadcaster {
  private readonly rooms = new Map<string, Room>();
  private readonly boards = new Map<string, { promise: Promise<LiveBoard>; at: number }>();
  private heartbeat: NodeJS.Timeout | null = null;
  private readonly options: Required<LiveBroadcasterOptions>;

  constructor(
    private readonly getLiveBoard: GetLiveBoard,
    private readonly channel: LiveDrawChannel,
    private readonly logger: Logger,
    options: LiveBroadcasterOptions = {},
  ) {
    this.options = {
      heartbeatMs: options.heartbeatMs ?? 20_000,
      boardCacheMs: options.boardCacheMs ?? 3_000,
      refreshDebounceMs: options.refreshDebounceMs ?? 1_500,
      viewersDebounceMs: options.viewersDebounceMs ?? 1_000,
    };
  }

  /** Opens the stream; an unknown event fails before any SSE header is sent (regular JSON error). */
  async connect(eventId: string, req: Request, res: Response): Promise<void> {
    const board = await this.loadBoard(eventId);

    res.status(200).set(SSE_HEADERS);
    res.flushHeaders();
    res.write('retry: 3000\n\n');

    const room = this.join(eventId, res);
    this.send(res, 'snapshot', presentLiveSnapshot(board, this.channel.pending(eventId), room.clients.size, Date.now()));
    req.on('close', () => this.leave(eventId, res));
  }

  /** The board changed (registrations, prizes...): push a fresh snapshot to the event's viewers. */
  refresh(eventId: string, delayMs = this.options.refreshDebounceMs): void {
    this.boards.delete(eventId);
    const room = this.rooms.get(eventId);
    if (!room) return;
    if (room.refreshTimer) {
      if (delayMs > 0) return;
      clearTimeout(room.refreshTimer);
    }
    room.refreshTimer = setTimeout(() => {
      room.refreshTimer = null;
      void this.pushSnapshot(eventId, room);
    }, delayMs);
  }

  viewers(eventId: string): number {
    return this.rooms.get(eventId)?.clients.size ?? 0;
  }

  closeAll(): void {
    for (const [eventId, room] of this.rooms) {
      for (const client of room.clients) client.end();
      this.dispose(eventId, room);
    }
  }

  private loadBoard(eventId: string): Promise<LiveBoard> {
    const cached = this.boards.get(eventId);
    if (cached && Date.now() - cached.at < this.options.boardCacheMs) return cached.promise;

    const promise = this.getLiveBoard.execute({ eventId });
    const entry = { promise, at: Date.now() };
    this.boards.set(eventId, entry);
    promise.catch(() => {
      if (this.boards.get(eventId) === entry) this.boards.delete(eventId);
    });
    return promise;
  }

  private async pushSnapshot(eventId: string, room: Room): Promise<void> {
    try {
      const board = await this.loadBoard(eventId);
      const snapshot = presentLiveSnapshot(board, this.channel.pending(eventId), room.clients.size, Date.now());
      for (const client of room.clients) this.send(client, 'snapshot', snapshot);
    } catch (error) {
      if (error instanceof NotFoundError) {
        // The event was deleted: tell viewers and stop their automatic reconnection.
        for (const client of room.clients) {
          this.send(client, 'closed', {});
          client.end();
        }
        this.dispose(eventId, room);
        return;
      }
      this.logger.error('Failed to refresh live board', { eventId, message: (error as Error).message });
    }
  }

  private onMessage(eventId: string, message: LiveDrawMessage): void {
    this.boards.delete(eventId);
    const room = this.rooms.get(eventId);
    if (!room) return;
    const payload = presentLiveMessage(message, Date.now());
    for (const client of room.clients) this.send(client, message.type, payload);
    // Before the reveal nothing on the board changes (and it must not give the winner away).
    if (message.type !== 'draw_started' && message.type !== 'draw_landing') this.refresh(eventId, 0);
  }

  private join(eventId: string, res: Response): Room {
    let room = this.rooms.get(eventId);
    if (!room) {
      room = { clients: new Set(), refreshTimer: null, viewersTimer: null, unsubscribe: () => {} };
      room.unsubscribe = this.channel.subscribe(eventId, (message) => this.onMessage(eventId, message));
      this.rooms.set(eventId, room);
      this.startHeartbeat();
    }
    room.clients.add(res);
    this.scheduleViewers(room);
    return room;
  }

  private leave(eventId: string, res: Response): void {
    const room = this.rooms.get(eventId);
    if (!room?.clients.delete(res)) return;
    if (room.clients.size === 0) this.dispose(eventId, room);
    else this.scheduleViewers(room);
  }

  private dispose(eventId: string, room: Room): void {
    room.unsubscribe();
    if (room.refreshTimer) clearTimeout(room.refreshTimer);
    if (room.viewersTimer) clearTimeout(room.viewersTimer);
    room.clients.clear();
    this.rooms.delete(eventId);
    if (this.rooms.size === 0 && this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
  }

  private scheduleViewers(room: Room): void {
    if (room.viewersTimer) return;
    room.viewersTimer = setTimeout(() => {
      room.viewersTimer = null;
      for (const client of room.clients) this.send(client, 'viewers', { count: room.clients.size });
    }, this.options.viewersDebounceMs);
  }

  private startHeartbeat(): void {
    if (this.heartbeat) return;
    // Comments keep proxies (Render/Cloudflare) from closing idle connections.
    this.heartbeat = setInterval(() => {
      for (const room of this.rooms.values()) for (const client of room.clients) this.write(client, ': ping\n\n');
    }, this.options.heartbeatMs);
  }

  private send(res: Response, event: string, data: unknown): void {
    this.write(res, `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  private write(res: Response, chunk: string): void {
    if (!res.writableEnded && !res.destroyed) res.write(chunk);
  }
}
