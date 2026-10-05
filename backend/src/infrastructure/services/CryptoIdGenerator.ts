import { randomUUID } from 'node:crypto';
import type { IdGenerator } from '../../application/ports/IdGenerator.ts';

export class CryptoIdGenerator implements IdGenerator {
  generate(): string {
    return randomUUID();
  }
}
