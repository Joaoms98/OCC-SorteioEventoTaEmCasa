import type { Prize } from '../entities/Prize.ts';

export interface PrizeRepository {
  findById(id: string): Promise<Prize | null>;
  findByEvent(eventId: string): Promise<Prize[]>;
  create(prize: Prize): Promise<void>;
  update(prize: Prize): Promise<void>;
  delete(id: string): Promise<void>;
}
