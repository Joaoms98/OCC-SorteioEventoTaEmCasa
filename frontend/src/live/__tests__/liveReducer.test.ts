import { describe, expect, it } from 'vitest';
import { initialLiveState, liveReducer, type LiveAction } from '../liveReducer';
import type { LiveSnapshot, LiveState } from '../types';

const prize = { id: 'p1', name: 'Kit de cabelo' };

const snapshot = (overrides: Partial<LiveSnapshot> = {}): LiveSnapshot => ({
  event: { id: 'e1', name: 'Tá em Casa', description: null, eventDate: null, registrationOpen: false, drawMode: 'PRIZES' },
  prizes: [{ ...prize, quantity: 2, remainingUnits: 2, imageUrl: null }],
  recentWinners: [],
  stats: { participants: 10, eligibleParticipants: 10 },
  rollNames: ['Ana L.', 'Bruno S.'],
  pendingDraw: null,
  viewers: 3,
  ...overrides,
});

const run = (...actions: LiveAction[]): LiveState => actions.reduce(liveReducer, initialLiveState);

describe('liveReducer', () => {
  it('viewers: suspense without a name, then the winner revealed by the server', () => {
    const drawing = run(
      { type: 'snapshot', snapshot: snapshot(), now: 0 },
      { type: 'started', drawId: 'd1', prize, landingInMs: 5000, revealInMs: 5000, wheel: null, now: 1000 },
    );
    expect(drawing.current).toEqual({
      drawId: 'd1',
      prize,
      phase: 'drawing',
      landingAt: 6000,
      revealAt: 6000,
      wheel: null,
      winnerName: null,
    });

    // The local timer cannot reveal what the viewer does not know yet.
    expect(liveReducer(drawing, { type: 'revealDue', drawId: 'd1' })).toBe(drawing);

    const revealed = liveReducer(drawing, { type: 'revealed', drawId: 'd1', prize, winnerName: 'Ana Lima', wheel: null, now: 6000 });
    expect(revealed.current).toMatchObject({ phase: 'revealed', winnerName: 'Ana Lima' });
  });

  it('organizer: announces its own draw and ignores the echo from the stream', () => {
    const local = run({ type: 'started', drawId: 'd1', prize, landingInMs: 5000, revealInMs: 5000, wheel: null, now: 0, winnerName: 'Ana Lima' });
    const echoed = liveReducer(local, { type: 'started', drawId: 'd1', prize, landingInMs: 4900, revealInMs: 4900, wheel: null, now: 100 });
    expect(echoed).toBe(local);

    const revealed = liveReducer(echoed, { type: 'revealDue', drawId: 'd1' });
    expect(revealed.current).toMatchObject({ phase: 'revealed', winnerName: 'Ana Lima' });
    expect(liveReducer(revealed, { type: 'revealed', drawId: 'd1', prize, winnerName: 'Ana Lima', wheel: null, now: 5000 })).toBe(revealed);
  });

  it('late viewers pick up an ongoing suspense from the snapshot', () => {
    const state = run({
      type: 'snapshot',
      snapshot: snapshot({ pendingDraw: { drawId: 'd1', prize, landingInMs: 2000, revealInMs: 2000, wheel: null } }),
      now: 10_000,
    });
    expect(state.current).toMatchObject({ drawId: 'd1', phase: 'drawing', revealAt: 12_000, winnerName: null });
  });

  it('a stale snapshot never moves the stage backwards', () => {
    const revealed = run(
      { type: 'started', drawId: 'd1', prize, landingInMs: 0, revealInMs: 0, wheel: null, now: 0 },
      { type: 'revealed', drawId: 'd1', prize, winnerName: 'Ana Lima', wheel: null, now: 0 },
    );
    const afterSnapshot = liveReducer(revealed, { type: 'snapshot', snapshot: snapshot(), now: 1 });
    expect(afterSnapshot.current).toEqual(revealed.current);
  });

  it('recovers a missed reveal from the winners list after reconnecting', () => {
    const drawing = run({ type: 'started', drawId: 'd1', prize, landingInMs: 5000, revealInMs: 5000, wheel: null, now: 0 });
    const reconnected = liveReducer(drawing, {
      type: 'snapshot',
      snapshot: snapshot({ recentWinners: [{ drawId: 'd1', winnerName: 'Ana Lima', prize, drawnAt: '', claimedAt: null }] }),
      now: 9000,
    });
    expect(reconnected.current).toMatchObject({ phase: 'revealed', winnerName: 'Ana Lima' });
  });

  it('shows voided draws and keeps them voided', () => {
    const voided = run(
      { type: 'revealed', drawId: 'd1', prize, winnerName: 'Ana Lima', wheel: null, now: 0 },
      { type: 'voided', drawId: 'd1', prize, winnerName: 'Ana Lima', now: 1 },
    );
    expect(voided.current).toMatchObject({ phase: 'voided', winnerName: 'Ana Lima' });
    expect(liveReducer(voided, { type: 'revealed', drawId: 'd1', prize, winnerName: 'Ana Lima', wheel: null, now: 2 })).toBe(voided);
  });

  it('updates the viewers counter', () => {
    const state = run({ type: 'snapshot', snapshot: snapshot(), now: 0 }, { type: 'viewers', count: 42 });
    expect(state.snapshot?.viewers).toBe(42);
  });
});

