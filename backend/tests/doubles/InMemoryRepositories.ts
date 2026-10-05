import { DrawStatus, type Draw } from '../../src/domain/entities/Draw.ts';
import type { Event } from '../../src/domain/entities/Event.ts';
import type { Participant } from '../../src/domain/entities/Participant.ts';
import type { Prize } from '../../src/domain/entities/Prize.ts';
import { RegistrationVerification } from '../../src/domain/entities/RegistrationVerification.ts';
import { ConflictError } from '../../src/domain/errors/DomainError.ts';
import { ErrorCode } from '../../src/domain/errors/ErrorCode.ts';
import type { DrawDetails, DrawRepository } from '../../src/domain/repositories/DrawRepository.ts';
import type { EventPrizeStock, EventRepository } from '../../src/domain/repositories/EventRepository.ts';
import type { Page } from '../../src/domain/repositories/Pagination.ts';
import type {
  ParticipantContacts,
  ParticipantRepository,
  ParticipantSearch,
} from '../../src/domain/repositories/ParticipantRepository.ts';
import type { PrizeImageRepository } from '../../src/domain/repositories/PrizeImageRepository.ts';
import type { PrizeRepository } from '../../src/domain/repositories/PrizeRepository.ts';
import type { RegistrationVerificationRepository } from '../../src/domain/repositories/RegistrationVerificationRepository.ts';
import type { PrizeImage } from '../../src/domain/value-objects/PrizeImage.ts';
import { copyDraw, copyEvent, copyParticipant, copyPrize, type InMemoryDatabase } from './InMemoryDatabase.ts';

const byCreation = <T extends { createdAt: Date; id: string }>(a: T, b: T) =>
  a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);

export class InMemoryEventRepository implements EventRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  async findById(id: string): Promise<Event | null> {
    const event = this.db.events.get(id);
    return event ? copyEvent(event) : null;
  }

  findByIdForUpdate(id: string): Promise<Event | null> {
    return this.findById(id);
  }

  async findAll(): Promise<Event[]> {
    return [...this.db.events.values()].map(copyEvent);
  }

  async findAllWithPrizeStock(): Promise<EventPrizeStock[]> {
    const ofEvent = <T extends { eventId: string }>(items: Map<string, T>, eventId: string) =>
      [...items.values()].filter((item) => item.eventId === eventId);
    return [...this.db.events.values()].map((event) => ({
      event: copyEvent(event),
      prizeUnits: ofEvent(this.db.prizes, event.id).reduce((sum, prize) => sum + prize.quantity, 0),
      drawnUnits: ofEvent(this.db.draws, event.id).filter((draw) => draw.status === DrawStatus.Confirmed).length,
    }));
  }

  async create(event: Event): Promise<void> {
    this.db.events.set(event.id, copyEvent(event));
  }

  async update(event: Event): Promise<void> {
    this.db.events.set(event.id, copyEvent(event));
  }

  async delete(id: string): Promise<void> {
    this.db.events.delete(id);
    for (const map of [this.db.draws, this.db.participants, this.db.prizes]) {
      for (const [key, entity] of map) if (entity.eventId === id) map.delete(key);
    }
  }
}

export class InMemoryParticipantRepository implements ParticipantRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  private ofEvent(eventId: string): Participant[] {
    return [...this.db.participants.values()].filter((participant) => participant.eventId === eventId);
  }

  private eligible(eventId: string): Participant[] {
    const drawn = new Set([...this.db.draws.values()].map((draw) => draw.participantId));
    return this.ofEvent(eventId)
      .filter((participant) => !drawn.has(participant.id))
      .sort(byCreation);
  }

  private isTaken(participant: Participant): boolean {
    return this.ofEvent(participant.eventId).some(
      (other) =>
        (participant.phone && other.phone === participant.phone) ||
        (participant.email && other.email === participant.email),
    );
  }

  async findById(id: string): Promise<Participant | null> {
    const participant = this.db.participants.get(id);
    return participant ? copyParticipant(participant) : null;
  }

  async findTakenContacts(eventId: string, contacts: ParticipantContacts): Promise<ParticipantContacts> {
    const participants = this.ofEvent(eventId);
    return {
      phones: contacts.phones.filter((phone) => participants.some((participant) => participant.phone === phone)),
      emails: contacts.emails.filter((email) => participants.some((participant) => participant.email === email)),
    };
  }

  async list(eventId: string, query: ParticipantSearch): Promise<Page<Participant>> {
    const search = query.search?.toLowerCase();
    const matches = this.ofEvent(eventId)
      .filter((participant) => !search || participant.name.toLowerCase().includes(search))
      .sort((a, b) => a.name.localeCompare(b.name));
    const start = (query.page - 1) * query.pageSize;
    return {
      items: matches.slice(start, start + query.pageSize).map(copyParticipant),
      total: matches.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async countByEvent(eventId: string): Promise<number> {
    return this.ofEvent(eventId).length;
  }

  async countEligibleForDraw(eventId: string): Promise<number> {
    return this.eligible(eventId).length;
  }

  async findEligibleForDrawAt(eventId: string, position: number): Promise<Participant | null> {
    const participant = this.eligible(eventId)[position];
    return participant ? copyParticipant(participant) : null;
  }

  async sampleEligibleNames(eventId: string, limit: number): Promise<string[]> {
    return this.eligible(eventId)
      .slice(0, limit)
      .map((participant) => participant.name);
  }

  async create(participant: Participant): Promise<void> {
    if (this.isTaken(participant)) throw new ConflictError(ErrorCode.ParticipantAlreadyRegistered);
    this.db.participants.set(participant.id, copyParticipant(participant));
  }

  async createMany(participants: Participant[]): Promise<number> {
    let created = 0;
    for (const participant of participants) {
      if (this.isTaken(participant)) continue;
      this.db.participants.set(participant.id, copyParticipant(participant));
      created += 1;
    }
    return created;
  }

  async delete(id: string): Promise<void> {
    this.db.participants.delete(id);
  }
}

export class InMemoryPrizeRepository implements PrizeRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  async findById(id: string): Promise<Prize | null> {
    const prize = this.db.prizes.get(id);
    return prize ? copyPrize(prize) : null;
  }

  async findByEvent(eventId: string): Promise<Prize[]> {
    return [...this.db.prizes.values()]
      .filter((prize) => prize.eventId === eventId)
      .sort(byCreation)
      .map(copyPrize);
  }

  async create(prize: Prize): Promise<void> {
    this.db.prizes.set(prize.id, copyPrize(prize));
  }

  async update(prize: Prize): Promise<void> {
    this.db.prizes.set(prize.id, copyPrize(prize));
  }

  async delete(id: string): Promise<void> {
    this.db.prizes.delete(id);
  }
}

