import { Draw, DrawStatus } from '../../../../domain/entities/Draw.ts';
import { ConflictError } from '../../../../domain/errors/DomainError.ts';
import { ErrorCode } from '../../../../domain/errors/ErrorCode.ts';
import type { DrawDetails, DrawRepository } from '../../../../domain/repositories/DrawRepository.ts';
import type { Draw as DrawRow, Prisma } from '../generated/client.ts';
import type { PrismaContext } from '../PrismaContext.ts';
import { isUniqueConstraintViolation } from '../prismaErrors.ts';

const detailsInclude = {
  participant: { select: { id: true, name: true, phone: true, email: true } },
  prize: { select: { id: true, name: true } },
} satisfies Prisma.DrawInclude;

type DrawWithDetailsRow = Prisma.DrawGetPayload<{ include: typeof detailsInclude }>;

const toDomain = (row: DrawRow): Draw =>
  Draw.restore({
    id: row.id,
    eventId: row.eventId,
    prizeId: row.prizeId,
    participantId: row.participantId,
    status: row.status,
    drawnAt: row.drawnAt,
    voidedAt: row.voidedAt,
    claimedAt: row.claimedAt,
  });

const toDetails = (row: DrawWithDetailsRow): DrawDetails => ({
  draw: toDomain(row),
  participant: row.participant,
  prize: row.prize,
});

const toPersistence = (draw: Draw) => ({
  id: draw.id,
  eventId: draw.eventId,
  prizeId: draw.prizeId,
  participantId: draw.participantId,
  status: draw.status,
  drawnAt: draw.drawnAt,
  voidedAt: draw.voidedAt,
  claimedAt: draw.claimedAt,
});

export class PrismaDrawRepository implements DrawRepository {
  constructor(private readonly context: PrismaContext) {}

  async findById(id: string): Promise<Draw | null> {
    const row = await this.context.client.draw.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findDetailsById(id: string): Promise<DrawDetails | null> {
    const row = await this.context.client.draw.findUnique({ where: { id }, include: detailsInclude });
    return row ? toDetails(row) : null;
  }

  async findDetailsByEvent(eventId: string): Promise<DrawDetails[]> {
    const rows = await this.context.client.draw.findMany({
      where: { eventId },
      include: detailsInclude,
      orderBy: [{ drawnAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toDetails);
  }

  async existsByPrize(prizeId: string): Promise<boolean> {
    return (await this.context.client.draw.count({ where: { prizeId }, take: 1 })) > 0;
  }

  async existsByParticipant(participantId: string): Promise<boolean> {
    return (await this.context.client.draw.count({ where: { participantId }, take: 1 })) > 0;
  }

  countConfirmedByPrize(prizeId: string): Promise<number> {
    return this.context.client.draw.count({ where: { prizeId, status: DrawStatus.Confirmed } });
  }

  async countConfirmedByEventGroupedByPrize(eventId: string): Promise<Map<string, number>> {
    const groups = await this.context.client.draw.groupBy({
      by: ['prizeId'],
      where: { eventId, status: DrawStatus.Confirmed },
      _count: { _all: true },
    });
    return new Map(groups.map((group) => [group.prizeId, group._count._all]));
  }

  async create(draw: Draw): Promise<void> {
    try {
      await this.context.client.draw.create({ data: toPersistence(draw) });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) throw new ConflictError(ErrorCode.DrawConflict);
      throw error;
    }
  }

  async update(draw: Draw): Promise<void> {
    const { id, ...data } = toPersistence(draw);
    await this.context.client.draw.update({ where: { id }, data });
  }
}
