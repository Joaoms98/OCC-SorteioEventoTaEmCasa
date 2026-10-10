/**
 * How the raffle works: the organizer spins a live roulette of prizes (the prize is drawn too) or
 * of participants' names; or, on the interactive roulette, whoever registers spins a prize
 * roulette on their own phone and wins something.
 */
export type DrawMode = 'PRIZES' | 'PARTICIPANTS' | 'INTERACTIVE';

export interface RaffleEvent {
  id: string;
  name: string;
  description: string | null;
  eventDate: string | null;
  registrationOpen: boolean;
  drawMode: DrawMode;
  createdAt: string;
  updatedAt: string;
}

export interface EventStats {
  participants: number;
  eligibleParticipants: number;
  prizeUnits: number;
  drawnUnits: number;
}

export interface EventOverview extends RaffleEvent {
  stats: EventStats;
}

export type PublicEvent = Pick<RaffleEvent, 'id' | 'name' | 'description' | 'eventDate' | 'registrationOpen' | 'drawMode'>;

/** Event listed on the public home page: open for registration or with prizes still to draw. */
export interface ActiveEvent extends PublicEvent {
  remainingUnits: number;
}

/** A prize as anyone may see it: enough to draw the roulette. */
export interface PublicPrize {
  id: string;
  name: string;
  imageUrl: string | null;
  remainingUnits: number;
}

/** Interactive roulette: the prize the server drew and the wheel the participant spins. */
export interface InteractiveSpin {
  drawId: string;
  prize: Pick<PublicPrize, 'id' | 'name' | 'imageUrl'>;
  /** Prizes and units before this spin (the won prize is among them). */
  wheel: PublicPrize[];
}

export interface RegistrationResult {
  id: string;
  name: string;
}

/** Interactive roulette: registering already answers with the spin. */
export interface SpinResult extends RegistrationResult {
  spin: InteractiveSpin;
}

export interface EventInput {
  name: string;
  description?: string | null;
  eventDate?: string | null;
  registrationOpen?: boolean;
  drawMode?: DrawMode;
}

export interface Participant {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  createdAt: string;
}

export interface ParticipantInput {
  name: string;
  phone?: string;
  email?: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ImportResult {
  created: number;
  rejected: Array<{ line: number; name: string; code: string; message: string }>;
}

export interface Prize {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  /** Public URL path of the photo (resolve with assetUrl), or null. */
  imageUrl: string | null;
  drawnUnits: number;
  remainingUnits: number;
  createdAt: string;
  updatedAt: string;
}

export interface PrizeInput {
  name: string;
  description?: string | null;
  quantity: number;
}

export type DrawStatus = 'CONFIRMED' | 'VOIDED';

export interface Draw {
  id: string;
  status: DrawStatus;
  drawnAt: string;
  voidedAt: string | null;
  /** When the winner received the prize. */
  claimedAt: string | null;
  participant: { id: string; name: string; phone: string | null; email: string | null };
  prize: { id: string; name: string };
}

/** Participant roulette: abbreviated names on the wheel; slot is null until the wheel starts landing. */
export interface DrawWheel {
  names: string[];
  slot: number | null;
}

export interface DrawResult extends Draw {
  remainingUnits: number;
  /** Delay until the participant roulette starts braking towards the winner. */
  landingInMs: number;
  /** Delay until the winner is revealed to everyone watching live. */
  revealInMs: number;
  wheel: DrawWheel | null;
}

/** Pending public registration: waiting for the code sent by e-mail. */
export interface RegistrationVerification {
  verificationId: string;
  /** Masked address, e.g. "an***@gmail.com". */
  email: string;
  expiresAt: string;
  resendAvailableAt: string;
  /** Development only: the code, shown on screen when no real e-mail is sent. */
  previewCode?: string;
}

export interface FieldError {
  field: string;
  message: string;
}
