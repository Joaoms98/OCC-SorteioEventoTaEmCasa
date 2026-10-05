import { Participant } from '../../../../domain/entities/Participant.ts';
import { ConflictError } from '../../../../domain/errors/DomainError.ts';
import { ErrorCode } from '../../../../domain/errors/ErrorCode.ts';
import type { Page } from '../../../../domain/repositories/Pagination.ts';
import type {
  ParticipantContacts,
  ParticipantRepository,
  ParticipantSearch,
} from '../../../../domain/repositories/ParticipantRepository.ts';
import type { Prisma, Participant as ParticipantRow } from '../generated/client.ts';
import type { PrismaContext } from '../PrismaContext.ts';
import { isForeignKeyViolation, isUniqueConstraintViolation } from '../prismaErrors.ts';

const toDomain = (row: ParticipantRow): Participant =>
  Participant.restore({
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    phone: row.phone,
    email: row.email,
    createdAt: row.createdAt,
  });

const toPersistence = (participant: Participant) => ({
  id: participant.id,
  eventId: participant.eventId,
  name: participant.name,
  phone: participant.phone,
  email: participant.email,
  createdAt: participant.createdAt,
});

const eligibleWhere = (eventId: string): Prisma.ParticipantWhereInput => ({ eventId, draws: { none: {} } });

// Stable ordering is required so a random position always maps to the same participant.
const stableOrder: Prisma.ParticipantOrderByWithRelationInput[] = [{ createdAt: 'asc' }, { id: 'asc' }];

export class PrismaParticipantRepository implements ParticipantRepository {
  constructor(private readonly context: PrismaContext) {}

  async findById(id: string): Promise<Participant | null> {
    const row = await this.context.client.participant.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findTakenContacts(eventId: string, contacts: ParticipantContacts): Promise<ParticipantContacts> {
    if (contacts.phones.length === 0 && contacts.emails.length === 0) return { phones: [], emails: [] };

    const rows = await this.context.client.participant.findMany({
      where: { eventId, OR: [{ phone: { in: contacts.phones } }, { email: { in: contacts.emails } }] },
      select: { phone: true, email: true },
    });
    const phones = new Set(contacts.phones);
    const emails = new Set(contacts.emails);
    return {
      phones: rows.flatMap((row) => (row.phone && phones.has(row.phone) ? [row.phone] : [])),
      emails: rows.flatMap((row) => (row.email && emails.has(row.email) ? [row.email] : [])),
    };
  }

  async list(eventId: string, query: ParticipantSearch): Promise<Page<Participant>> {
    const where: Prisma.ParticipantWhereInput = { eventId };
    if (query.search) {
      const digits = query.search.replace(/\D/g, '');
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        ...(digits ? [{ phone: { contains: digits } }] : []),
      ];
    }

    const [rows, total] = await Promise.all([
      this.context.client.participant.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.context.client.participant.count({ where }),
    ]);
    return { items: rows.map(toDomain), total, page: query.page, pageSize: query.pageSize };
  }

  countByEvent(eventId: string): Promise<number> {
    return this.context.client.participant.count({ where: { eventId } });
  }

  countEligibleForDraw(eventId: string): Promise<number> {
    return this.context.client.participant.count({ where: eligibleWhere(eventId) });
  }

  async findEligibleForDrawAt(eventId: string, position: number): Promise<Participant | null> {
    const row = await this.context.client.participant.findFirst({
      where: eligibleWhere(eventId),
      orderBy: stableOrder,
      skip: position,
    });
    return row ? toDomain(row) : null;
  }

  async sampleEligibleNames(eventId: string, limit: number): Promise<string[]> {
    const rows = await this.context.client.$queryRaw<Array<{ name: string }>>`
      SELECT p."name" FROM "participants" p
      WHERE p."event_id" = ${eventId}::uuid
        AND NOT EXISTS (SELECT 1 FROM "draws" d WHERE d."participant_id" = p."id")
      ORDER BY random()
      LIMIT ${limit}`;
    return rows.map((row) => row.name);
  }

  async create(participant: Participant): Promise<void> {
    try {
      await this.context.client.participant.create({ data: toPersistence(participant) });
    } catch (error) {
      // A concurrent registration with the same contact won the race.
      if (isUniqueConstraintViolation(error)) throw new ConflictError(ErrorCode.ParticipantAlreadyRegistered);
      throw error;
    }
  }

  async createMany(participants: Participant[]): Promise<number> {
    const result = await this.context.client.participant.createMany({
      data: participants.map(toPersistence),
      skipDuplicates: true,
    });
    return result.count;
  }

  async delete(id: string): Promise<void> {
    try {
      await this.context.client.participant.delete({ where: { id } });
    } catch (error) {
      if (isForeignKeyViolation(error)) throw new ConflictError(ErrorCode.ParticipantHasDraw);
      throw error;
    }
  }
}
