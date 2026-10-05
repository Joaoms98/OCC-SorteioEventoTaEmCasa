export interface RandomNumberGenerator {
  /** Uniformly distributed integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
}
