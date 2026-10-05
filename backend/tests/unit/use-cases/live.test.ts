import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROLL_NAMES } from '../../../src/application/use-cases/live/GetLiveBoard.ts';
import { InMemoryLiveDrawChannel } from '../../../src/infrastructure/live/InMemoryLiveDrawChannel.ts';
import { ErrorCode } from '../../../src/domain/errors/ErrorCode.ts';
import { makeTestUseCases } from '../../doubles/makeTestUseCases.ts';
import { nextPhone } from '../../doubles/phones.ts';

describe('Live draw use cases', () => {
  let ctx: ReturnType<typeof makeTestUseCases>;
  let live: InMemoryLiveDrawChannel;
  let eventId: string;
  let prizeId: string;

  beforeEach(async () => {
    vi.useFakeTimers();
    live = new InMemoryLiveDrawChannel({ now: () => new Date() }, 5000);
    ctx = makeTestUseCases({ live });
    eventId = (await ctx.useCases.createEvent.execute({ name: 'Tá em Casa' })).id;
    prizeId = (await ctx.useCases.createPrize.execute({ eventId, name: 'Kit', quantity: 3 })).prize.id;
    for (const name of ['Ana Lima', 'Bruno Souza', 'Carla Dias']) await ctx.useCases.addParticipant.execute({ eventId, name, phone: nextPhone() });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refuses a new draw until the current winner is revealed', async () => {
    const first = await ctx.useCases.drawPrize.execute({ eventId, prizeId });
    expect(first.revealAt.getTime() - Date.now()).toBe(5000);

    await expect(ctx.useCases.drawPrize.execute({ eventId, prizeId })).rejects.toMatchObject({
      code: ErrorCode.DrawInProgress,
    });

    vi.advanceTimersByTime(5000);
    await expect(ctx.useCases.drawPrize.execute({ eventId, prizeId })).resolves.toBeDefined();
  });

  it('gives the stage back when the draw fails', async () => {
    const empty = await ctx.useCases.createPrize.execute({ eventId, name: 'Esgotado', quantity: 1 });
    await ctx.useCases.drawPrize.execute({ eventId, prizeId: empty.prize.id });
    vi.advanceTimersByTime(5000);

    await expect(ctx.useCases.drawPrize.execute({ eventId, prizeId: empty.prize.id })).rejects.toMatchObject({
      code: ErrorCode.PrizeOutOfStock,
    });
    expect(live.pending(eventId)).toBeNull();
  });

  it('keeps the winner off the public board until the reveal', async () => {
    const draw = await ctx.useCases.drawPrize.execute({ eventId, prizeId });

    const during = await ctx.useCases.getLiveBoard.execute({ eventId });
    expect(during.recentWinners).toEqual([]);
    // The board shows the state before the draw, so the spinning roulette keeps every slice.
    expect(during.eligibleParticipants).toBe(3);
    expect(during.prizes[0]).toMatchObject({ drawnUnits: 0, remainingUnits: 3 });

    vi.advanceTimersByTime(5000);
    const after = await ctx.useCases.getLiveBoard.execute({ eventId });
    expect(after.recentWinners.map((winner) => winner.participant.name)).toEqual([draw.participant.name]);
    expect(after.prizes[0]).toMatchObject({ drawnUnits: 1, remainingUnits: 2 });
  });

  it('the names of the rolling animation do not give the winner away during the suspense', async () => {
    const before = await ctx.useCases.getLiveBoard.execute({ eventId });
    ctx.random.enqueue(1); // winner: Bruno Souza
    const draw = await ctx.useCases.drawPrize.execute({ eventId, prizeId });

    // Every contender still on the list, winner included (they stopped being eligible when the draw was saved).
    const during = await ctx.useCases.getLiveBoard.execute({ eventId });
    expect(draw.participant.name).toBe('Bruno Souza');
    expect([...during.rollNames].sort()).toEqual([...before.rollNames].sort());

    vi.advanceTimersByTime(5000);
    const after = await ctx.useCases.getLiveBoard.execute({ eventId });
    expect(after.rollNames).not.toContain('Bruno Souza');
  });

  it('with more contenders than fit in the list, the winner is on it as often as anyone else', async () => {
    for (let i = 0; i < ROLL_NAMES; i += 1) {
      await ctx.useCases.addParticipant.execute({ eventId, name: `Pessoa ${i}`, phone: nextPhone() });
    }
    const draw = await ctx.useCases.drawPrize.execute({ eventId, prizeId });
    const contenders = ROLL_NAMES + 3;

    // ROLL_NAMES chances in `contenders`: a ticket below ROLL_NAMES puts the winner on the list.
    ctx.random.enqueue(ROLL_NAMES - 1, 5);
    const shown = await ctx.useCases.getLiveBoard.execute({ eventId });
    expect(shown.rollNames).toHaveLength(ROLL_NAMES);
    expect(shown.rollNames[5]).toBe(draw.participant.name);

    ctx.random.enqueue(ROLL_NAMES);
    const absent = await ctx.useCases.getLiveBoard.execute({ eventId });
    expect(absent.rollNames).toHaveLength(ROLL_NAMES);
    expect(absent.rollNames).not.toContain(draw.participant.name);
    expect(ctx.random.requestedRanges.slice(-3)).toEqual([contenders, ROLL_NAMES, contenders]);
  });

  it('claims a revealed prize and celebrates it live, but never during the suspense', async () => {
    const messages: string[] = [];
    live.subscribe(eventId, (message) => messages.push(message.type));
    const { draw } = await ctx.useCases.drawPrize.execute({ eventId, prizeId });

    await expect(ctx.useCases.claimPrize.execute({ eventId, drawId: draw.id })).rejects.toMatchObject({
      code: ErrorCode.DrawNotRevealed,
    });

    vi.advanceTimersByTime(5000);
    const claimed = await ctx.useCases.claimPrize.execute({ eventId, drawId: draw.id });
    expect(claimed.draw.claimedAt).toBeInstanceOf(Date);
    expect(messages).toEqual(['draw_started', 'draw_revealed', 'draw_claimed']);

    const board = await ctx.useCases.getLiveBoard.execute({ eventId });
    expect(board.recentWinners[0]?.draw.claimedAt).toBeInstanceOf(Date);
    await expect(ctx.useCases.claimPrize.execute({ eventId, drawId: draw.id })).rejects.toMatchObject({
      code: ErrorCode.PrizeAlreadyClaimed,
    });
  });

  it('announces voided draws to the audience', async () => {
    const messages: string[] = [];
    live.subscribe(eventId, (message) => messages.push(message.type));
    const { draw } = await ctx.useCases.drawPrize.execute({ eventId, prizeId });
    vi.advanceTimersByTime(5000);

    await ctx.useCases.voidDraw.execute({ eventId, drawId: draw.id });

    expect(messages).toEqual(['draw_started', 'draw_revealed', 'draw_voided']);
    const board = await ctx.useCases.getLiveBoard.execute({ eventId });
    expect(board.recentWinners).toEqual([]);
  });
});
