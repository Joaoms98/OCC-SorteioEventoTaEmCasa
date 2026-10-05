import { Participant } from '../../../domain/entities/Participant.ts';
import type { EventRepository } from '../../../domain/repositories/EventRepository.ts';
import type { ParticipantRepository } from '../../../domain/repositories/ParticipantRepository.ts';
import type { Clock } from '../../ports/Clock.ts';
import type { IdGenerator } from '../../ports/IdGenerator.ts';
import { requireEvent } from '../shared/guards.ts';
import { ensureContactsAvailable } from './ensureContactsAvailable.ts';

export interface AddParticipantInput {
  eventId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}

/** Admin registration: works regardless of the event's public registration status. */
export class AddParticipant {
  constructor(
    private readonly events: EventRepository,
    private readonly participants: ParticipantRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: AddParticipantInput): Promise<Participant> {
    const event = await requireEvent(this.events, input.eventId);
    const participant = Participant.create({ ...input, eventId: event.id, id: this.ids.generate(), now: this.clock.now() });
    await ensureContactsAvailable(this.participants, participant);
    await this.participants.create(participant);
    return participant;
  }
}
