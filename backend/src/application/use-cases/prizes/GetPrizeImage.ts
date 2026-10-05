import { NotFoundError } from '../../../domain/errors/DomainError.ts';
import { ErrorCode } from '../../../domain/errors/ErrorCode.ts';
import type { PrizeImageRepository } from '../../../domain/repositories/PrizeImageRepository.ts';
import type { PrizeImage } from '../../../domain/value-objects/PrizeImage.ts';

/** Public: prize photos are shown on the live page and the projector. */
export class GetPrizeImage {
  constructor(private readonly images: PrizeImageRepository) {}

  async execute(input: { prizeId: string }): Promise<PrizeImage> {
    const image = await this.images.findByPrizeId(input.prizeId);
    if (!image) throw new NotFoundError(ErrorCode.PrizeImageNotFound);
    return image;
  }
}
