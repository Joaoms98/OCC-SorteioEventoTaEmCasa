import type { Event } from '../../../domain/entities/Event.ts';
import type { EventRepository } from '../../../domain/repositories/EventRepository.ts';

export interface ActiveEvent {
  event: Event;
  /** Prize units still to be drawn. */
  remainingUnits: number;
}

/**
 * Public home page: the events the audience can still take part in, i.e. open for registration
 * or with prizes left to draw. Finished events and empty drafts are not listed.
 */
export class ListActiveEvents {
  constructor(private readonly events: EventRepository) {}

  async execute(): Promise<ActiveEvent[]> {
    const stock = await this.events.findAllWithPrizeStock();
    return stock
      .map(({ event, prizeUnits, drawnUnits }) => ({ event, remainingUnits: Math.max(prizeUnits - drawnUnits, 0) }))
      .filter(({ event, remainingUnits }) => event.registrationOpen || remainingUnits > 0)
      .sort((a, b) => bySoonest(a.event, b.event));
  }
}

/** Next event first; events without a date go last, newest first. */
function bySoonest(a: Event, b: Event): number {
  if (a.eventDate && b.eventDate) return a.eventDate.getTime() - b.eventDate.getTime();
  if (a.eventDate || b.eventDate) return a.eventDate ? -1 : 1;
  return b.createdAt.getTime() - a.createdAt.getTime();
}
