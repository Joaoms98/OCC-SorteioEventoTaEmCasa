import type { EventRepository } from '../../../domain/repositories/EventRepository.ts';
import { requireEvent } from '../shared/guards.ts';

/** Removes the event together with its participants, prizes and draws. */
export class DeleteEvent {
  constructor(private readonly events: EventRepository) {}

  async execute(input: { eventId: string }): Promise<void> {
    const event = await requireEvent(this.events, input.eventId);
    await this.events.delete(event.id);
  }
}
