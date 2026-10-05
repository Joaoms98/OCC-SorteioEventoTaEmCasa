import { beforeEach, describe, expect, it } from 'vitest';
import { ErrorCode } from '../../../src/domain/errors/ErrorCode.ts';
import { makeTestUseCases, TEST_ADMIN_PASSWORD } from '../../doubles/makeTestUseCases.ts';
import { nextPhone } from '../../doubles/phones.ts';

describe('Prize use cases', () => {
  let ctx: ReturnType<typeof makeTestUseCases>;
  let eventId: string;
  let prizeId: string;

  beforeEach(async () => {
    ctx = makeTestUseCases();
    eventId = (await ctx.useCases.createEvent.execute({ name: 'Tá em Casa' })).id;
    prizeId = (await ctx.useCases.createPrize.execute({ eventId, name: 'Kit', quantity: 3 })).prize.id;
    for (const name of ['Ana', 'Bruno']) await ctx.useCases.addParticipant.execute({ eventId, name, phone: nextPhone() });
  });

  it('updates a prize and reports its availability', async () => {
    await ctx.useCases.drawPrize.execute({ eventId, prizeId });

    const result = await ctx.useCases.updatePrize.execute({ eventId, prizeId, changes: { quantity: 1, name: 'Kit VIP' } });

    expect(result).toMatchObject({ drawnUnits: 1, remainingUnits: 0 });
    expect(result.prize.name).toBe('Kit VIP');
    expect(ctx.db.prizes.get(prizeId)?.quantity).toBe(1);
  });

  it('refuses a quantity below the units already drawn', async () => {
    await ctx.useCases.drawPrize.execute({ eventId, prizeId });
    await ctx.useCases.drawPrize.execute({ eventId, prizeId });

    await expect(
      ctx.useCases.updatePrize.execute({ eventId, prizeId, changes: { quantity: 1 } }),
    ).rejects.toMatchObject({ code: ErrorCode.PrizeQuantityBelowDrawn, details: { drawnUnits: 2 } });
  });

  it('deletes prizes without draws but keeps the ones with history', async () => {
    const spare = await ctx.useCases.createPrize.execute({ eventId, name: 'Caneca', quantity: 1 });
    await ctx.useCases.deletePrize.execute({ eventId, prizeId: spare.prize.id });
    expect(ctx.db.prizes.has(spare.prize.id)).toBe(false);

    const { draw } = await ctx.useCases.drawPrize.execute({ eventId, prizeId });
    await ctx.useCases.voidDraw.execute({ eventId, drawId: draw.id });
    await expect(ctx.useCases.deletePrize.execute({ eventId, prizeId })).rejects.toMatchObject({
      code: ErrorCode.PrizeHasDraws,
    });
  });
});

describe('AuthenticateAdmin', () => {
  it('issues a token for the right password', async () => {
    const { useCases } = makeTestUseCases();
    await expect(useCases.authenticateAdmin.execute({ password: TEST_ADMIN_PASSWORD })).resolves.toEqual({
      token: 'token-for-admin',
      expiresInSeconds: 3600,
    });
  });

  it('rejects a wrong password', async () => {
    const { useCases } = makeTestUseCases();
    await expect(useCases.authenticateAdmin.execute({ password: 'wrong' })).rejects.toMatchObject({
      code: ErrorCode.InvalidCredentials,
    });
  });
});
