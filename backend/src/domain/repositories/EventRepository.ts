import type { Event } from '../entities/Event.ts';

export interface EventPrizeStock {
  event: Event;
  /** Sum of the quantities of the event's prizes. */
  prizeUnits: number;
  /** Units already drawn (confirmed draws). */
  drawnUnits: number;
}

export interface EventRepository {
  findById(id: string): Promise<Event | null>;
  /** Same as findById, but locks the event until the current transaction ends (serializes draws). */
  findByIdForUpdate(id: string): Promise<Event | null>;
  findAll(): Promise<Event[]>;
  /** Every event with its prize stock, in a single round trip (public home page). */
  findAllWithPrizeStock(): Promise<EventPrizeStock[]>;
  create(event: Event): Promise<void>;
  update(event: Event): Promise<void>;
  delete(id: string): Promise<void>;
}
