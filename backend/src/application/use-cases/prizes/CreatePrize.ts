import { Prize } from '../../../domain/entities/Prize.ts';
import type { EventRepository } from '../../../domain/repositories/EventRepository.ts';
import type { PrizeRepository } from '../../../domain/repositories/PrizeRepository.ts';
import type { Clock } from '../../ports/Clock.ts';
import type { IdGenerator } from '../../ports/IdGenerator.ts';
import { requireEvent } from '../shared/guards.ts';
import { toPrizeAvailability, type PrizeAvailability } from './PrizeAvailability.ts';

export interface CreatePrizeInput {
  eventId: string;
  name: string;
  description?: string | null;
  quantity: number;
}

export class CreatePrize {
  constructor(
    private readonly events: EventRepository,
    private readonly prizes: PrizeRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreatePrizeInput): Promise<PrizeAvailability> {
    const event = await requireEvent(this.events, input.eventId);
    const prize = Prize.create({ ...input, eventId: event.id, id: this.ids.generate(), now: this.clock.now() });
    await this.prizes.create(prize);
    return toPrizeAvailability(prize, 0);
  }
}
