import { Draw } from '../../../domain/entities/Draw.ts';
import { DrawMode } from '../../../domain/entities/Event.ts';
import { BusinessRuleError } from '../../../domain/errors/DomainError.ts';
import { ErrorCode } from '../../../domain/errors/ErrorCode.ts';
import type { DrawDetails, DrawRepository } from '../../../domain/repositories/DrawRepository.ts';
import type { EventRepository } from '../../../domain/repositories/EventRepository.ts';
import type { ParticipantRepository } from '../../../domain/repositories/ParticipantRepository.ts';
import type { PrizeRepository } from '../../../domain/repositories/PrizeRepository.ts';
import type { Prize } from '../../../domain/entities/Prize.ts';
import type { Clock } from '../../ports/Clock.ts';
import type { IdGenerator } from '../../ports/IdGenerator.ts';
import type { LiveDrawChannel, LiveDrawWheel } from '../../ports/LiveDrawChannel.ts';
import type { RandomNumberGenerator } from '../../ports/RandomNumberGenerator.ts';
import type { TransactionManager } from '../../ports/TransactionManager.ts';
import { requireEvent, requirePrizeOfEvent } from '../shared/guards.ts';

export interface DrawPrizeInput {
  eventId: string;
  /** Prize to draw; when omitted the prize is drawn too (roulette), weighted by remaining units. */
  prizeId?: string;
}

/** Slices of the participant roulette: the winner plus random contenders. */
export const WHEEL_NAMES = 12;

export interface DrawPrizeOutput extends DrawDetails {
  remainingUnits: number;
  /** Participant roulette only: the names on the wheel and the winner's slot. */
  wheel: LiveDrawWheel | null;
  /** When the participant roulette starts braking towards the winner. */
  landingAt: Date;
  /** When the winner is revealed to the live audience (and should be on the projector). */
  revealAt: Date;
}

/**
 * Draws one unit of a prize among the participants that have never been drawn in the event.
 * The winner is chosen server-side with a cryptographically secure RNG and broadcast live:
 * everyone watching sees the suspense at the same time and the winner only at `revealAt`.
 */
export class DrawPrize {
  constructor(
    private readonly transaction: TransactionManager,
    private readonly events: EventRepository,
    private readonly participants: ParticipantRepository,
    private readonly prizes: PrizeRepository,
    private readonly draws: DrawRepository,
    private readonly random: RandomNumberGenerator,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly live: LiveDrawChannel,
  ) {}

  async execute(input: DrawPrizeInput): Promise<DrawPrizeOutput> {
    const drawId = this.ids.generate();
    if (!this.live.claim(input.eventId, drawId)) throw new BusinessRuleError(ErrorCode.DrawInProgress);

    let result: Omit<DrawPrizeOutput, 'landingAt' | 'revealAt'>;
    try {
      result = await this.drawWinner(input, drawId);
    } catch (error) {
      this.live.release(input.eventId, drawId);
      throw error;
    }

    const timing = this.live.start(input.eventId, {
      drawId,
      prize: result.prize,
      winnerName: result.participant.name,
      wheel: result.wheel,
    });
    return { ...result, ...timing };
  }

  private async chosenPrize(eventId: string, prizeId: string): Promise<{ prize: Prize; drawnUnits: number }> {
    const prize = await requirePrizeOfEvent(this.prizes, eventId, prizeId);
    const drawnUnits = await this.draws.countConfirmedByPrize(prize.id);
    prize.ensureAvailable(drawnUnits);
    return { prize, drawnUnits };
  }

  /**
   * Every remaining unit is one equal chance, like tickets in a bag: a prize with 3 units left is
   * three times as likely as a prize with 1. The live roulette draws its slices in the same proportion.
   */
  private async rouletteRandomPrize(eventId: string): Promise<{ prize: Prize; drawnUnits: number }> {
    const [prizes, drawnByPrize] = await Promise.all([
      this.prizes.findByEvent(eventId),
      this.draws.countConfirmedByEventGroupedByPrize(eventId),
    ]);
    const available = prizes
      .map((prize) => ({ prize, drawnUnits: drawnByPrize.get(prize.id) ?? 0 }))
      .filter(({ prize, drawnUnits }) => prize.remainingUnits(drawnUnits) > 0);

    const totalUnits = available.reduce((sum, { prize, drawnUnits }) => sum + prize.remainingUnits(drawnUnits), 0);
    if (totalUnits === 0) throw new BusinessRuleError(ErrorCode.NoPrizesAvailable);

    let ticket = this.random.nextInt(totalUnits);
    for (const candidate of available) {
      ticket -= candidate.prize.remainingUnits(candidate.drawnUnits);
      if (ticket < 0) return candidate;
    }
    throw new Error('Unreachable: ticket outside of the remaining units');
  }

  private drawWinner(input: DrawPrizeInput, drawId: string): Promise<Omit<DrawPrizeOutput, 'landingAt' | 'revealAt'>> {
    // The event lock serializes draws, so stock and eligibility cannot change mid-draw.
    return this.transaction.run(async () => {
      const event = await requireEvent(this.events, input.eventId, { lock: true });
      const { prize, drawnUnits } = input.prizeId
        ? await this.chosenPrize(event.id, input.prizeId)
        : await this.rouletteRandomPrize(event.id);

      const eligibleCount = await this.participants.countEligibleForDraw(event.id);
      if (eligibleCount === 0) throw new BusinessRuleError(ErrorCode.NoEligibleParticipants);

      const winner = await this.participants.findEligibleForDrawAt(event.id, this.random.nextInt(eligibleCount));
      if (!winner) throw new BusinessRuleError(ErrorCode.NoEligibleParticipants);

      const draw = Draw.create({
        id: drawId,
        eventId: event.id,
        prizeId: prize.id,
        participantId: winner.id,
        now: this.clock.now(),
      });
      await this.draws.create(draw);

      return {
        draw,
        participant: { id: winner.id, name: winner.name, phone: winner.phone, email: winner.email },
        prize: { id: prize.id, name: prize.name },
        remainingUnits: prize.remainingUnits(drawnUnits + 1),
        wheel: event.drawMode === DrawMode.Participants ? await this.participantWheel(event.id, winner.name) : null,
      };
    });
  }

  /**
   * Visual only: the winner was already drawn among every eligible participant. The other names are
   * random contenders (the winner is no longer eligible, so it is never repeated) and the winner's
   * slot is random too, so the wheel layout gives nothing away before it starts braking.
   */
  private async participantWheel(eventId: string, winnerName: string): Promise<LiveDrawWheel> {
    const others = await this.participants.sampleEligibleNames(eventId, WHEEL_NAMES - 1);
    const winnerSlot = this.random.nextInt(others.length + 1);
    return { names: [...others.slice(0, winnerSlot), winnerName, ...others.slice(winnerSlot)], winnerSlot };
  }
}
