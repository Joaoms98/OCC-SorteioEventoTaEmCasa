import { BusinessRuleError } from '../errors/DomainError.ts';
import { ErrorCode } from '../errors/ErrorCode.ts';

export const DrawStatus = {
  Confirmed: 'CONFIRMED',
  Voided: 'VOIDED',
} as const;

export type DrawStatus = (typeof DrawStatus)[keyof typeof DrawStatus];

export interface DrawProps {
  id: string;
  eventId: string;
  prizeId: string;
  participantId: string;
  status: DrawStatus;
  drawnAt: Date;
  voidedAt: Date | null;
  /** When the winner picked the prize up. */
  claimedAt: Date | null;
}

export interface CreateDrawProps {
  id: string;
  eventId: string;
  prizeId: string;
  participantId: string;
  now: Date;
}

/**
 * A single prize unit handed to a participant. Voiding a draw (e.g. the winner is absent)
 * gives the unit back to the prize; the participant stays ineligible for the rest of the event.
 * Claiming records that the winner received the prize, after which it can no longer be voided.
 */
export class Draw {
  private constructor(private readonly props: DrawProps) {}

  static create(input: CreateDrawProps): Draw {
    return new Draw({
      id: input.id,
      eventId: input.eventId,
      prizeId: input.prizeId,
      participantId: input.participantId,
      status: DrawStatus.Confirmed,
      drawnAt: input.now,
      voidedAt: null,
      claimedAt: null,
    });
  }

  static restore(props: DrawProps): Draw {
    return new Draw({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get eventId(): string {
    return this.props.eventId;
  }

  get prizeId(): string {
    return this.props.prizeId;
  }

  get participantId(): string {
    return this.props.participantId;
  }

  get status(): DrawStatus {
    return this.props.status;
  }

  get drawnAt(): Date {
    return this.props.drawnAt;
  }

  get voidedAt(): Date | null {
    return this.props.voidedAt;
  }

  get claimedAt(): Date | null {
    return this.props.claimedAt;
  }

  belongsTo(eventId: string): boolean {
    return this.props.eventId === eventId;
  }

  markAsVoided(now: Date): void {
    if (this.props.status === DrawStatus.Voided) {
      throw new BusinessRuleError(ErrorCode.DrawAlreadyVoided);
    }
    // A prize already handed over cannot go back to the pool.
    if (this.props.claimedAt) {
      throw new BusinessRuleError(ErrorCode.PrizeAlreadyClaimed);
    }
    this.props.status = DrawStatus.Voided;
    this.props.voidedAt = now;
  }

  /** The winner showed up and received the prize. */
  markAsClaimed(now: Date): void {
    if (this.props.status === DrawStatus.Voided) {
      throw new BusinessRuleError(ErrorCode.DrawAlreadyVoided);
    }
    if (this.props.claimedAt) {
      throw new BusinessRuleError(ErrorCode.PrizeAlreadyClaimed);
    }
    this.props.claimedAt = now;
  }
}