describe('liveReducer participant roulette', () => {
  const names = ['Ana L.', 'Bruno S.', 'Carla D.'];

  it('viewers: names first, the slot when the wheel starts landing, the winner at the reveal', () => {
    const drawing = run({
      type: 'started',
      drawId: 'd1',
      prize,
      landingInMs: 2000,
      revealInMs: 5000,
      wheel: { names, slot: null },
      now: 1000,
    });
    expect(drawing.current).toMatchObject({ landingAt: 3000, revealAt: 6000, wheel: { names, slot: null } });

    const landing = liveReducer(drawing, { type: 'landing', drawId: 'd1', slot: 2 });
    expect(landing.current?.wheel).toEqual({ names, slot: 2 });
    expect(liveReducer(landing, { type: 'landing', drawId: 'd1', slot: 2 })).toBe(landing);
    expect(liveReducer(landing, { type: 'landing', drawId: 'other', slot: 0 })).toBe(landing);

    const revealed = liveReducer(landing, {
      type: 'revealed',
      drawId: 'd1',
      prize,
      winnerName: 'Carla Dias',
      wheel: { names, slot: 2 },
      now: 6000,
    });
    expect(revealed.current).toMatchObject({ phase: 'revealed', winnerName: 'Carla Dias', wheel: { names, slot: 2 } });
  });

  it('organizer: knows the slot from its own draw and keeps it when the echo arrives', () => {
    const local = run({
      type: 'started',
      drawId: 'd1',
      prize,
      landingInMs: 2000,
      revealInMs: 5000,
      wheel: { names, slot: 1 },
      winnerName: 'Bruno Souza',
      now: 0,
    });
    const echoed = liveReducer(local, {
      type: 'started',
      drawId: 'd1',
      prize,
      landingInMs: 1900,
      revealInMs: 4900,
      wheel: { names, slot: null },
      now: 100,
    });
    expect(echoed).toBe(local);
  });

  it('a reveal that arrives without the landing message still lands the wheel', () => {
    const drawing = run({ type: 'started', drawId: 'd1', prize, landingInMs: 0, revealInMs: 3000, wheel: { names, slot: null }, now: 0 });
    const revealed = liveReducer(drawing, {
      type: 'revealed',
      drawId: 'd1',
      prize,
      winnerName: 'Ana Lima',
      wheel: { names, slot: 0 },
      now: 3000,
    });
    expect(revealed.current?.wheel).toEqual({ names, slot: 0 });
  });

  it('late viewers get the wheel (and its slot once landing) from the snapshot', () => {
    const pendingDraw = { drawId: 'd1', prize, landingInMs: 0, revealInMs: 1500, wheel: { names, slot: 1 } };
    const state = run({ type: 'snapshot', snapshot: snapshot({ pendingDraw }), now: 10_000 });
    expect(state.current).toMatchObject({ phase: 'drawing', landingAt: 10_000, revealAt: 11_500, wheel: { names, slot: 1 } });
  });

  it('keeps the wheel when the draw is claimed or voided', () => {
    const revealed = run({ type: 'revealed', drawId: 'd1', prize, winnerName: 'Ana Lima', wheel: { names, slot: 0 }, now: 0 });
    const claimed = liveReducer(revealed, { type: 'claimed', drawId: 'd1', prize, winnerName: 'Ana Lima', now: 1 });
    expect(claimed.current?.wheel).toEqual({ names, slot: 0 });
  });
});

describe('liveReducer claims', () => {
  it('celebrates the claim once, whoever announces it first', () => {
    const revealed = run({ type: 'revealed', drawId: 'd1', prize, winnerName: 'Ana Lima', wheel: null, now: 0 });
    const claimed = liveReducer(revealed, { type: 'claimed', drawId: 'd1', prize, winnerName: 'Ana Lima', now: 1 });
    expect(claimed.current).toMatchObject({ phase: 'claimed', winnerName: 'Ana Lima' });

    // The organizer announces locally and then receives the same claim from the stream.
    expect(liveReducer(claimed, { type: 'claimed', drawId: 'd1', prize, winnerName: 'Ana Lima', now: 2 })).toBe(claimed);
    // A late reveal never takes the stage back.
    expect(liveReducer(claimed, { type: 'revealed', drawId: 'd1', prize, winnerName: 'Ana Lima', wheel: null, now: 3 })).toBe(claimed);
  });
});
