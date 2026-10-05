import type { Event } from '../../../domain/entities/Event.ts';
import type { EventRepository } from '../../../domain/repositories/EventRepository.ts';
import { requireEvent } from '../shared/guards.ts';

export class GetPublicEvent {
  constructor(private readonly events: EventRepository) {}

  execute(input: { eventId: string }): Promise<Event> {
    return requireEvent(this.events, input.eventId);
  }
}
