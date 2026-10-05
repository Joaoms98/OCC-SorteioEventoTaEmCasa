import type { Event } from '../../../domain/entities/Event.ts';
import type { DrawRepository } from '../../../domain/repositories/DrawRepository.ts';
import type { EventRepository } from '../../../domain/repositories/EventRepository.ts';
import type { ParticipantRepository } from '../../../domain/repositories/ParticipantRepository.ts';
import type { PrizeRepository } from '../../../domain/repositories/PrizeRepository.ts';
import { requireEvent } from '../shared/guards.ts';

export interface EventStats {
  participants: number;
  eligibleParticipants: number;
  prizeUnits: number;
  drawnUnits: number;
}

export interface EventOverview {
  event: Event;
  stats: EventStats;
}

export class GetEventOverview {
  constructor(
    private readonly events: EventRepository,
    private readonly participants: ParticipantRepository,
    private readonly prizes: PrizeRepository,
    private readonly draws: DrawRepository,
  ) {}

  async execute(input: { eventId: string }): Promise<EventOverview> {
    const event = await requireEvent(this.events, input.eventId);
    const [participants, eligibleParticipants, prizes, drawnByPrize] = await Promise.all([
      this.participants.countByEvent(event.id),
      this.participants.countEligibleForDraw(event.id),
      this.prizes.findByEvent(event.id),
      this.draws.countConfirmedByEventGroupedByPrize(event.id),
    ]);

    const prizeUnits = prizes.reduce((sum, prize) => sum + prize.quantity, 0);
    const drawnUnits = [...drawnByPrize.values()].reduce((sum, count) => sum + count, 0);

    return { event, stats: { participants, eligibleParticipants, prizeUnits, drawnUnits } };
  }
}
