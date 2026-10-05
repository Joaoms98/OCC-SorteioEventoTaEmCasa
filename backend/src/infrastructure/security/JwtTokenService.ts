import jwt from 'jsonwebtoken';
import type { AccessToken, TokenPayload, TokenService } from '../../application/ports/TokenService.ts';

const ALGORITHM = 'HS256';

export class JwtTokenService implements TokenService {
  constructor(
    private readonly secret: string,
    private readonly expiresInSeconds: number,
  ) {}

  issue(subject: string): AccessToken {
    const token = jwt.sign({}, this.secret, { algorithm: ALGORITHM, subject, expiresIn: this.expiresInSeconds });
    return { token, expiresInSeconds: this.expiresInSeconds };
  }

  verify(token: string): TokenPayload | null {
    try {
      const payload = jwt.verify(token, this.secret, { algorithms: [ALGORITHM] });
      return typeof payload === 'object' && typeof payload.sub === 'string' ? { subject: payload.sub } : null;
    } catch {
      return null;
    }
  }
}
