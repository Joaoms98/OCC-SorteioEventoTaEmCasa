import type { RegistrationVerification } from '../../../domain/entities/RegistrationVerification.ts';
import { NotFoundError } from '../../../domain/errors/DomainError.ts';
import { ErrorCode } from '../../../domain/errors/ErrorCode.ts';
import type { EventRepository } from '../../../domain/repositories/EventRepository.ts';
import type { RegistrationVerificationRepository } from '../../../domain/repositories/RegistrationVerificationRepository.ts';
import type { Clock } from '../../ports/Clock.ts';
import type { EmailSender } from '../../ports/EmailSender.ts';
import type { RandomNumberGenerator } from '../../ports/RandomNumberGenerator.ts';
import type { VerificationCodeHasher } from '../../ports/VerificationCodeHasher.ts';
import { requireEvent } from '../shared/guards.ts';
import { generateVerificationCode } from './verificationCode.ts';
import { sendCode } from './sendCode.ts';

export interface ResendRegistrationCodeInput {
  eventId: string;
  verificationId: string;
}

export interface ResendRegistrationCodeOutput {
  verification: RegistrationVerification;
  previewCode: string | null;
}

/** New code for a pending registration (after a cooldown, a limited number of times). */
export class ResendRegistrationCode {
  constructor(
    private readonly events: EventRepository,
    private readonly verifications: RegistrationVerificationRepository,
    private readonly hasher: VerificationCodeHasher,
    private readonly sender: EmailSender,
    private readonly random: RandomNumberGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: ResendRegistrationCodeInput): Promise<ResendRegistrationCodeOutput> {
    const event = await requireEvent(this.events, input.eventId);
    const verification = await this.verifications.findById(input.verificationId);
    if (!verification?.belongsTo(event.id)) throw new NotFoundError(ErrorCode.VerificationNotFound);
    event.ensureRegistrationOpen();

    const code = generateVerificationCode(this.random);
    verification.renewCode(this.hasher.hash(code), this.clock.now());
    // Saved only after a successful delivery, so a failure can be retried right away.
    const delivery = await sendCode(this.sender, verification, event, code);
    await this.verifications.update(verification);
    return { verification, previewCode: delivery.previewCode ?? null };
  }
}
