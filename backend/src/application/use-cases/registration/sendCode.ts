import type { Event } from '../../../domain/entities/Event.ts';
import { VERIFICATION_RULES, type RegistrationVerification } from '../../../domain/entities/RegistrationVerification.ts';
import { ServiceUnavailableError } from '../../../domain/errors/DomainError.ts';
import { ErrorCode } from '../../../domain/errors/ErrorCode.ts';
import type { EmailDelivery, EmailSender } from '../../ports/EmailSender.ts';

/** Sends the code; provider failures become a "try again" error for the participant. */
export async function sendCode(
  sender: EmailSender,
  verification: RegistrationVerification,
  event: Event,
  code: string,
): Promise<EmailDelivery> {
  try {
    return await sender.sendVerificationCode({
      to: verification.email,
      name: verification.name,
      eventName: event.name,
      code,
      expiresInMinutes: VERIFICATION_RULES.codeTtlMs / 60_000,
    });
  } catch {
    throw new ServiceUnavailableError(ErrorCode.EmailDeliveryFailed);
  }
}
