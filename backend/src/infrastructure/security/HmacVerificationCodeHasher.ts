import { createHmac, timingSafeEqual } from 'node:crypto';
import type { VerificationCodeHasher } from '../../application/ports/VerificationCodeHasher.ts';

/**
 * Keyed hash (HMAC-SHA256): a 6-digit code is trivial to brute-force from a plain hash,
 * so a leaked database alone must not reveal pending codes.
 */
export class HmacVerificationCodeHasher implements VerificationCodeHasher {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = createHmac('sha256', secret).update('registration-verification-code').digest();
  }

  hash(code: string): string {
    return createHmac('sha256', this.key).update(code).digest('hex');
  }

  matches(code: string, hash: string): boolean {
    const expected = Buffer.from(hash, 'hex');
    const actual = Buffer.from(this.hash(code), 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
