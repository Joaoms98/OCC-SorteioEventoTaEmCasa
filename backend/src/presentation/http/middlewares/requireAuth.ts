import type { RequestHandler } from 'express';
import type { TokenService } from '../../../application/ports/TokenService.ts';
import { HttpError } from '../errors/HttpError.ts';
import { HttpErrorCode } from '../errors/HttpErrorCode.ts';

export function requireAuth(tokens: TokenService): RequestHandler {
  return (req, _res, next) => {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token || !tokens.verify(token)) {
      throw new HttpError(401, HttpErrorCode.Unauthorized);
    }
    next();
  };
}
