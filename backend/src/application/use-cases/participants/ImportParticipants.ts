import { Participant } from '../../../domain/entities/Participant.ts';
import { DomainError } from '../../../domain/errors/DomainError.ts';
import { ErrorCode } from '../../../domain/errors/ErrorCode.ts';
import type { EventRepository } from '../../../domain/repositories/EventRepository.ts';
import type { ParticipantRepository } from '../../../domain/repositories/ParticipantRepository.ts';
import type { Clock } from '../../ports/Clock.ts';
import type { IdGenerator } from '../../ports/IdGenerator.ts';
import { requireEvent } from '../shared/guards.ts';

export interface ImportParticipantEntry {
  name: string;
  phone?: string | null;
  email?: string | null;
}

export interface ImportParticipantsInput {
  eventId: string;
  entries: ImportParticipantEntry[];
}

export interface RejectedEntry {
  /** 1-based position of the entry in the submitted list. */
  line: number;
  name: string;
  code: ErrorCode;
}

export interface ImportParticipantsOutput {
  created: number;
  rejected: RejectedEntry[];
}

/** Bulk registration that keeps valid entries and reports the invalid or duplicated ones. */
export class ImportParticipants {
  constructor(
    private readonly events: EventRepository,
    private readonly participants: ParticipantRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: ImportParticipantsInput): Promise<ImportParticipantsOutput> {
    const event = await requireEvent(this.events, input.eventId);
    event.ensureOrganizerRegisters();
    const now = this.clock.now();
    const rejected: RejectedEntry[] = [];
    const candidates: Array<{ line: number; participant: Participant }> = [];

    input.entries.forEach((entry, index) => {
      const line = index + 1;
      try {
        const participant = Participant.create({ ...entry, eventId: event.id, id: this.ids.generate(), now });
        candidates.push({ line, participant });
      } catch (error) {
        if (!(error instanceof DomainError)) throw error;
        rejected.push({ line, name: entry.name, code: error.code });
      }
    });

    const taken = await this.participants.findTakenContacts(event.id, {
      phones: candidates.flatMap(({ participant }) => (participant.phone ? [participant.phone] : [])),
      emails: candidates.flatMap(({ participant }) => (participant.email ? [participant.email] : [])),
    });
    const usedPhones = new Set(taken.phones);
    const usedEmails = new Set(taken.emails);
    const accepted: Participant[] = [];

    for (const { line, participant } of candidates) {
      const { phone, email } = participant;
      if ((phone && usedPhones.has(phone)) || (email && usedEmails.has(email))) {
        rejected.push({ line, name: participant.name, code: ErrorCode.ParticipantAlreadyRegistered });
        continue;
      }
      if (phone) usedPhones.add(phone);
      if (email) usedEmails.add(email);
      accepted.push(participant);
    }

    const created = accepted.length > 0 ? await this.participants.createMany(accepted) : 0;
    rejected.sort((a, b) => a.line - b.line);
    return { created, rejected };
  }
}

