import type { TransactionManager } from '../../../application/ports/TransactionManager.ts';
import type { PrismaContext } from './PrismaContext.ts';

export class PrismaTransactionManager implements TransactionManager {
  constructor(private readonly context: PrismaContext) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    return this.context.runInTransaction(work);
  }
}
