import type { Participant } from '../../../domain/entities/Participant.ts';
import { ConflictError } from '../../../domain/errors/DomainError.ts';
import { ErrorCode } from '../../../domain/errors/ErrorCode.ts';
import type { ParticipantRepository } from '../../../domain/repositories/ParticipantRepository.ts';

/** A phone or e-mail identifies a single participant inside an event. */
export async function ensureContactsAvailable(
  participants: ParticipantRepository,
  participant: Participant,
): Promise<void> {
  const phones = participant.phone ? [participant.phone] : [];
  const emails = participant.email ? [participant.email] : [];
  if (phones.length === 0 && emails.length === 0) return;

  const taken = await participants.findTakenContacts(participant.eventId, { phones, emails });
  if (taken.phones.length > 0) {
    throw new ConflictError(ErrorCode.ParticipantAlreadyRegistered, { field: 'phone' });
  }
  if (taken.emails.length > 0) {
    throw new ConflictError(ErrorCode.ParticipantAlreadyRegistered, { field: 'email' });
  }
}
