import type { Clock } from '../../application/ports/Clock.ts';
import type {
  LiveDrawChannel,
  LiveDrawMessage,
  LiveDrawResult,
  LiveDrawTiming,
  PendingLiveDraw,
} from '../../application/ports/LiveDrawChannel.ts';

/** How long a participant roulette brakes before the reveal (it spins freely before that). */
export const WHEEL_LANDING_MS = 3000;

type Stage =
  | { status: 'claimed'; drawId: string }
  | {
      status: 'suspense';
      drawId: string;
      result: LiveDrawResult;
      timing: LiveDrawTiming;
      landed: boolean;
      timers: NodeJS.Timeout[];
    };

type Listener = (message: LiveDrawMessage) => void;

/**
 * Process-local live stage. Fits the single instance of a free hosting plan; running several
 * instances would require a shared broker (e.g. Redis or Postgres LISTEN/NOTIFY) behind the same port.
 */
export class InMemoryLiveDrawChannel implements LiveDrawChannel {
  private readonly stages = new Map<string, Stage>();
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(
    private readonly clock: Clock,
    /** Suspense before the winner is revealed; 0 reveals immediately (tests). */
    private readonly revealDelayMs: number,
    private readonly onListenerError: (error: unknown) => void = () => {},
  ) {}

  claim(eventId: string, drawId: string): boolean {
    if (this.stages.has(eventId)) return false;
    this.stages.set(eventId, { status: 'claimed', drawId });
    return true;
  }

  release(eventId: string, drawId: string): void {
    if (this.stages.get(eventId)?.drawId === drawId) this.stages.delete(eventId);
  }

  start(eventId: string, result: LiveDrawResult): LiveDrawTiming {
    const now = this.clock.now().getTime();
    const landingDelayMs = Math.max(this.revealDelayMs - WHEEL_LANDING_MS, 0);
    const timing = { landingAt: new Date(now + landingDelayMs), revealAt: new Date(now + this.revealDelayMs) };
    this.emit(eventId, {
      type: 'draw_started',
      drawId: result.drawId,
      prize: result.prize,
      ...timing,
      wheelNames: result.wheel?.names ?? null,
    });

    if (this.revealDelayMs <= 0) {
      this.stages.delete(eventId);
      this.land(eventId, result);
      this.emit(eventId, { type: 'draw_revealed', ...result });
      return timing;
    }

    const stage: Stage = { status: 'suspense', drawId: result.drawId, result, timing, landed: false, timers: [] };
    this.stages.set(eventId, stage);
    if (result.wheel) {
      stage.timers.push(
        setTimeout(() => {
          stage.landed = true;
          this.land(eventId, result);
        }, landingDelayMs),
      );
    }
    stage.timers.push(setTimeout(() => this.reveal(eventId, result.drawId), this.revealDelayMs));
    return timing;
  }

  voided(eventId: string, result: LiveDrawResult): void {
    const stage = this.stages.get(eventId);
    if (stage?.status === 'suspense' && stage.drawId === result.drawId) {
      stage.timers.forEach(clearTimeout);
      this.stages.delete(eventId);
    }
    this.emit(eventId, { type: 'draw_voided', ...result });
  }

  claimed(eventId: string, result: LiveDrawResult): void {
    this.emit(eventId, { type: 'draw_claimed', ...result });
  }

  pending(eventId: string): PendingLiveDraw | null {
    const stage = this.stages.get(eventId);
    if (!stage) return null;
    if (stage.status === 'claimed') return { drawId: stage.drawId, prize: null, revealAt: null, landingAt: null, wheel: null };
    const { wheel } = stage.result;
    return {
      drawId: stage.drawId,
      prize: stage.result.prize,
      ...stage.timing,
      wheel: wheel ? { names: wheel.names, winnerSlot: stage.landed ? wheel.winnerSlot : null } : null,
    };
  }

  subscribe(eventId: string, listener: Listener): () => void {
    const listeners = this.listeners.get(eventId) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(eventId, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(eventId);
    };
  }

  /** The wheel starts braking: from now on everyone may know where it stops. */
  private land(eventId: string, result: LiveDrawResult): void {
    if (result.wheel) this.emit(eventId, { type: 'draw_landing', drawId: result.drawId, winnerSlot: result.wheel.winnerSlot });
  }

  private reveal(eventId: string, drawId: string): void {
    const stage = this.stages.get(eventId);
    if (stage?.status !== 'suspense' || stage.drawId !== drawId) return;
    this.stages.delete(eventId);
    this.emit(eventId, { type: 'draw_revealed', ...stage.result });
  }

  private emit(eventId: string, message: LiveDrawMessage): void {
    for (const listener of this.listeners.get(eventId) ?? []) {
      try {
        listener(message);
      } catch (error) {
        this.onListenerError(error);
      }
    }
  }
}
