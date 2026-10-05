export interface VerificationCodeHasher {
  hash(code: string): string;
  /** Constant-time comparison. */
  matches(code: string, hash: string): boolean;
}
