import type { PrizeChanges } from '../../../domain/entities/Prize.ts';
import type { DrawRepository } from '../../../domain/repositories/DrawRepository.ts';
import type { EventRepository } from '../../../domain/repositories/EventRepository.ts';
import type { PrizeRepository } from '../../../domain/repositories/PrizeRepository.ts';
import type { Clock } from '../../ports/Clock.ts';
import type { TransactionManager } from '../../ports/TransactionManager.ts';
import { requireEvent, requirePrizeOfEvent } from '../shared/guards.ts';
import { toPrizeAvailability, type PrizeAvailability } from './PrizeAvailability.ts';

export interface UpdatePrizeInput {
  eventId: string;
  prizeId: string;
  changes: PrizeChanges;
}

export class UpdatePrize {
  constructor(
    private readonly transaction: TransactionManager,
    private readonly events: EventRepository,
    private readonly prizes: PrizeRepository,
    private readonly draws: DrawRepository,
    private readonly clock: Clock,
  ) {}

  execute(input: UpdatePrizeInput): Promise<PrizeAvailability> {
    // Locking the event keeps a concurrent draw from consuming units while the quantity changes.
    return this.transaction.run(async () => {
      await requireEvent(this.events, input.eventId, { lock: true });
      const prize = await requirePrizeOfEvent(this.prizes, input.eventId, input.prizeId);
      const drawnUnits = await this.draws.countConfirmedByPrize(prize.id);
      prize.update(input.changes, drawnUnits, this.clock.now());
      await this.prizes.update(prize);
      return toPrizeAvailability(prize, drawnUnits);
    });
  }
}
