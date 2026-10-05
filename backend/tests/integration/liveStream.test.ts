import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryLiveDrawChannel } from '../../src/infrastructure/live/InMemoryLiveDrawChannel.ts';
import { JwtTokenService } from '../../src/infrastructure/security/JwtTokenService.ts';
import { createApp } from '../../src/presentation/http/app.ts';
import { LiveBroadcaster } from '../../src/presentation/http/live/LiveBroadcaster.ts';
import type { Logger } from '../../src/presentation/http/Logger.ts';
import { makeTestUseCases, TEST_ADMIN_PASSWORD } from '../doubles/makeTestUseCases.ts';

const SUSPENSE_MS = 300;
const silentLogger: Logger = { info: () => {}, error: () => {} };

interface SseEvent {
  event: string;
  data: Record<string, unknown>;
}

/** Minimal SSE client: collects events and lets the test wait for the next one of a given type. */
async function openStream(url: string) {
  const controller = new AbortController();
  const response = await fetch(url, { signal: controller.signal });
  const events: SseEvent[] = [];
  const waiters: Array<() => void> = [];
  let buffer = '';

  void (async () => {
    const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let boundary: number;
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const event = /^event: (.+)$/m.exec(frame)?.[1];
          const data = /^data: (.+)$/m.exec(frame)?.[1];
          if (event && data) events.push({ event, data: JSON.parse(data) });
          waiters.splice(0).forEach((wake) => wake());
        }
      }
    } catch {
      // aborted
    }
  })();

  let cursor = 0;
  async function next(type: string, timeoutMs = 2000): Promise<SseEvent> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const index = events.findIndex((event, position) => position >= cursor && event.event === type);
      if (index >= 0) {
        cursor = index + 1;
        return events[index]!;
      }
      if (Date.now() > deadline) throw new Error(`Timed out waiting for "${type}"; got ${events.map((e) => e.event)}`);
      await new Promise<void>((resolve) => {
        waiters.push(resolve);
        setTimeout(resolve, 50);
      });
    }
  }

  return { response, events, next, close: () => controller.abort() };
}

