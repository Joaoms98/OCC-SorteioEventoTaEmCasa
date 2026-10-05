import { Draw } from '../../src/domain/entities/Draw.ts';
import { Event } from '../../src/domain/entities/Event.ts';
import { Participant } from '../../src/domain/entities/Participant.ts';
import { Prize } from '../../src/domain/entities/Prize.ts';
import type { PrizeImage } from '../../src/domain/value-objects/PrizeImage.ts';

/**
 * Stores copies of entities, like a real database would: a use case that forgets to call
 * `repository.update()` will not see its changes persisted.
 */
export class InMemoryDatabase {
  readonly events = new Map<string, Event>();
  readonly participants = new Map<string, Participant>();
  readonly prizes = new Map<string, Prize>();
  readonly draws = new Map<string, Draw>();
  readonly prizeImages = new Map<string, PrizeImage>();
}

export const copyEvent = (event: Event): Event =>
  Event.restore({
    id: event.id,
    name: event.name,
    description: event.description,
    eventDate: event.eventDate,
    registrationOpen: event.registrationOpen,
    drawMode: event.drawMode,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  });

export const copyParticipant = (participant: Participant): Participant =>
  Participant.restore({
    id: participant.id,
    eventId: participant.eventId,
    name: participant.name,
    phone: participant.phone,
    email: participant.email,
    createdAt: participant.createdAt,
  });

export const copyPrize = (prize: Prize): Prize =>
  Prize.restore({
    id: prize.id,
    eventId: prize.eventId,
    name: prize.name,
    description: prize.description,
    quantity: prize.quantity,
    imageUpdatedAt: prize.imageUpdatedAt,
    createdAt: prize.createdAt,
    updatedAt: prize.updatedAt,
  });

export const copyDraw = (draw: Draw): Draw =>
  Draw.restore({
    id: draw.id,
    eventId: draw.eventId,
    prizeId: draw.prizeId,
    participantId: draw.participantId,
    status: draw.status,
    drawnAt: draw.drawnAt,
    voidedAt: draw.voidedAt,
    claimedAt: draw.claimedAt,
  });
