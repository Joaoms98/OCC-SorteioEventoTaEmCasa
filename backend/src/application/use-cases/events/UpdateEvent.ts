import type { Event, EventChanges } from '../../../domain/entities/Event.ts';
import type { EventRepository } from '../../../domain/repositories/EventRepository.ts';
import type { Clock } from '../../ports/Clock.ts';
import { requireEvent } from '../shared/guards.ts';

export interface UpdateEventInput {
  eventId: string;
  changes: EventChanges;
}

export class UpdateEvent {
  constructor(
    private readonly events: EventRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateEventInput): Promise<Event> {
    const event = await requireEvent(this.events, input.eventId);
    event.update(input.changes, this.clock.now());
    await this.events.update(event);
    return event;
  }
}
