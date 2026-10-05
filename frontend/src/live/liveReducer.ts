import type { DrawWheel } from '../types/api';
import type { ConnectionStatus, LivePrizeRef, LiveSnapshot, LiveState, StageDraw } from './types';

export type LiveAction =
  | { type: 'status'; status: ConnectionStatus }
  | { type: 'snapshot'; snapshot: LiveSnapshot; now: number }
  | {
      type: 'started';
      drawId: string;
      prize: LivePrizeRef;
      landingInMs: number;
      revealInMs: number;
      now: number;
      wheel: DrawWheel | null;
      winnerName?: string;
    }
  | { type: 'landing'; drawId: string; slot: number }
  | { type: 'revealDue'; drawId: string }
  | { type: 'revealed'; drawId: string; prize: LivePrizeRef; winnerName: string; wheel: DrawWheel | null; now: number }
  | { type: 'voided'; drawId: string; prize: LivePrizeRef; winnerName: string; now: number }
  | { type: 'claimed'; drawId: string; prize: LivePrizeRef; winnerName: string; now: number }
  | { type: 'viewers'; count: number };

export const initialLiveState: LiveState = { status: 'connecting', snapshot: null, current: null };

/**
 * Every message is applied idempotently, keyed by drawId: the organizer's screen announces its
 * own draw from the HTTP response and later receives the same draw from the stream.
 * Snapshots may arrive late, so they never move a draw backwards (e.g. revealed -> drawing).
 */
export function liveReducer(state: LiveState, action: LiveAction): LiveState {
  const { current } = state;

  switch (action.type) {
    case 'status':
      return { ...state, status: action.status };

    case 'viewers':
      return state.snapshot ? { ...state, snapshot: { ...state.snapshot, viewers: action.count } } : state;

    case 'snapshot': {
      const pending = action.snapshot.pendingDraw;
      let next: StageDraw | null = current;
      if (pending && current?.drawId !== pending.drawId) {
        next = {
          drawId: pending.drawId,
          prize: pending.prize,
          phase: 'drawing',
          landingAt: action.now + pending.landingInMs,
          revealAt: action.now + pending.revealInMs,
          wheel: pending.wheel,
          winnerName: null,
        };
      } else if (pending && current) {
        // Reconnected while the wheel was landing: catch up with its slot.
        const wheel = withSlot(current.wheel, pending.wheel?.slot);
        if (wheel !== current.wheel) next = { ...current, wheel };
      } else if (current?.phase === 'drawing' && !pending) {
        // Missed the reveal (e.g. reconnecting): the winner is already on the public board.
        const winner = action.snapshot.recentWinners.find((item) => item.drawId === current.drawId);
        if (winner) next = { ...current, phase: 'revealed', winnerName: winner.winnerName };
      }
      return { ...state, snapshot: action.snapshot, current: next };
    }

    case 'started': {
      if (current?.drawId === action.drawId) {
        const winnerName = current.winnerName ?? action.winnerName ?? null;
        const wheel = current.wheel ? withSlot(current.wheel, action.wheel?.slot) : action.wheel;
        return winnerName === current.winnerName && wheel === current.wheel
          ? state
          : { ...state, current: { ...current, winnerName, wheel } };
      }
      return {
        ...state,
        current: {
          drawId: action.drawId,
          prize: action.prize,
          phase: 'drawing',
          landingAt: action.now + action.landingInMs,
          revealAt: action.now + action.revealInMs,
          wheel: action.wheel,
          winnerName: action.winnerName ?? null,
        },
      };
    }

    case 'landing': {
      if (current?.drawId !== action.drawId || !current.wheel) return state;
      const wheel = withSlot(current.wheel, action.slot);
      return wheel === current.wheel ? state : { ...state, current: { ...current, wheel } };
    }

    case 'revealDue':
      return current?.drawId === action.drawId && current.phase === 'drawing' && current.winnerName
        ? { ...state, current: { ...current, phase: 'revealed' } }
        : state;

    case 'revealed': {
      if (current?.drawId === action.drawId) {
        return current.phase === 'drawing'
          ? {
              ...state,
              current: {
                ...current,
                phase: 'revealed',
                winnerName: action.winnerName,
                wheel: current.wheel ? withSlot(current.wheel, action.wheel?.slot) : action.wheel,
              },
            }
          : state;
      }
      return {
        ...state,
        current: settled(action.drawId, action.prize, 'revealed', action.winnerName, action.now, action.wheel),
      };
    }

    case 'voided':
    case 'claimed': {
      if (current?.drawId === action.drawId && current.phase === action.type) return state;
      // Same draw: keep where its wheel stopped.
      const wheel = current?.drawId === action.drawId ? current.wheel : null;
      return { ...state, current: settled(action.drawId, action.prize, action.type, action.winnerName, action.now, wheel) };
    }
  }
}

/** Fills the winner's slot once it is known (the same wheel object when nothing changes). */
function withSlot(wheel: DrawWheel | null, slot: number | null | undefined): DrawWheel | null {
  if (!wheel || slot === null || slot === undefined || wheel.slot === slot) return wheel;
  return { ...wheel, slot };
}

const settled = (
  drawId: string,
  prize: LivePrizeRef,
  phase: StageDraw['phase'],
  winnerName: string,
  now: number,
  wheel: DrawWheel | null,
): StageDraw => ({ drawId, prize, phase, landingAt: now, revealAt: now, wheel, winnerName });
