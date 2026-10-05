import type { DrawWheel, PublicEvent } from '../types/api';

export interface LivePrizeRef {
  id: string;
  name: string;
}

export interface LivePrize extends LivePrizeRef {
  quantity: number;
  remainingUnits: number;
  imageUrl: string | null;
}

export interface LiveWinner {
  drawId: string;
  winnerName: string;
  prize: LivePrizeRef;
  drawnAt: string;
  claimedAt: string | null;
}

export interface LiveSnapshot {
  event: PublicEvent;
  prizes: LivePrize[];
  recentWinners: LiveWinner[];
  stats: { participants: number; eligibleParticipants: number };
  /** Random abbreviated names ("Maria S.") for the rolling animation and the idle participant roulette. */
  rollNames: string[];
  pendingDraw: {
    drawId: string;
    prize: LivePrizeRef;
    landingInMs: number;
    revealInMs: number;
    wheel: DrawWheel | null;
  } | null;
  viewers: number;
}

export type StagePhase = 'drawing' | 'revealed' | 'claimed' | 'voided';

export interface StageDraw {
  drawId: string;
  prize: LivePrizeRef;
  phase: StagePhase;
  /** Local timestamp (ms) when the participant roulette starts braking towards the winner. */
  landingAt: number;
  /** Local timestamp (ms) when the winner is revealed. */
  revealAt: number;
  /** Participant roulette of this draw (null on the prize roulette). */
  wheel: DrawWheel | null;
  /** Unknown to viewers until the server reveals it; known in advance only by the organizer's screen. */
  winnerName: string | null;
}

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'closed';

export interface LiveState {
  status: ConnectionStatus;
  snapshot: LiveSnapshot | null;
  current: StageDraw | null;
}
