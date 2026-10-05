export interface TransactionManager {
  /** Runs the work atomically; repositories called inside it share the same transaction. */
  run<T>(work: () => Promise<T>): Promise<T>;
}
