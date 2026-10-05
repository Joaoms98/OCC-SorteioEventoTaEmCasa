import { beforeEach, describe, expect, it } from 'vitest';
import { ErrorCode } from '../../../src/domain/errors/ErrorCode.ts';
import { jpegBytes, PNG_BYTES } from '../../doubles/images.ts';
import { makeTestUseCases } from '../../doubles/makeTestUseCases.ts';

describe('Prize image use cases', () => {
  let ctx: ReturnType<typeof makeTestUseCases>;
  let eventId: string;
  let prizeId: string;

  beforeEach(async () => {
    ctx = makeTestUseCases();
    eventId = (await ctx.useCases.createEvent.execute({ name: 'Tá em Casa' })).id;
    prizeId = (await ctx.useCases.createPrize.execute({ eventId, name: 'Kit', quantity: 1 })).prize.id;
  });

  it('adds, replaces and removes the photo of a prize', async () => {
    const added = await ctx.useCases.setPrizeImage.execute({ eventId, prizeId, data: PNG_BYTES });
    const firstVersion = added.prize.imageUpdatedAt;
    expect(firstVersion).toBeInstanceOf(Date);
    expect((await ctx.useCases.getPrizeImage.execute({ prizeId })).contentType).toBe('image/png');

    const replaced = await ctx.useCases.setPrizeImage.execute({ eventId, prizeId, data: jpegBytes() });
    expect(replaced.prize.imageUpdatedAt!.getTime()).toBeGreaterThan(firstVersion!.getTime());
    expect((await ctx.useCases.getPrizeImage.execute({ prizeId })).contentType).toBe('image/jpeg');

    const removed = await ctx.useCases.removePrizeImage.execute({ eventId, prizeId });
    expect(removed.prize.imageUpdatedAt).toBeNull();
    await expect(ctx.useCases.getPrizeImage.execute({ prizeId })).rejects.toMatchObject({
      code: ErrorCode.PrizeImageNotFound,
    });
  });

  it('keeps the current photo when the new file is invalid', async () => {
    await ctx.useCases.setPrizeImage.execute({ eventId, prizeId, data: PNG_BYTES });

    await expect(
      ctx.useCases.setPrizeImage.execute({ eventId, prizeId, data: Uint8Array.from(Buffer.from('oops')) }),
    ).rejects.toMatchObject({ code: ErrorCode.InvalidImage });
    expect((await ctx.useCases.getPrizeImage.execute({ prizeId })).contentType).toBe('image/png');
  });

  it('only accepts prizes of the given event', async () => {
    const otherEventId = (await ctx.useCases.createEvent.execute({ name: 'Outro' })).id;
    await expect(
      ctx.useCases.setPrizeImage.execute({ eventId: otherEventId, prizeId, data: PNG_BYTES }),
    ).rejects.toMatchObject({ code: ErrorCode.PrizeNotFound });
  });
});
