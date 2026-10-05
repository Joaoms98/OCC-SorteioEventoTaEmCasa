import { Prize } from '../../../../domain/entities/Prize.ts';
import { ConflictError } from '../../../../domain/errors/DomainError.ts';
import { ErrorCode } from '../../../../domain/errors/ErrorCode.ts';
import type { PrizeRepository } from '../../../../domain/repositories/PrizeRepository.ts';
import type { Prize as PrizeRow } from '../generated/client.ts';
import type { PrismaContext } from '../PrismaContext.ts';
import { isForeignKeyViolation } from '../prismaErrors.ts';

const toDomain = (row: PrizeRow): Prize =>
  Prize.restore({
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    description: row.description,
    quantity: row.quantity,
    imageUpdatedAt: row.imageUpdatedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

const toPersistence = (prize: Prize) => ({
  id: prize.id,
  eventId: prize.eventId,
  name: prize.name,
  description: prize.description,
  quantity: prize.quantity,
  imageUpdatedAt: prize.imageUpdatedAt,
  createdAt: prize.createdAt,
  updatedAt: prize.updatedAt,
});

export class PrismaPrizeRepository implements PrizeRepository {
  constructor(private readonly context: PrismaContext) {}

  async findById(id: string): Promise<Prize | null> {
    const row = await this.context.client.prize.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByEvent(eventId: string): Promise<Prize[]> {
    const rows = await this.context.client.prize.findMany({
      where: { eventId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toDomain);
  }

  async create(prize: Prize): Promise<void> {
    await this.context.client.prize.create({ data: toPersistence(prize) });
  }

  async update(prize: Prize): Promise<void> {
    const { id, ...data } = toPersistence(prize);
    await this.context.client.prize.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    try {
      await this.context.client.prize.delete({ where: { id } });
    } catch (error) {
      if (isForeignKeyViolation(error)) throw new ConflictError(ErrorCode.PrizeHasDraws);
      throw error;
    }
  }
}
