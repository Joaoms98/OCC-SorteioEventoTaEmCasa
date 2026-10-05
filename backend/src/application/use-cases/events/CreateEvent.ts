import { Event, type DrawMode } from '../../../domain/entities/Event.ts';
import type { EventRepository } from '../../../domain/repositories/EventRepository.ts';
import type { Clock } from '../../ports/Clock.ts';
import type { IdGenerator } from '../../ports/IdGenerator.ts';

export interface CreateEventInput {
  name: string;
  description?: string | null;
  eventDate?: Date | null;
  registrationOpen?: boolean;
  drawMode?: DrawMode;
}

export class CreateEvent {
  constructor(
    private readonly events: EventRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateEventInput): Promise<Event> {
    const event = Event.create({ ...input, id: this.ids.generate(), now: this.clock.now() });
    await this.events.create(event);
    return event;
  }
}
