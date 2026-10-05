import { BusinessRuleError, NotFoundError } from '../../../domain/errors/DomainError.ts';
import { ErrorCode } from '../../../domain/errors/ErrorCode.ts';
import type { DrawDetails, DrawRepository } from '../../../domain/repositories/DrawRepository.ts';
import type { EventRepository } from '../../../domain/repositories/EventRepository.ts';
import type { Clock } from '../../ports/Clock.ts';
import type { LiveDrawChannel } from '../../ports/LiveDrawChannel.ts';
import type { TransactionManager } from '../../ports/TransactionManager.ts';
import { requireDrawOfEvent, requireEvent } from '../shared/guards.ts';

export interface ClaimPrizeInput {
  eventId: string;
  drawId: string;
}

/** The winner showed up and received the prize: recorded and celebrated live. */
export class ClaimPrize {
  constructor(
    private readonly transaction: TransactionManager,
    private readonly events: EventRepository,
    private readonly draws: DrawRepository,
    private readonly clock: Clock,
    private readonly live: LiveDrawChannel,
  ) {}

  async execute(input: ClaimPrizeInput): Promise<DrawDetails> {
    // While in suspense the winner is still a secret to the audience.
    if (this.live.pending(input.eventId)?.drawId === input.drawId) {
      throw new BusinessRuleError(ErrorCode.DrawNotRevealed);
    }

    const details = await this.transaction.run(async () => {
      await requireEvent(this.events, input.eventId, { lock: true });
      const draw = await requireDrawOfEvent(this.draws, input.eventId, input.drawId);
      draw.markAsClaimed(this.clock.now());
      await this.draws.update(draw);

      const updated = await this.draws.findDetailsById(draw.id);
      if (!updated) throw new NotFoundError(ErrorCode.DrawNotFound);
      return updated;
    });

    this.live.claimed(input.eventId, {
      drawId: details.draw.id,
      prize: details.prize,
      winnerName: details.participant.name,
    });
    return details;
  }
}
