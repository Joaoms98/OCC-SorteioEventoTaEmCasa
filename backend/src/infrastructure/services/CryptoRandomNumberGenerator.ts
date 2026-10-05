import { randomInt } from 'node:crypto';
import type { RandomNumberGenerator } from '../../application/ports/RandomNumberGenerator.ts';

export class CryptoRandomNumberGenerator implements RandomNumberGenerator {
  nextInt(maxExclusive: number): number {
    return randomInt(maxExclusive);
  }
}
