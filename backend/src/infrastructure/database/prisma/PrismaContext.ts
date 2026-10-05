import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from './generated/client.ts';

export type DatabaseClient = PrismaClient | Prisma.TransactionClient;

const TRANSACTION_TIMEOUT_MS = 15_000;

// Neon's free compute suspends when idle; waking it up can take a few seconds.
const POOL_OPTIONS = { max: 5, connectionTimeoutMillis: 15_000, idleTimeoutMillis: 30_000 };

/**
 * Hands repositories the active transaction client (when inside TransactionManager.run)
 * or the root client otherwise, so use cases never deal with Prisma directly.
 */
export class PrismaContext {
  private readonly transactionStorage = new AsyncLocalStorage<Prisma.TransactionClient>();

  constructor(readonly prisma: PrismaClient) {}

  static connect(databaseUrl: string, onPoolError?: (error: Error) => void): PrismaContext {
    const adapter = new PrismaPg({ connectionString: databaseUrl, ...POOL_OPTIONS }, { onPoolError });
    return new PrismaContext(new PrismaClient({ adapter }));
  }

  get client(): DatabaseClient {
    return this.transactionStorage.getStore() ?? this.prisma;
  }

  runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    if (this.transactionStorage.getStore()) return work();
    return this.prisma.$transaction((transaction) => this.transactionStorage.run(transaction, work), {
      timeout: TRANSACTION_TIMEOUT_MS,
    });
  }

  disconnect(): Promise<void> {
    return this.prisma.$disconnect();
  }
}
