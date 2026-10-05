import { BusinessRuleError } from '../errors/DomainError.ts';
import { ErrorCode } from '../errors/ErrorCode.ts';

export const VERIFICATION_RULES = {
  codeTtlMs: 10 * 60 * 1000,
  maxAttempts: 5,
  resendCooldownMs: 60 * 1000,
  maxSends: 5,
} as const;

export interface RegistrationVerificationProps {
  id: string;
  eventId: string;
  name: string;
  phone: string;
  email: string;
  /** Only a keyed hash of the code is stored, never the code itself. */
  codeHash: string;
  attempts: number;
  sendCount: number;
  lastSentAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

export interface StartVerificationProps {
  id: string;
  eventId: string;
  name: string;
  phone: string;
  email: string;
  codeHash: string;
  now: Date;
}

/**
 * A public registration waiting for the participant to prove they own the e-mail address:
 * the participant is only created once the code sent by e-mail is confirmed.
 */
export class RegistrationVerification {
  private constructor(private readonly props: RegistrationVerificationProps) {}

  static start(input: StartVerificationProps): RegistrationVerification {
    return new RegistrationVerification({
      id: input.id,
      eventId: input.eventId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      codeHash: input.codeHash,
      attempts: 0,
      sendCount: 1,
      lastSentAt: input.now,
      expiresAt: new Date(input.now.getTime() + VERIFICATION_RULES.codeTtlMs),
      createdAt: input.now,
    });
  }

  static restore(props: RegistrationVerificationProps): RegistrationVerification {
    return new RegistrationVerification({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get eventId(): string {
    return this.props.eventId;
  }

  get name(): string {
    return this.props.name;
  }

  get phone(): string {
    return this.props.phone;
  }

  get email(): string {
    return this.props.email;
  }

  get codeHash(): string {
    return this.props.codeHash;
  }

  get attempts(): number {
    return this.props.attempts;
  }

  get sendCount(): number {
    return this.props.sendCount;
  }

  get lastSentAt(): Date {
    return this.props.lastSentAt;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get attemptsLeft(): number {
    return Math.max(VERIFICATION_RULES.maxAttempts - this.props.attempts, 0);
  }

  get resendAvailableAt(): Date {
    return new Date(this.props.lastSentAt.getTime() + VERIFICATION_RULES.resendCooldownMs);
  }

  belongsTo(eventId: string): boolean {
    return this.props.eventId === eventId;
  }

  /** Fails when the current code can no longer be checked (expired or locked by wrong guesses). */
  ensureCanVerify(now: Date): void {
    if (this.props.attempts >= VERIFICATION_RULES.maxAttempts) {
      throw new BusinessRuleError(ErrorCode.TooManyVerificationAttempts);
    }
    if (now.getTime() >= this.props.expiresAt.getTime()) {
      throw new BusinessRuleError(ErrorCode.VerificationExpired);
    }
  }

  registerFailedAttempt(): void {
    this.props.attempts += 1;
  }

  /** A new code (after the cooldown, a limited number of times) also unlocks the attempts. */
  renewCode(codeHash: string, now: Date): void {
    if (this.props.sendCount >= VERIFICATION_RULES.maxSends) {
      throw new BusinessRuleError(ErrorCode.VerificationResendLimit);
    }
    const waitMs = this.resendAvailableAt.getTime() - now.getTime();
    if (waitMs > 0) {
      throw new BusinessRuleError(ErrorCode.VerificationResendTooSoon, { secondsLeft: Math.ceil(waitMs / 1000) });
    }
    this.props.codeHash = codeHash;
    this.props.attempts = 0;
    this.props.sendCount += 1;
    this.props.lastSentAt = now;
    this.props.expiresAt = new Date(now.getTime() + VERIFICATION_RULES.codeTtlMs);
  }
}
