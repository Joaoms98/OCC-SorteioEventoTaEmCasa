import type { PrizeImage } from '../value-objects/PrizeImage.ts';

/** Prize photos live apart from prizes so listing prizes never loads image bytes. */
export interface PrizeImageRepository {
  findByPrizeId(prizeId: string): Promise<PrizeImage | null>;
  /** Creates or replaces the photo of the prize. */
  save(prizeId: string, image: PrizeImage): Promise<void>;
  delete(prizeId: string): Promise<void>;
}
