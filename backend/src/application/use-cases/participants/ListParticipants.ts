import type { Participant } from '../../../domain/entities/Participant.ts';
import type { EventRepository } from '../../../domain/repositories/EventRepository.ts';
import type { Page } from '../../../domain/repositories/Pagination.ts';
import type { ParticipantRepository } from '../../../domain/repositories/ParticipantRepository.ts';
import { requireEvent } from '../shared/guards.ts';

export interface ListParticipantsInput {
  eventId: string;
  search?: string;
  page: number;
  pageSize: number;
}

export class ListParticipants {
  constructor(
    private readonly events: EventRepository,
    private readonly participants: ParticipantRepository,
  ) {}

  async execute(input: ListParticipantsInput): Promise<Page<Participant>> {
    const event = await requireEvent(this.events, input.eventId);
    const search = input.search?.trim() || undefined;
    return this.participants.list(event.id, { search, page: input.page, pageSize: input.pageSize });
  }
}