describe('Live draw stream (SSE)', () => {
  let server: Server;
  let base: string;
  let token: string;
  let live: InMemoryLiveDrawChannel;

  beforeEach(async () => {
    const tokenService = new JwtTokenService('test-secret-with-at-least-32-characters!!', 3600);
    live = new InMemoryLiveDrawChannel({ now: () => new Date() }, SUSPENSE_MS);
    const { useCases } = makeTestUseCases({ tokens: tokenService, live });
    const liveBroadcaster = new LiveBroadcaster(useCases.getLiveBoard, live, silentLogger, {
      refreshDebounceMs: 20,
      viewersDebounceMs: 20,
      boardCacheMs: 0,
    });
    const app = createApp({ useCases, tokenService, liveBroadcaster, isProduction: false, logger: silentLogger });
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
    token = (await api('POST', '/auth/login', { password: TEST_ADMIN_PASSWORD })).token as string;

    afterEachCleanup = () => {
      liveBroadcaster.closeAll();
      server.close();
    };
  });

  let afterEachCleanup = () => {};
  afterEach(() => afterEachCleanup());

  async function api(method: string, path: string, body?: unknown) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return (response.status === 204 ? {} : await response.json()) as Record<string, unknown>;
  }

  async function seed() {
    const event = await api('POST', '/events', { name: 'Tá em Casa', registrationOpen: true });
    await api('POST', `/events/${event.id}/participants/import`, {
      participants: [
        { name: 'Ana Maria Lima', phone: '11911110001' },
        { name: 'Bruno Souza', phone: '11911110002' },
      ],
    });
    const prize = await api('POST', `/events/${event.id}/prizes`, { name: 'Kit de cabelo', quantity: 2 });
    return { eventId: event.id as string, prizeId: prize.id as string };
  }

  it('streams the draw to viewers: suspense first, winner only at the reveal', async () => {
    const { eventId, prizeId } = await seed();
    const viewer = await openStream(`${base}/public/events/${eventId}/live`);
    expect(viewer.response.headers.get('content-type')).toContain('text/event-stream');

    const snapshot = (await viewer.next('snapshot')).data;
    expect(snapshot).toMatchObject({
      event: { name: 'Tá em Casa' },
      prizes: [{ name: 'Kit de cabelo', remainingUnits: 2 }],
      stats: { participants: 2, eligibleParticipants: 2 },
      pendingDraw: null,
      recentWinners: [],
    });
    expect((snapshot.rollNames as string[]).sort()).toEqual(['Ana L.', 'Bruno S.']);

    const draw = await api('POST', `/events/${eventId}/draws`, { prizeId });
    expect(draw.revealInMs).toBeGreaterThan(0);
    expect(draw.revealInMs).toBeLessThanOrEqual(SUSPENSE_MS);

    const started = await viewer.next('draw_started');
    expect(started.data).toMatchObject({ drawId: draw.id, prize: { name: 'Kit de cabelo' } });
    expect(JSON.stringify(viewer.events)).not.toContain((draw.participant as { name: string }).name);

    const tooSoon = await api('POST', `/events/${eventId}/draws`, { prizeId });
    expect(tooSoon.error).toMatchObject({ code: 'DRAW_IN_PROGRESS' });

    const revealed = await viewer.next('draw_revealed');
    expect(revealed.data).toEqual({
      drawId: draw.id,
      prize: { id: prizeId, name: 'Kit de cabelo' },
      winnerName: (draw.participant as { name: string }).name,
      wheel: null,
    });

    const after = (await viewer.next('snapshot')).data;
    expect(after.recentWinners).toEqual([expect.objectContaining({ drawId: draw.id })]);
    expect(after.prizes).toEqual([expect.objectContaining({ remainingUnits: 1 })]);
    viewer.close();
  });

  it('participant roulette: names when it starts, the winner slot when it lands, the winner at the reveal', async () => {
    const { eventId, prizeId } = await seed();
    await api('PATCH', `/events/${eventId}`, { drawMode: 'PARTICIPANTS' });
    const viewer = await openStream(`${base}/public/events/${eventId}/live`);
    expect((await viewer.next('snapshot')).data.event).toMatchObject({ drawMode: 'PARTICIPANTS' });

    const draw = await api('POST', `/events/${eventId}/draws`, { prizeId });
    const wheel = draw.wheel as { names: string[]; slot: number };
    expect([...wheel.names].sort()).toEqual(['Ana L.', 'Bruno S.']);
    expect(wheel.names[wheel.slot]).toBe((draw.participant as { name: string }).name === 'Ana Maria Lima' ? 'Ana L.' : 'Bruno S.');

    const started = await viewer.next('draw_started');
    expect(started.data).toMatchObject({ drawId: draw.id, wheelNames: wheel.names });
    expect(started.data).not.toHaveProperty('slot');
    const landing = await viewer.next('draw_landing');
    expect(landing.data).toEqual({ drawId: draw.id, slot: wheel.slot });
    const revealed = await viewer.next('draw_revealed');
    expect(revealed.data).toMatchObject({ drawId: draw.id, wheel });
    viewer.close();
  });

  it('late viewers get the ongoing suspense in their first snapshot', async () => {
    const { eventId, prizeId } = await seed();
    const draw = await api('POST', `/events/${eventId}/draws`, { prizeId });

    const viewer = await openStream(`${base}/public/events/${eventId}/live`);
    const snapshot = (await viewer.next('snapshot')).data;

    expect(snapshot.pendingDraw).toMatchObject({ drawId: draw.id, prize: { name: 'Kit de cabelo' } });
    expect(snapshot.recentWinners).toEqual([]);
    // Nothing on the board tells who won: both contenders are still on the list of names.
    expect((snapshot.rollNames as string[]).sort()).toEqual(['Ana L.', 'Bruno S.']);
    expect(snapshot.stats).toMatchObject({ eligibleParticipants: 2 });
    await viewer.next('draw_revealed');
    viewer.close();
  });

  it('pushes registrations, voided draws and viewer counts', async () => {
    const { eventId, prizeId } = await seed();
    const viewer = await openStream(`${base}/public/events/${eventId}/live`);
    const second = await openStream(`${base}/public/events/${eventId}/live`);
    await viewer.next('snapshot');
    expect((await viewer.next('viewers')).data).toEqual({ count: 2 });

    await api('POST', `/events/${eventId}/participants`, { name: 'Carla Dias', phone: '11987654321' });
    expect((await viewer.next('snapshot')).data.stats).toEqual({ participants: 3, eligibleParticipants: 3 });

    const draw = await api('POST', `/events/${eventId}/draws`, { prizeId });
    await viewer.next('draw_revealed');
    await api('POST', `/events/${eventId}/draws/${draw.id}/void`);
    expect((await viewer.next('draw_voided')).data).toMatchObject({ drawId: draw.id });

    const next = await api('POST', `/events/${eventId}/draws`, { prizeId });
    await viewer.next('draw_revealed');
    const claim = await api('POST', `/events/${eventId}/draws/${next.id}/claim`);
    expect(claim.claimedAt).toEqual(expect.any(String));
    expect((await viewer.next('draw_claimed')).data).toEqual({
      drawId: next.id,
      prize: { id: prizeId, name: 'Kit de cabelo' },
      winnerName: (next.participant as { name: string }).name,
    });
    const afterClaim = (await viewer.next('snapshot')).data;
    expect(afterClaim.recentWinners).toEqual([expect.objectContaining({ drawId: next.id, claimedAt: claim.claimedAt })]);

    const voidClaimed = await api('POST', `/events/${eventId}/draws/${next.id}/void`);
    expect(voidClaimed.error).toEqual({ code: 'PRIZE_ALREADY_CLAIMED', message: 'O brinde deste sorteio já foi entregue.' });

    second.close();
    expect((await viewer.next('viewers')).data).toEqual({ count: 1 });
    viewer.close();
  });

  it('answers unknown events with a regular JSON error', async () => {
    const response = await fetch(`${base}/public/events/00000000-0000-4000-8000-999999999999/live`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: 'EVENT_NOT_FOUND', message: 'Evento não encontrado.' } });
  });
});
