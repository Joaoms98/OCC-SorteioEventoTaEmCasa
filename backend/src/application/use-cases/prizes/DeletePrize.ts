import { ConflictError } from '../../../domain/errors/DomainError.ts';
import { ErrorCode } from '../../../domain/errors/ErrorCode.ts';
import type { DrawRepository } from '../../../domain/repositories/DrawRepository.ts';
import type { EventRepository } from '../../../domain/repositories/EventRepository.ts';
import type { PrizeRepository } from '../../../domain/repositories/PrizeRepository.ts';
import type { TransactionManager } from '../../ports/TransactionManager.ts';
import { requireEvent, requirePrizeOfEvent } from '../shared/guards.ts';

export interface DeletePrizeInput {
  eventId: string;
  prizeId: string;
}

/** Prizes with draw history (even voided ones) are kept so results stay auditable. */
export class DeletePrize {
  constructor(
    private readonly transaction: TransactionManager,
    private readonly events: EventRepository,
    private readonly prizes: PrizeRepository,
    private readonly draws: DrawRepository,
  ) {}

  execute(input: DeletePrizeInput): Promise<void> {
    return this.transaction.run(async () => {
      await requireEvent(this.events, input.eventId, { lock: true });
      const prize = await requirePrizeOfEvent(this.prizes, input.eventId, input.prizeId);
      if (await this.draws.existsByPrize(prize.id)) {
        throw new ConflictError(ErrorCode.PrizeHasDraws);
      }
      await this.prizes.delete(prize.id);
    });
  }
}
