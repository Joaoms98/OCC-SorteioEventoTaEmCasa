import { RegistrationVerification } from '../../../../domain/entities/RegistrationVerification.ts';
import type { RegistrationVerificationRepository } from '../../../../domain/repositories/RegistrationVerificationRepository.ts';
import type { RegistrationVerification as Row } from '../generated/client.ts';
import type { PrismaContext } from '../PrismaContext.ts';

const toDomain = (row: Row): RegistrationVerification =>
  RegistrationVerification.restore({
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    phone: row.phone,
    email: row.email,
    codeHash: row.codeHash,
    attempts: row.attempts,
    sendCount: row.sendCount,
    lastSentAt: row.lastSentAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  });

const toPersistence = (verification: RegistrationVerification) => ({
  id: verification.id,
  eventId: verification.eventId,
  name: verification.name,
  phone: verification.phone,
  email: verification.email,
  codeHash: verification.codeHash,
  attempts: verification.attempts,
  sendCount: verification.sendCount,
  lastSentAt: verification.lastSentAt,
  expiresAt: verification.expiresAt,
  createdAt: verification.createdAt,
});

export class PrismaRegistrationVerificationRepository implements RegistrationVerificationRepository {
  constructor(private readonly context: PrismaContext) {}

  async findById(id: string): Promise<RegistrationVerification | null> {
    const row = await this.context.client.registrationVerification.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  countStartedForEmailSince(email: string, since: Date): Promise<number> {
    return this.context.client.registrationVerification.count({ where: { email, createdAt: { gte: since } } });
  }

  async create(verification: RegistrationVerification): Promise<void> {
    await this.context.client.registrationVerification.create({ data: toPersistence(verification) });
  }

  async update(verification: RegistrationVerification): Promise<void> {
    const { id, ...data } = toPersistence(verification);
    await this.context.client.registrationVerification.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.context.client.registrationVerification.deleteMany({ where: { id } });
  }

  async deleteExpiredBefore(instant: Date): Promise<void> {
    await this.context.client.registrationVerification.deleteMany({ where: { expiresAt: { lt: instant } } });
  }
}
