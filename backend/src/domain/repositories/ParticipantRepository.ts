import type { Participant } from '../entities/Participant.ts';
import type { Page, PageRequest } from './Pagination.ts';

export interface ParticipantContacts {
  phones: string[];
  emails: string[];
}

export interface ParticipantSearch extends PageRequest {
  search?: string;
}

export interface ParticipantRepository {
  findById(id: string): Promise<Participant | null>;
  /** Returns which of the given phones/emails are already registered in the event. */
  findTakenContacts(eventId: string, contacts: ParticipantContacts): Promise<ParticipantContacts>;
  list(eventId: string, query: ParticipantSearch): Promise<Page<Participant>>;
  countByEvent(eventId: string): Promise<number>;
  /** Participants of the event that were never drawn (confirmed or voided). */
  countEligibleForDraw(eventId: string): Promise<number>;
  /** Eligible participant at a zero-based position of a stable ordering. */
  findEligibleForDrawAt(eventId: string, position: number): Promise<Participant | null>;
  /** Random names among the eligible participants (used by the live rolling animation). */
  sampleEligibleNames(eventId: string, limit: number): Promise<string[]>;
  create(participant: Participant): Promise<void>;
  /** Inserts the batch ignoring contact duplicates; returns how many rows were inserted. */
  createMany(participants: Participant[]): Promise<number>;
  delete(id: string): Promise<void>;
}
