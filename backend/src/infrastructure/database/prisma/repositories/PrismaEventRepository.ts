import { DrawStatus } from '../../../../domain/entities/Draw.ts';
import { Event } from '../../../../domain/entities/Event.ts';
import type { EventPrizeStock, EventRepository } from '../../../../domain/repositories/EventRepository.ts';
import type { Event as EventRow } from '../generated/client.ts';
import type { PrismaContext } from '../PrismaContext.ts';

const toDomain = (row: EventRow): Event =>
  Event.restore({
    id: row.id,
    name: row.name,
    description: row.description,
    eventDate: row.eventDate,
    registrationOpen: row.registrationOpen,
    drawMode: row.drawMode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

const toPersistence = (event: Event) => ({
  id: event.id,
  name: event.name,
  description: event.description,
  eventDate: event.eventDate,
  registrationOpen: event.registrationOpen,
  drawMode: event.drawMode,
  createdAt: event.createdAt,
  updatedAt: event.updatedAt,
});

export class PrismaEventRepository implements EventRepository {
  constructor(private readonly context: PrismaContext) {}

  async findById(id: string): Promise<Event | null> {
    const row = await this.context.client.event.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByIdForUpdate(id: string): Promise<Event | null> {
    await this.context.client.$executeRaw`SELECT 1 FROM "events" WHERE "id" = ${id}::uuid FOR UPDATE`;
    return this.findById(id);
  }

  async findAll(): Promise<Event[]> {
    const rows = await this.context.client.event.findMany({
      orderBy: [{ eventDate: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    });
    return rows.map(toDomain);
  }

  async findAllWithPrizeStock(): Promise<EventPrizeStock[]> {
    const rows = await this.context.client.event.findMany({
      include: {
        prizes: { select: { quantity: true } },
        _count: { select: { draws: { where: { status: DrawStatus.Confirmed } } } },
      },
    });
    return rows.map(({ prizes, _count, ...row }) => ({
      event: toDomain(row),
      prizeUnits: prizes.reduce((sum, prize) => sum + prize.quantity, 0),
      drawnUnits: _count.draws,
    }));
  }

  async create(event: Event): Promise<void> {
    await this.context.client.event.create({ data: toPersistence(event) });
  }

  async update(event: Event): Promise<void> {
    const { id, ...data } = toPersistence(event);
    await this.context.client.event.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.context.client.event.delete({ where: { id } });
  }
}
