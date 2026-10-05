import type { ErrorRequestHandler } from 'express';
import { DomainError, type DomainErrorKind } from '../../../domain/errors/DomainError.ts';
import { HttpError } from '../errors/HttpError.ts';
import { HttpErrorCode } from '../errors/HttpErrorCode.ts';
import { sendError } from '../errors/sendError.ts';
import type { Logger } from '../Logger.ts';

const statusByKind: Record<DomainErrorKind, number> = {
  INVALID_INPUT: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  BUSINESS_RULE: 422,
  UNAVAILABLE: 503,
};

/** body-parser tags its errors with a `type` field. */
function bodyParserErrorType(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'type' in error && typeof error.type === 'string'
    ? error.type
    : undefined;
}

function describeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { error: typeof error };
  const code = 'code' in error ? error.code : undefined;
  // Prisma puts the query (and its arguments) after the first line of the message.
  const message = error.message.split('\n')[0];
  const frames = error.stack?.split('\n').filter((line) => line.trimStart().startsWith('at ')).join('\n');
  return { name: error.name, code, message, stack: frames };
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, next) => {
    if (res.headersSent) return next(error);

    if (error instanceof DomainError) {
      return sendError(res, statusByKind[error.kind], error.code, error.details);
    }
    if (error instanceof HttpError) {
      return sendError(res, error.status, error.code, error.details);
    }

    const parserErrorType = bodyParserErrorType(error);
    if (parserErrorType === 'entity.parse.failed') return sendError(res, 400, HttpErrorCode.InvalidJson);
    if (parserErrorType === 'entity.too.large') return sendError(res, 413, HttpErrorCode.PayloadTooLarge);

    // Only safe fields: database errors may carry query parameters with personal data.
    logger.error('Unhandled error', { method: req.method, path: req.path, ...describeError(error) });
    return sendError(res, 500, HttpErrorCode.InternalError);
  };
}