export class InMemoryDrawRepository implements DrawRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  private all(): Draw[] {
    return [...this.db.draws.values()];
  }

  private toDetails(draw: Draw): DrawDetails {
    const participant = this.db.participants.get(draw.participantId);
    const prize = this.db.prizes.get(draw.prizeId);
    if (!participant || !prize) throw new Error('Inconsistent in-memory database');
    return {
      draw: copyDraw(draw),
      participant: { id: participant.id, name: participant.name, phone: participant.phone, email: participant.email },
      prize: { id: prize.id, name: prize.name },
    };
  }

  async findById(id: string): Promise<Draw | null> {
    const draw = this.db.draws.get(id);
    return draw ? copyDraw(draw) : null;
  }

  async findDetailsById(id: string): Promise<DrawDetails | null> {
    const draw = this.db.draws.get(id);
    return draw ? this.toDetails(draw) : null;
  }

  async findDetailsByEvent(eventId: string): Promise<DrawDetails[]> {
    return this.all()
      .filter((draw) => draw.eventId === eventId)
      .sort((a, b) => b.drawnAt.getTime() - a.drawnAt.getTime() || b.id.localeCompare(a.id))
      .map((draw) => this.toDetails(draw));
  }

  async existsByPrize(prizeId: string): Promise<boolean> {
    return this.all().some((draw) => draw.prizeId === prizeId);
  }

  async existsByParticipant(participantId: string): Promise<boolean> {
    return this.all().some((draw) => draw.participantId === participantId);
  }

  async countConfirmedByPrize(prizeId: string): Promise<number> {
    return this.all().filter((draw) => draw.prizeId === prizeId && draw.status === DrawStatus.Confirmed).length;
  }

  async countConfirmedByEventGroupedByPrize(eventId: string): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const draw of this.all()) {
      if (draw.eventId !== eventId || draw.status !== DrawStatus.Confirmed) continue;
      counts.set(draw.prizeId, (counts.get(draw.prizeId) ?? 0) + 1);
    }
    return counts;
  }

  async create(draw: Draw): Promise<void> {
    const alreadyDrawn = this.all().some(
      (other) => other.eventId === draw.eventId && other.participantId === draw.participantId,
    );
    if (alreadyDrawn) throw new ConflictError(ErrorCode.DrawConflict);
    this.db.draws.set(draw.id, copyDraw(draw));
  }

  async update(draw: Draw): Promise<void> {
    this.db.draws.set(draw.id, copyDraw(draw));
  }
}

export class InMemoryPrizeImageRepository implements PrizeImageRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  async findByPrizeId(prizeId: string): Promise<PrizeImage | null> {
    return this.db.prizes.has(prizeId) ? (this.db.prizeImages.get(prizeId) ?? null) : null;
  }

  async save(prizeId: string, image: PrizeImage): Promise<void> {
    this.db.prizeImages.set(prizeId, image);
  }

  async delete(prizeId: string): Promise<void> {
    this.db.prizeImages.delete(prizeId);
  }
}

const copyVerification = (verification: RegistrationVerification): RegistrationVerification =>
  RegistrationVerification.restore({
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

export class InMemoryRegistrationVerificationRepository implements RegistrationVerificationRepository {
  readonly items = new Map<string, RegistrationVerification>();

  async findById(id: string): Promise<RegistrationVerification | null> {
    const verification = this.items.get(id);
    return verification ? copyVerification(verification) : null;
  }

  async countStartedForEmailSince(email: string, since: Date): Promise<number> {
    return [...this.items.values()].filter((v) => v.email === email && v.createdAt >= since).length;
  }

  async create(verification: RegistrationVerification): Promise<void> {
    this.items.set(verification.id, copyVerification(verification));
  }

  async update(verification: RegistrationVerification): Promise<void> {
    this.items.set(verification.id, copyVerification(verification));
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }

  async deleteExpiredBefore(instant: Date): Promise<void> {
    for (const [id, verification] of this.items) if (verification.expiresAt < instant) this.items.delete(id);
  }
}
