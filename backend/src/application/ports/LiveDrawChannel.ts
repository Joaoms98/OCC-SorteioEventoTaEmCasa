export interface LiveDrawPrize {
  id: string;
  name: string;
}

/** Names on a participant roulette; the winner's slot stays secret until the wheel starts landing. */
export interface LiveDrawWheel {
  names: string[];
  winnerSlot: number;
}

export interface LiveDrawResult {
  drawId: string;
  prize: LiveDrawPrize;
  winnerName: string;
  /** Only on participant roulettes. */
  wheel?: LiveDrawWheel | null;
}

/** A draw whose winner must stay hidden from the audience: claimed (being drawn) or in suspense. */
export interface PendingLiveDraw {
  drawId: string;
  prize: LiveDrawPrize | null;
  revealAt: Date | null;
  landingAt: Date | null;
  /** Participant roulette: the slot is null until the wheel starts landing. */
  wheel: { names: string[]; winnerSlot: number | null } | null;
}

export interface LiveDrawTiming {
  /** When the participant roulette starts braking towards the winner's slot (announced then). */
  landingAt: Date;
  revealAt: Date;
}

export type LiveDrawMessage =
  | { type: 'draw_started'; drawId: string; prize: LiveDrawPrize; landingAt: Date; revealAt: Date; wheelNames: string[] | null }
  | { type: 'draw_landing'; drawId: string; winnerSlot: number }
  | { type: 'draw_revealed'; drawId: string; prize: LiveDrawPrize; winnerName: string; wheel?: LiveDrawWheel | null }
  | { type: 'draw_voided'; drawId: string; prize: LiveDrawPrize; winnerName: string }
  | { type: 'draw_claimed'; drawId: string; prize: LiveDrawPrize; winnerName: string };

/**
 * Live stage of an event, shared by the projector and every viewer.
 * Only one draw can be on stage at a time, and the winner is only published at `revealAt`.
 */
export interface LiveDrawChannel {
  /** Claims the stage for a draw about to happen; false while another draw is not revealed yet. */
  claim(eventId: string, drawId: string): boolean;
  /** Gives the stage back when the claimed draw failed. */
  release(eventId: string, drawId: string): void;
  /** Starts the public suspense of a claimed and persisted draw. */
  start(eventId: string, result: LiveDrawResult): LiveDrawTiming;
  /** Announces that a draw was voided (winner absent). */
  voided(eventId: string, result: LiveDrawResult): void;
  /** Announces that the winner received the prize (the audience celebrates it). */
  claimed(eventId: string, result: LiveDrawResult): void;
  pending(eventId: string): PendingLiveDraw | null;
  subscribe(eventId: string, listener: (message: LiveDrawMessage) => void): () => void;
}
