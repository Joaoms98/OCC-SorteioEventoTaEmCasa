import type { FieldError } from '../types/api';

export const NETWORK_ERROR_MESSAGE = 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';
export const UNEXPECTED_ERROR_MESSAGE = 'Ocorreu um erro inesperado. Tente novamente.';

/** Error whose message is already written for the user (in Portuguese). */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}

export class ApiError extends UserFacingError {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Maps the API error details to `{ field: message }` so forms can highlight inputs. */
  get fieldErrors(): Record<string, string> {
    if (Array.isArray(this.details)) {
      return Object.fromEntries((this.details as FieldError[]).map(({ field, message }) => [field, message]));
    }
    const field = (this.details as { field?: unknown } | undefined)?.field;
    return typeof field === 'string' ? { [field]: this.message } : {};
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof UserFacingError) return error.message;
  return UNEXPECTED_ERROR_MESSAGE;
}
