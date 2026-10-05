import type { DrawDetails, DrawRepository } from '../../../domain/repositories/DrawRepository.ts';
import type { EventRepository } from '../../../domain/repositories/EventRepository.ts';
import { requireEvent } from '../shared/guards.ts';

export class ListDraws {
  constructor(
    private readonly events: EventRepository,
    private readonly draws: DrawRepository,
  ) {}

  async execute(input: { eventId: string }): Promise<DrawDetails[]> {
    const event = await requireEvent(this.events, input.eventId);
    return this.draws.findDetailsByEvent(event.id);
  }
}
