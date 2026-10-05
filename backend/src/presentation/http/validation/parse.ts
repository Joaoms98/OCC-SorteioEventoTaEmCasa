import { z } from 'zod';
import { HttpError } from '../errors/HttpError.ts';
import { HttpErrorCode } from '../errors/HttpErrorCode.ts';

// Default zod messages in Portuguese; schemas override the important ones with friendlier text.
z.config(z.locales.ptBR());

export interface FieldError {
  field: string;
  message: string;
}

const toFieldErrors = (error: z.ZodError): FieldError[] =>
  error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));

/** Parses a request body or query string, failing with 400 + per-field messages. */
export function parseInput<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    throw new HttpError(400, HttpErrorCode.ValidationError, toFieldErrors(result.error));
  }
  return result.data;
}

/** Path params identify resources, so a malformed id is reported as "not found". */
export function parseParams<S extends z.ZodType>(schema: S, params: unknown): z.output<S> {
  const result = schema.safeParse(params);
  if (!result.success) throw new HttpError(404, HttpErrorCode.ResourceNotFound);
  return result.data;
}
