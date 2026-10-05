import { UnauthorizedError } from '../../../domain/errors/DomainError.ts';
import { ErrorCode } from '../../../domain/errors/ErrorCode.ts';
import type { PasswordVerifier } from '../../ports/PasswordVerifier.ts';
import type { AccessToken, TokenService } from '../../ports/TokenService.ts';

export const ADMIN_SUBJECT = 'admin';

export interface AuthenticateAdminInput {
  password: string;
}

export class AuthenticateAdmin {
  constructor(
    private readonly passwordVerifier: PasswordVerifier,
    private readonly tokens: TokenService,
  ) {}

  async execute(input: AuthenticateAdminInput): Promise<AccessToken> {
    if (!this.passwordVerifier.verify(input.password)) {
      throw new UnauthorizedError(ErrorCode.InvalidCredentials);
    }
    return this.tokens.issue(ADMIN_SUBJECT);
  }
}
