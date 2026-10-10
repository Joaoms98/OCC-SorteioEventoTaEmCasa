import { Participant } from '../../../domain/entities/Participant.ts';
import { InvalidInputError } from '../../../domain/errors/DomainError.ts';
import { ErrorCode } from '../../../domain/errors/ErrorCode.ts';
import type { EventRepository } from '../../../domain/repositories/EventRepository.ts';
import type { ParticipantRepository } from '../../../domain/repositories/ParticipantRepository.ts';
import type { Clock } from '../../ports/Clock.ts';
import type { IdGenerator } from '../../ports/IdGenerator.ts';
import type { TransactionManager } from '../../ports/TransactionManager.ts';
import { ensureContactsAvailable } from '../participants/ensureContactsAvailable.ts';
import { requireEvent } from '../shared/guards.ts';
import type { InteractiveRoulette, InteractiveSpin } from './InteractiveRoulette.ts';

export interface RegisterAndSpinInput {
  eventId: string;
  name: string;
  phone: string;
  email: string;
}

export interface RegisterAndSpinOutput {
  participant: Participant;
  /** The prize this participant won and the wheel to spin. */
  spin: InteractiveSpin;
}

/**
 * Interactive roulette: registering is spinning. One step, with no e-mail code: the participant is
 * created and the prize drawn in the same transaction, so nobody registers without one.
 */
export class RegisterAndSpin {
  constructor(
    private readonly transaction: TransactionManager,
    private readonly events: EventRepository,
    private readonly participants: ParticipantRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly interactive: InteractiveRoulette,
  ) {}

  async execute(input: RegisterAndSpinInput): Promise<RegisterAndSpinOutput> {
    if (!input.email?.trim()) throw new InvalidInputError(ErrorCode.EmailRequired, { field: 'email' });
    const now = this.clock.now();
    // Validated before the transaction: a typo must not queue behind the event lock.
    const participant = Participant.create({ ...input, id: this.ids.generate(), now });

    return this.transaction.run(async () => {
      // Spins are serialized per event, so two people never win the same last unit.
      const event = await requireEvent(this.events, input.eventId, { lock: true });
      event.ensureSpinsOnRegistration();
      event.ensureRegistrationOpen();
      await ensureContactsAvailable(this.participants, participant);
      // The prize comes first: without one this throws and nobody is registered.
      const pick = await this.interactive.pick(event);
      await this.participants.create(participant);
      return { participant, spin: await this.interactive.award(pick, participant, now) };
    });
  }
}
