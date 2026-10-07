import { Participant } from '../../../domain/entities/Participant.ts';
import { BusinessRuleError, InvalidInputError, NotFoundError } from '../../../domain/errors/DomainError.ts';
import { ErrorCode } from '../../../domain/errors/ErrorCode.ts';
import type { EventRepository } from '../../../domain/repositories/EventRepository.ts';
import type { ParticipantRepository } from '../../../domain/repositories/ParticipantRepository.ts';
import type { RegistrationVerificationRepository } from '../../../domain/repositories/RegistrationVerificationRepository.ts';
import type { Clock } from '../../ports/Clock.ts';
import type { IdGenerator } from '../../ports/IdGenerator.ts';
import type { TransactionManager } from '../../ports/TransactionManager.ts';
import type { VerificationCodeHasher } from '../../ports/VerificationCodeHasher.ts';
import { ensureContactsAvailable } from '../participants/ensureContactsAvailable.ts';
import { requireEvent } from '../shared/guards.ts';
import type { InteractiveRoulette, InteractiveSpin } from './InteractiveRoulette.ts';

export interface ConfirmRegistrationInput {
  eventId: string;
  verificationId: string;
  code: string;
}

export interface ConfirmRegistrationOutput {
  participant: Participant;
  /** Interactive roulette only: the prize this participant won and the wheel to spin. */
  spin: InteractiveSpin | null;
}

type Outcome = ({ confirmed: true } & ConfirmRegistrationOutput) | { confirmed: false; attemptsLeft: number };

/**
 * Public self-registration, step 2: the right code creates the participant (only once). On the
 * interactive roulette the same transaction draws their prize, so nobody registers without one.
 */
export class ConfirmRegistration {
  constructor(
    private readonly transaction: TransactionManager,
    private readonly events: EventRepository,
    private readonly participants: ParticipantRepository,
    private readonly verifications: RegistrationVerificationRepository,
    private readonly hasher: VerificationCodeHasher,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly interactive: InteractiveRoulette,
  ) {}

  async execute(input: ConfirmRegistrationInput): Promise<ConfirmRegistrationOutput> {
    // A wrong code must still be counted, so the transaction returns the outcome instead of
    // throwing (which would roll the attempt counter back).
    const outcome = await this.transaction.run<Outcome>(async () => {
      let event = await requireEvent(this.events, input.eventId);
      // Spins are serialized per event, so two people never win the same last unit.
      if (event.isInteractive) event = await requireEvent(this.events, input.eventId, { lock: true });
      const verification = await this.verifications.findById(input.verificationId);
      if (!verification?.belongsTo(event.id)) throw new NotFoundError(ErrorCode.VerificationNotFound);
      event.ensureRegistrationOpen();

      const now = this.clock.now();
      verification.ensureCanVerify(now);
      if (!this.hasher.matches(input.code.trim(), verification.codeHash)) {
        verification.registerFailedAttempt();
        await this.verifications.update(verification);
        return { confirmed: false, attemptsLeft: verification.attemptsLeft };
      }

      const participant = Participant.create({
        id: this.ids.generate(),
        eventId: event.id,
        name: verification.name,
        phone: verification.phone,
        email: verification.email,
        now,
      });
      // Someone may have registered the same phone/e-mail since the code was sent.
      await ensureContactsAvailable(this.participants, participant);
      // Interactive roulette: the prize comes first. Without one this throws and nobody is registered.
      const pick = event.isInteractive ? await this.interactive.pick(event) : null;
      await this.participants.create(participant);
      const spin = pick ? await this.interactive.award(pick, participant, now) : null;
      await this.verifications.delete(verification.id);
      return { confirmed: true, participant, spin };
    });

    if (outcome.confirmed) return { participant: outcome.participant, spin: outcome.spin };
    if (outcome.attemptsLeft === 0) throw new BusinessRuleError(ErrorCode.TooManyVerificationAttempts);
    throw new InvalidInputError(ErrorCode.InvalidVerificationCode, { attemptsLeft: outcome.attemptsLeft });
  }
}
