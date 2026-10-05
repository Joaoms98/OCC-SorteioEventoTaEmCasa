import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveDrawMessage } from '../../../src/application/ports/LiveDrawChannel.ts';
import { InMemoryLiveDrawChannel, WHEEL_LANDING_MS } from '../../../src/infrastructure/live/InMemoryLiveDrawChannel.ts';

const EVENT = 'event-1';
const result = { drawId: 'draw-1', prize: { id: 'prize-1', name: 'Kit' }, winnerName: 'Ana Lima' };

describe('InMemoryLiveDrawChannel', () => {
  let channel: InMemoryLiveDrawChannel;
  let messages: LiveDrawMessage[];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-20T22:00:00Z'));
    channel = new InMemoryLiveDrawChannel({ now: () => new Date() }, 5000);
    messages = [];
    channel.subscribe(EVENT, (message) => messages.push(message));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lets a single draw on stage at a time, per event', () => {
    expect(channel.claim(EVENT, 'draw-1')).toBe(true);
    expect(channel.claim(EVENT, 'draw-2')).toBe(false);
    expect(channel.claim('other-event', 'draw-3')).toBe(true);

    channel.release(EVENT, 'draw-2');
    expect(channel.pending(EVENT)).toEqual({ drawId: 'draw-1', prize: null, revealAt: null, landingAt: null, wheel: null });
    channel.release(EVENT, 'draw-1');
    expect(channel.pending(EVENT)).toBeNull();
  });

  it('announces the suspense without the winner and reveals it only at revealAt', () => {
    channel.claim(EVENT, 'draw-1');
    const { revealAt } = channel.start(EVENT, result);

    expect(revealAt.toISOString()).toBe('2026-11-20T22:00:05.000Z');
    expect(messages).toEqual([
      { type: 'draw_started', drawId: 'draw-1', prize: result.prize, landingAt: new Date('2026-11-20T22:00:02.000Z'), revealAt, wheelNames: null },
    ]);
    expect(JSON.stringify(messages)).not.toContain('Ana');
    expect(channel.pending(EVENT)).toMatchObject({ drawId: 'draw-1', revealAt });
    expect(channel.claim(EVENT, 'draw-2')).toBe(false);

    vi.advanceTimersByTime(4999);
    expect(messages).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(messages[1]).toEqual({ type: 'draw_revealed', ...result });
    expect(channel.pending(EVENT)).toBeNull();
    expect(channel.claim(EVENT, 'draw-2')).toBe(true);
  });

  it('participant roulette: names at the start, the winner slot only when the wheel starts landing', () => {
    const wheel = { names: ['Bruno Souza', 'Ana Lima', 'Carla Dias'], winnerSlot: 1 };
    channel.claim(EVENT, 'draw-1');
    const { landingAt, revealAt } = channel.start(EVENT, { ...result, wheel });

    expect(revealAt.getTime() - landingAt.getTime()).toBe(WHEEL_LANDING_MS);
    expect(messages).toEqual([expect.objectContaining({ type: 'draw_started', wheelNames: wheel.names })]);
    expect(JSON.stringify(messages)).not.toContain('winnerSlot');
    expect(channel.pending(EVENT)).toMatchObject({ landingAt, wheel: { names: wheel.names, winnerSlot: null } });

    vi.advanceTimersByTime(2000);
    expect(messages[1]).toEqual({ type: 'draw_landing', drawId: 'draw-1', winnerSlot: 1 });
    expect(channel.pending(EVENT)).toMatchObject({ wheel: { winnerSlot: 1 } });

    vi.advanceTimersByTime(3000);
    expect(messages[2]).toEqual({ type: 'draw_revealed', ...result, wheel });
  });

  it('short suspense: a participant roulette lands right away', () => {
    const quick = new InMemoryLiveDrawChannel({ now: () => new Date() }, 1000);
    const received: LiveDrawMessage[] = [];
    quick.subscribe(EVENT, (message) => received.push(message));
    quick.claim(EVENT, 'draw-1');
    const { landingAt } = quick.start(EVENT, { ...result, wheel: { names: ['Ana Lima'], winnerSlot: 0 } });

    expect(landingAt.toISOString()).toBe('2026-11-20T22:00:00.000Z');
    vi.advanceTimersByTime(0);
    expect(received.map((message) => message.type)).toEqual(['draw_started', 'draw_landing']);
  });

  it('voiding a draw in suspense cancels its reveal', () => {
    channel.claim(EVENT, 'draw-1');
    channel.start(EVENT, result);
    channel.voided(EVENT, result);
    vi.advanceTimersByTime(10_000);

    expect(messages.map((message) => message.type)).toEqual(['draw_started', 'draw_voided']);
    expect(channel.pending(EVENT)).toBeNull();
  });

  it('keeps notifying other listeners when one of them throws', () => {
    const onError = vi.fn();
    const faulty = new InMemoryLiveDrawChannel({ now: () => new Date() }, 0, onError);
    const received: string[] = [];
    faulty.subscribe(EVENT, () => {
      throw new Error('boom');
    });
    const unsubscribe = faulty.subscribe(EVENT, (message) => received.push(message.type));

    faulty.claim(EVENT, 'draw-1');
    faulty.start(EVENT, result);
    expect(received).toEqual(['draw_started', 'draw_revealed']);
    expect(onError).toHaveBeenCalledTimes(2);

    unsubscribe();
    faulty.voided(EVENT, result);
    expect(received).toHaveLength(2);
  });
});
