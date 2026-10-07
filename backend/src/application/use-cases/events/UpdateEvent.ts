import { DrawMode, type Event, type EventChanges } from '../../../domain/entities/Event.ts';
import { BusinessRuleError } from '../../../domain/errors/DomainError.ts';
import { ErrorCode } from '../../../domain/errors/ErrorCode.ts';
import type { EventRepository } from '../../../domain/repositories/EventRepository.ts';
import type { ParticipantRepository } from '../../../domain/repositories/ParticipantRepository.ts';
import type { Clock } from '../../ports/Clock.ts';
import { requireEvent } from '../shared/guards.ts';

export interface UpdateEventInput {
  eventId: string;
  changes: EventChanges;
}

export class UpdateEvent {
  constructor(
    private readonly events: EventRepository,
    private readonly participants: ParticipantRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateEventInput): Promise<Event> {
    const event = await requireEvent(this.events, input.eventId);
    await this.ensureModeCanChange(event, input.changes.drawMode);
    event.update(input.changes, this.clock.now());
    await this.events.update(event);
    return event;
  }

  /**
   * On the interactive roulette every participant has spun and won; on the other types nobody
   * has. Switching between them with people already registered would break one of the two.
   */
  private async ensureModeCanChange(event: Event, next: DrawMode | undefined): Promise<void> {
    if (next === undefined || next === event.drawMode) return;
    if (!event.isInteractive && next !== DrawMode.Interactive) return;
    if ((await this.participants.countByEvent(event.id)) > 0) throw new BusinessRuleError(ErrorCode.DrawModeLocked);
  }
}
