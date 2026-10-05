import { NotFoundError } from '../../../domain/errors/DomainError.ts';
import { ErrorCode } from '../../../domain/errors/ErrorCode.ts';
import type { DrawDetails, DrawRepository } from '../../../domain/repositories/DrawRepository.ts';
import type { EventRepository } from '../../../domain/repositories/EventRepository.ts';
import type { Clock } from '../../ports/Clock.ts';
import type { LiveDrawChannel } from '../../ports/LiveDrawChannel.ts';
import type { TransactionManager } from '../../ports/TransactionManager.ts';
import { requireDrawOfEvent, requireEvent } from '../shared/guards.ts';

export interface VoidDrawInput {
  eventId: string;
  drawId: string;
}

/** Used when the winner is absent: the prize unit goes back to the pool for a new draw. */
export class VoidDraw {
  constructor(
    private readonly transaction: TransactionManager,
    private readonly events: EventRepository,
    private readonly draws: DrawRepository,
    private readonly clock: Clock,
    private readonly live: LiveDrawChannel,
  ) {}

  async execute(input: VoidDrawInput): Promise<DrawDetails> {
    const details = await this.voidDraw(input);
    this.live.voided(input.eventId, {
      drawId: details.draw.id,
      prize: details.prize,
      winnerName: details.participant.name,
    });
    return details;
  }

  private voidDraw(input: VoidDrawInput): Promise<DrawDetails> {
    return this.transaction.run(async () => {
      await requireEvent(this.events, input.eventId, { lock: true });
      const draw = await requireDrawOfEvent(this.draws, input.eventId, input.drawId);
      draw.markAsVoided(this.clock.now());
      await this.draws.update(draw);

      const details = await this.draws.findDetailsById(draw.id);
      if (!details) throw new NotFoundError(ErrorCode.DrawNotFound);
      return details;
    });
  }
}
