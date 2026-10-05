import type { DrawRepository } from '../../../domain/repositories/DrawRepository.ts';
import type { PrizeImageRepository } from '../../../domain/repositories/PrizeImageRepository.ts';
import type { PrizeRepository } from '../../../domain/repositories/PrizeRepository.ts';
import { PrizeImage } from '../../../domain/value-objects/PrizeImage.ts';
import type { Clock } from '../../ports/Clock.ts';
import type { TransactionManager } from '../../ports/TransactionManager.ts';
import { requirePrizeOfEvent } from '../shared/guards.ts';
import { toPrizeAvailability, type PrizeAvailability } from './PrizeAvailability.ts';

export interface SetPrizeImageInput {
  eventId: string;
  prizeId: string;
  data: Uint8Array;
}

/** Adds or replaces the photo of a prize. */
export class SetPrizeImage {
  constructor(
    private readonly transaction: TransactionManager,
    private readonly prizes: PrizeRepository,
    private readonly images: PrizeImageRepository,
    private readonly draws: DrawRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetPrizeImageInput): Promise<PrizeAvailability> {
    const image = PrizeImage.create(input.data);
    return this.transaction.run(async () => {
      const prize = await requirePrizeOfEvent(this.prizes, input.eventId, input.prizeId);
      await this.images.save(prize.id, image);
      prize.imageChanged(this.clock.now());
      await this.prizes.update(prize);
      return toPrizeAvailability(prize, await this.draws.countConfirmedByPrize(prize.id));
    });
  }
}
