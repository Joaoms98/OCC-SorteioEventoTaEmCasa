import type { RegistrationVerification } from '../entities/RegistrationVerification.ts';

export interface RegistrationVerificationRepository {
  findById(id: string): Promise<RegistrationVerification | null>;
  /** How many registrations were started for this e-mail since the given instant (anti-spam). */
  countStartedForEmailSince(email: string, since: Date): Promise<number>;
  create(verification: RegistrationVerification): Promise<void>;
  update(verification: RegistrationVerification): Promise<void>;
  delete(id: string): Promise<void>;
  /** Housekeeping: drops verifications that expired before the given instant. */
  deleteExpiredBefore(instant: Date): Promise<void>;
}
