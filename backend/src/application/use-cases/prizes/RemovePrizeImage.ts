import type { DrawRepository } from '../../../domain/repositories/DrawRepository.ts';
import type { PrizeImageRepository } from '../../../domain/repositories/PrizeImageRepository.ts';
import type { PrizeRepository } from '../../../domain/repositories/PrizeRepository.ts';
import type { Clock } from '../../ports/Clock.ts';
import type { TransactionManager } from '../../ports/TransactionManager.ts';
import { requirePrizeOfEvent } from '../shared/guards.ts';
import { toPrizeAvailability, type PrizeAvailability } from './PrizeAvailability.ts';

export interface RemovePrizeImageInput {
  eventId: string;
  prizeId: string;
}

export class RemovePrizeImage {
  constructor(
    private readonly transaction: TransactionManager,
    private readonly prizes: PrizeRepository,
    private readonly images: PrizeImageRepository,
    private readonly draws: DrawRepository,
    private readonly clock: Clock,
  ) {}

  execute(input: RemovePrizeImageInput): Promise<PrizeAvailability> {
    return this.transaction.run(async () => {
      const prize = await requirePrizeOfEvent(this.prizes, input.eventId, input.prizeId);
      await this.images.delete(prize.id);
      prize.imageRemoved(this.clock.now());
      await this.prizes.update(prize);
      return toPrizeAvailability(prize, await this.draws.countConfirmedByPrize(prize.id));
    });
  }
}
