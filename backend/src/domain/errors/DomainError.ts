import type { ErrorCode } from './ErrorCode.ts';

export type DomainErrorKind =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'BUSINESS_RULE'
  | 'INVALID_INPUT'
  | 'UNAUTHORIZED'
  | 'UNAVAILABLE';

/**
 * Base error for every expected failure. It only carries a machine-readable code;
 * translating it into a user-facing message is the presentation layer's job.
 */
export abstract class DomainError extends Error {
  abstract readonly kind: DomainErrorKind;
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, details?: Record<string, unknown>) {
    super(code);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}

export class NotFoundError extends DomainError {
  readonly kind = 'NOT_FOUND';
}

export class ConflictError extends DomainError {
  readonly kind = 'CONFLICT';
}

export class BusinessRuleError extends DomainError {
  readonly kind = 'BUSINESS_RULE';
}

export class InvalidInputError extends DomainError {
  readonly kind = 'INVALID_INPUT';
}

export class UnauthorizedError extends DomainError {
  readonly kind = 'UNAUTHORIZED';
}

/** An external service needed by the operation (e.g. e-mail delivery) failed. */
export class ServiceUnavailableError extends DomainError {
  readonly kind = 'UNAVAILABLE';
}
