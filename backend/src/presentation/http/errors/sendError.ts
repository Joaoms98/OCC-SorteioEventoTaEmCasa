import type { Response } from 'express';
import { translateError, type ApiErrorCode } from './errorMessages.ts';

export interface ErrorResponseBody {
  error: { code: ApiErrorCode; message: string; details?: unknown };
}

export function sendError(res: Response, status: number, code: ApiErrorCode, details?: unknown): void {
  const message = translateError(code, isRecord(details) ? details : {});
  const body: ErrorResponseBody = { error: { code, message, ...(details === undefined ? {} : { details }) } };
  res.status(status).json(body);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
