import type { Event } from '../../../domain/entities/Event.ts';
import type { EventRepository } from '../../../domain/repositories/EventRepository.ts';

export class ListEvents {
  constructor(private readonly events: EventRepository) {}

  execute(): Promise<Event[]> {
    return this.events.findAll();
  }
}
