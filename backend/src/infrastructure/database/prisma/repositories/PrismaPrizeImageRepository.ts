import type { PrizeImageRepository } from '../../../../domain/repositories/PrizeImageRepository.ts';
import { PrizeImage, type PrizeImageContentType } from '../../../../domain/value-objects/PrizeImage.ts';
import type { PrismaContext } from '../PrismaContext.ts';

export class PrismaPrizeImageRepository implements PrizeImageRepository {
  constructor(private readonly context: PrismaContext) {}

  async findByPrizeId(prizeId: string): Promise<PrizeImage | null> {
    const row = await this.context.client.prizeImage.findUnique({ where: { prizeId } });
    return row ? PrizeImage.restore(row.contentType as PrizeImageContentType, row.data) : null;
  }

  async save(prizeId: string, image: PrizeImage): Promise<void> {
    // Prisma expects bytes backed by a plain ArrayBuffer; request bodies may come from a shared pool.
    const data = { contentType: image.contentType, data: Uint8Array.from(image.data), byteSize: image.data.length };
    await this.context.client.prizeImage.upsert({
      where: { prizeId },
      create: { prizeId, ...data },
      update: data,
    });
  }

  async delete(prizeId: string): Promise<void> {
    await this.context.client.prizeImage.deleteMany({ where: { prizeId } });
  }
}
