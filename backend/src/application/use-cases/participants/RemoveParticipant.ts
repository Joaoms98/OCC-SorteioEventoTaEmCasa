import { ConflictError } from '../../../domain/errors/DomainError.ts';
import { ErrorCode } from '../../../domain/errors/ErrorCode.ts';
import type { DrawRepository } from '../../../domain/repositories/DrawRepository.ts';
import type { EventRepository } from '../../../domain/repositories/EventRepository.ts';
import type { ParticipantRepository } from '../../../domain/repositories/ParticipantRepository.ts';
import type { TransactionManager } from '../../ports/TransactionManager.ts';
import { requireEvent, requireParticipantOfEvent } from '../shared/guards.ts';

export interface RemoveParticipantInput {
  eventId: string;
  participantId: string;
}

/** Drawn participants are kept so the draw history stays auditable. */
export class RemoveParticipant {
  constructor(
    private readonly transaction: TransactionManager,
    private readonly events: EventRepository,
    private readonly participants: ParticipantRepository,
    private readonly draws: DrawRepository,
  ) {}

  execute(input: RemoveParticipantInput): Promise<void> {
    // The event lock keeps a draw from picking this participant while it is being removed.
    return this.transaction.run(async () => {
      await requireEvent(this.events, input.eventId, { lock: true });
      const participant = await requireParticipantOfEvent(this.participants, input.eventId, input.participantId);
      if (await this.draws.existsByParticipant(participant.id)) {
        throw new ConflictError(ErrorCode.ParticipantHasDraw);
      }
      await this.participants.delete(participant.id);
    });
  }
}
