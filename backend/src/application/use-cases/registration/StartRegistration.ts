import { Participant } from '../../../domain/entities/Participant.ts';
import { RegistrationVerification } from '../../../domain/entities/RegistrationVerification.ts';
import { BusinessRuleError, InvalidInputError } from '../../../domain/errors/DomainError.ts';
import { ErrorCode } from '../../../domain/errors/ErrorCode.ts';
import type { EventRepository } from '../../../domain/repositories/EventRepository.ts';
import type { ParticipantRepository } from '../../../domain/repositories/ParticipantRepository.ts';
import type { RegistrationVerificationRepository } from '../../../domain/repositories/RegistrationVerificationRepository.ts';
import type { Clock } from '../../ports/Clock.ts';
import type { EmailSender } from '../../ports/EmailSender.ts';
import type { IdGenerator } from '../../ports/IdGenerator.ts';
import type { RandomNumberGenerator } from '../../ports/RandomNumberGenerator.ts';
import type { VerificationCodeHasher } from '../../ports/VerificationCodeHasher.ts';
import { ensureContactsAvailable } from '../participants/ensureContactsAvailable.ts';
import { requireEvent } from '../shared/guards.ts';
import type { InteractiveRoulette } from './InteractiveRoulette.ts';
import { generateVerificationCode } from './verificationCode.ts';
import { sendCode } from './sendCode.ts';

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
/** Anti-spam: registrations that can be started for the same e-mail address per hour. */
export const MAX_STARTS_PER_EMAIL_PER_HOUR = 3;

export interface StartRegistrationInput {
  eventId: string;
  name: string;
  phone: string;
  email: string;
}

export interface StartRegistrationOutput {
  verification: RegistrationVerification;
  /** Only filled by development e-mail senders. */
  previewCode: string | null;
}

/**
 * Public self-registration, step 1: validates the data, refuses contacts already registered in
 * the event and e-mails a one-time code. Nobody is registered until the code is confirmed.
 */
export class StartRegistration {
  constructor(
    private readonly events: EventRepository,
    private readonly participants: ParticipantRepository,
    private readonly verifications: RegistrationVerificationRepository,
    private readonly hasher: VerificationCodeHasher,
    private readonly sender: EmailSender,
    private readonly random: RandomNumberGenerator,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly interactive: InteractiveRoulette,
  ) {}

  async execute(input: StartRegistrationInput): Promise<StartRegistrationOutput> {
    const event = await requireEvent(this.events, input.eventId);
    event.ensureRegistrationOpen();
    // Interactive roulette: no prize left means no spin, so do not even send the code.
    if (event.isInteractive) await this.interactive.ensurePrizesLeft(event.id);
    if (!input.email?.trim()) throw new InvalidInputError(ErrorCode.EmailRequired, { field: 'email' });

    const now = this.clock.now();
    // Same validation and normalization as a real participant (phone digits, lowercase e-mail).
    const draft = Participant.create({ ...input, eventId: event.id, id: this.ids.generate(), now });
    await ensureContactsAvailable(this.participants, draft);

    const email = draft.email as string;
    const recent = await this.verifications.countStartedForEmailSince(email, new Date(now.getTime() - ONE_HOUR_MS));
    if (recent >= MAX_STARTS_PER_EMAIL_PER_HOUR) throw new BusinessRuleError(ErrorCode.TooManyVerificationsForEmail);

    const code = generateVerificationCode(this.random);
    const verification = RegistrationVerification.start({
      id: this.ids.generate(),
      eventId: event.id,
      name: draft.name,
      phone: draft.phone as string,
      email,
      codeHash: this.hasher.hash(code),
      now,
    });

    // Sent before saving: a failed delivery leaves nothing behind and does not count as an attempt.
    const delivery = await sendCode(this.sender, verification, event, code);
    await this.verifications.create(verification);
    await this.verifications.deleteExpiredBefore(new Date(now.getTime() - ONE_DAY_MS));
    return { verification, previewCode: delivery.previewCode ?? null };
  }
}
