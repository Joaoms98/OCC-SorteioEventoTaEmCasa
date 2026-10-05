import type { Draw } from '../entities/Draw.ts';

export interface DrawDetails {
  draw: Draw;
  participant: { id: string; name: string; phone: string | null; email: string | null };
  prize: { id: string; name: string };
}

export interface DrawRepository {
  findById(id: string): Promise<Draw | null>;
  findDetailsById(id: string): Promise<DrawDetails | null>;
  findDetailsByEvent(eventId: string): Promise<DrawDetails[]>;
  existsByPrize(prizeId: string): Promise<boolean>;
  existsByParticipant(participantId: string): Promise<boolean>;
  countConfirmedByPrize(prizeId: string): Promise<number>;
  /** Map of prizeId -> confirmed draws for every prize of the event that has at least one. */
  countConfirmedByEventGroupedByPrize(eventId: string): Promise<Map<string, number>>;
  create(draw: Draw): Promise<void>;
  update(draw: Draw): Promise<void>;
}
