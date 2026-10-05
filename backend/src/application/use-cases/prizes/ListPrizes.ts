import type { DrawRepository } from '../../../domain/repositories/DrawRepository.ts';
import type { EventRepository } from '../../../domain/repositories/EventRepository.ts';
import type { PrizeRepository } from '../../../domain/repositories/PrizeRepository.ts';
import { requireEvent } from '../shared/guards.ts';
import { toPrizeAvailability, type PrizeAvailability } from './PrizeAvailability.ts';

export class ListPrizes {
  constructor(
    private readonly events: EventRepository,
    private readonly prizes: PrizeRepository,
    private readonly draws: DrawRepository,
  ) {}

  async execute(input: { eventId: string }): Promise<PrizeAvailability[]> {
    const event = await requireEvent(this.events, input.eventId);
    const [prizes, drawnByPrize] = await Promise.all([
      this.prizes.findByEvent(event.id),
      this.draws.countConfirmedByEventGroupedByPrize(event.id),
    ]);
    return prizes.map((prize) => toPrizeAvailability(prize, drawnByPrize.get(prize.id) ?? 0));
  }
}
