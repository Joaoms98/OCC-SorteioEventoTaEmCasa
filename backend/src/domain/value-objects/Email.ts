import { InvalidInputError } from '../errors/DomainError.ts';
import { ErrorCode } from '../errors/ErrorCode.ts';

const EMAIL_MAX_LENGTH = 160;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  private constructor(readonly value: string) {}

  static create(raw: string): Email {
    const normalized = raw.trim().toLowerCase();
    if (normalized.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(normalized)) {
      throw new InvalidInputError(ErrorCode.InvalidEmail, { field: 'email' });
    }
    return new Email(normalized);
  }

  static createOptional(raw: string | null | undefined): Email | null {
    return raw?.trim() ? Email.create(raw) : null;
  }
}
