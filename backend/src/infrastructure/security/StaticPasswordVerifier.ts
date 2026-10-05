import { createHash, timingSafeEqual } from 'node:crypto';
import type { PasswordVerifier } from '../../application/ports/PasswordVerifier.ts';

const digest = (value: string): Buffer => createHash('sha256').update(value, 'utf8').digest();

/** Compares against the admin password from the environment in constant time. */
export class StaticPasswordVerifier implements PasswordVerifier {
  private readonly expectedDigest: Buffer;

  constructor(expectedPassword: string) {
    this.expectedDigest = digest(expectedPassword);
  }

  verify(password: string): boolean {
    return timingSafeEqual(digest(password), this.expectedDigest);
  }
}
