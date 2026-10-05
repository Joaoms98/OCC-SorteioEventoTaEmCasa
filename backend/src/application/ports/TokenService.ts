export interface AccessToken {
  token: string;
  expiresInSeconds: number;
}

export interface TokenPayload {
  subject: string;
}

export interface TokenService {
  issue(subject: string): AccessToken;
  /** Returns null when the token is malformed, tampered with or expired. */
  verify(token: string): TokenPayload | null;
}
