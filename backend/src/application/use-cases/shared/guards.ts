import type { Draw } from '../../../domain/entities/Draw.ts';
import type { Event } from '../../../domain/entities/Event.ts';
import type { Participant } from '../../../domain/entities/Participant.ts';
import type { Prize } from '../../../domain/entities/Prize.ts';
import { NotFoundError } from '../../../domain/errors/DomainError.ts';
import { ErrorCode } from '../../../domain/errors/ErrorCode.ts';
import type { DrawRepository } from '../../../domain/repositories/DrawRepository.ts';
import type { EventRepository } from '../../../domain/repositories/EventRepository.ts';
import type { ParticipantRepository } from '../../../domain/repositories/ParticipantRepository.ts';
import type { PrizeRepository } from '../../../domain/repositories/PrizeRepository.ts';

export async function requireEvent(
  events: EventRepository,
  eventId: string,
  options: { lock?: boolean } = {},
): Promise<Event> {
  const event = options.lock ? await events.findByIdForUpdate(eventId) : await events.findById(eventId);
  if (!event) throw new NotFoundError(ErrorCode.EventNotFound);
  return event;
}

export async function requirePrizeOfEvent(prizes: PrizeRepository, eventId: string, prizeId: string): Promise<Prize> {
  const prize = await prizes.findById(prizeId);
  if (!prize?.belongsTo(eventId)) throw new NotFoundError(ErrorCode.PrizeNotFound);
  return prize;
}

export async function requireParticipantOfEvent(
  participants: ParticipantRepository,
  eventId: string,
  participantId: string,
): Promise<Participant> {
  const participant = await participants.findById(participantId);
  if (!participant?.belongsTo(eventId)) throw new NotFoundError(ErrorCode.ParticipantNotFound);
  return participant;
}

export async function requireDrawOfEvent(draws: DrawRepository, eventId: string, drawId: string): Promise<Draw> {
  const draw = await draws.findById(drawId);
  if (!draw?.belongsTo(eventId)) throw new NotFoundError(ErrorCode.DrawNotFound);
  return draw;
}
