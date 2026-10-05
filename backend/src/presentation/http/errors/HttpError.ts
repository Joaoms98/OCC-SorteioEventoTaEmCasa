import type { HttpErrorCode } from './HttpErrorCode.ts';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: HttpErrorCode,
    readonly details?: unknown,
  ) {
    super(code);
    this.name = 'HttpError';
  }
}
