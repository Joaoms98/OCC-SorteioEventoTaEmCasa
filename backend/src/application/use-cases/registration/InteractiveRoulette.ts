import { Draw } from '../../../domain/entities/Draw.ts';
import type { Event } from '../../../domain/entities/Event.ts';
import type { Participant } from '../../../domain/entities/Participant.ts';
import type { Prize } from '../../../domain/entities/Prize.ts';
import { BusinessRuleError } from '../../../domain/errors/DomainError.ts';
import { ErrorCode } from '../../../domain/errors/ErrorCode.ts';
import type { DrawRepository } from '../../../domain/repositories/DrawRepository.ts';
import type { PrizeRepository } from '../../../domain/repositories/PrizeRepository.ts';
import type { IdGenerator } from '../../ports/IdGenerator.ts';
import type { RandomNumberGenerator } from '../../ports/RandomNumberGenerator.ts';
import { availablePrizes, pickFromWheel } from '../draws/roulettePrize.ts';
import type { PrizeAvailability } from '../prizes/PrizeAvailability.ts';

/** The prize the wheel will land on, chosen before anything about the participant is saved. */
export interface PrizePick {
  prize: Prize;
  /** Prizes (and units left) before this spin: the wheel the participant turns. */
  wheel: PrizeAvailability[];
}

export interface InteractiveSpin extends PrizePick {
  draw: Draw;
}

/**
 * Interactive roulette: whoever registers spins once and always wins a prize. The prize is drawn
 * on the server when the registration is confirmed; the wheel on the phone only lands on it.
 * So an event takes as many participants as it has prize units.
 */
export class InteractiveRoulette {
  constructor(
    private readonly prizes: PrizeRepository,
    private readonly draws: DrawRepository,
    private readonly random: RandomNumberGenerator,
    private readonly ids: IdGenerator,
  ) {}

  /** Early answer for someone starting a registration (the binding check is the spin itself). */
  async ensurePrizesLeft(eventId: string): Promise<void> {
    if ((await availablePrizes(this.prizes, this.draws, eventId)).length === 0) {
      throw new BusinessRuleError(ErrorCode.PrizesExhausted);
    }
  }

  /**
   * Draws the prize, or refuses when none is left. Must run inside the registration transaction,
   * with the event locked and before the participant is saved: no prize, no registration.
   */
  async pick(event: Event): Promise<PrizePick> {
    const wheel = await availablePrizes(this.prizes, this.draws, event.id);
    const picked = pickFromWheel(wheel, this.random);
    if (!picked) throw new BusinessRuleError(ErrorCode.PrizesExhausted);
    return { prize: picked.prize, wheel };
  }

  /** Records that the participant won the picked prize (same transaction as `pick`). */
  async award(pick: PrizePick, participant: Participant, now: Date): Promise<InteractiveSpin> {
    const draw = Draw.create({
      id: this.ids.generate(),
      eventId: participant.eventId,
      prizeId: pick.prize.id,
      participantId: participant.id,
      now,
    });
    await this.draws.create(draw);
    return { ...pick, draw };
  }
}
