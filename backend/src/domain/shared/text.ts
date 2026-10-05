import { InvalidInputError } from '../errors/DomainError.ts';
import type { ErrorCode } from '../errors/ErrorCode.ts';

export const NAME_MAX_LENGTH = 120;
export const DESCRIPTION_MAX_LENGTH = 500;

/** Trims and collapses inner whitespace, rejecting empty or oversized values. */
export function normalizeName(value: string, errorCode: ErrorCode): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length === 0 || normalized.length > NAME_MAX_LENGTH) {
    throw new InvalidInputError(errorCode);
  }
  return normalized;
}

export function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized.length > 0 ? normalized.slice(0, DESCRIPTION_MAX_LENGTH) : null;
}
