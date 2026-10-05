import { beforeEach, describe, expect, it } from 'vitest';
import { WHEEL_NAMES } from '../../../src/application/use-cases/draws/DrawPrize.ts';
import { DrawStatus } from '../../../src/domain/entities/Draw.ts';
import { DrawMode } from '../../../src/domain/entities/Event.ts';
import { ErrorCode } from '../../../src/domain/errors/ErrorCode.ts';
import { makeTestUseCases } from '../../doubles/makeTestUseCases.ts';
import { nextPhone } from '../../doubles/phones.ts';

const UNKNOWN_ID = '00000000-0000-4000-8000-999999999999';

describe('Draw use cases', () => {
  let ctx: ReturnType<typeof makeTestUseCases>;
  let eventId: string;
  let prizeId: string;
  let participantIds: string[];

  beforeEach(async () => {
    ctx = makeTestUseCases();
    const { useCases } = ctx;
    eventId = (await useCases.createEvent.execute({ name: 'Tá em Casa' })).id;
    prizeId = (await useCases.createPrize.execute({ eventId, name: 'Kit de cabelo', quantity: 2 })).prize.id;
    participantIds = [];
    for (const name of ['Ana', 'Bruno', 'Carla']) {
      participantIds.push((await useCases.addParticipant.execute({ eventId, name, phone: nextPhone() })).id);
    }
  });

  describe('DrawPrize', () => {
    it('picks the eligible participant at the random position', async () => {
      ctx.random.enqueue(1);

      const result = await ctx.useCases.drawPrize.execute({ eventId, prizeId });

      expect(ctx.random.requestedRanges).toEqual([3]);
      expect(result.participant.name).toBe('Bruno');
      expect(result.prize.id).toBe(prizeId);
      expect(result.draw.status).toBe(DrawStatus.Confirmed);
      expect(result.remainingUnits).toBe(1);
      expect(ctx.db.draws.size).toBe(1);
    });

    it('never draws the same participant twice in the event', async () => {
      ctx.random.enqueue(0, 0);

      const first = await ctx.useCases.drawPrize.execute({ eventId, prizeId });
      const second = await ctx.useCases.drawPrize.execute({ eventId, prizeId });

      expect(ctx.random.requestedRanges).toEqual([3, 2]);
      expect(first.participant.name).toBe('Ana');
      expect(second.participant.name).toBe('Bruno');
    });

    it('fails when every unit of the prize was drawn', async () => {
      await ctx.useCases.drawPrize.execute({ eventId, prizeId });
      await ctx.useCases.drawPrize.execute({ eventId, prizeId });

      await expect(ctx.useCases.drawPrize.execute({ eventId, prizeId })).rejects.toMatchObject({
        code: ErrorCode.PrizeOutOfStock,
      });
    });

    it('fails when nobody is eligible', async () => {
      const bigPrize = await ctx.useCases.createPrize.execute({ eventId, name: 'Camiseta', quantity: 10 });
      for (let i = 0; i < 3; i += 1) await ctx.useCases.drawPrize.execute({ eventId, prizeId: bigPrize.prize.id });

      await expect(ctx.useCases.drawPrize.execute({ eventId, prizeId: bigPrize.prize.id })).rejects.toMatchObject({
        code: ErrorCode.NoEligibleParticipants,
      });
    });

    it('prize roulette events have no participant wheel', async () => {
      const result = await ctx.useCases.drawPrize.execute({ eventId, prizeId });

      expect(result.wheel).toBeNull();
    });

    it('participant roulette: the winner sits at a random slot among other eligible names', async () => {
      await ctx.useCases.updateEvent.execute({ eventId, changes: { drawMode: DrawMode.Participants } });
      ctx.random.enqueue(1, 2); // winner: Bruno; slot 2 of 3

      const result = await ctx.useCases.drawPrize.execute({ eventId, prizeId });

      expect(ctx.random.requestedRanges).toEqual([3, 3]);
      expect(result.participant.name).toBe('Bruno');
      expect(result.wheel).toEqual({ names: ['Ana', 'Carla', 'Bruno'], winnerSlot: 2 });
    });

    it('participant roulette: never more than WHEEL_NAMES slices, never a previous winner', async () => {
      await ctx.useCases.updateEvent.execute({ eventId, changes: { drawMode: DrawMode.Participants } });
      for (let i = 0; i < WHEEL_NAMES + 5; i += 1) {
        await ctx.useCases.addParticipant.execute({ eventId, name: `Pessoa ${i}`, phone: nextPhone() });
      }
      const first = await ctx.useCases.drawPrize.execute({ eventId, prizeId });
      const second = await ctx.useCases.drawPrize.execute({ eventId, prizeId });

      expect(second.wheel?.names).toHaveLength(WHEEL_NAMES);
      expect(second.wheel?.names).not.toContain(first.participant.name);
      expect(second.wheel?.names[second.wheel.winnerSlot]).toBe(second.participant.name);
    });

    it('rejects unknown events and prizes from other events', async () => {
      const otherEventId = (await ctx.useCases.createEvent.execute({ name: 'Outro' })).id;

      await expect(ctx.useCases.drawPrize.execute({ eventId: UNKNOWN_ID, prizeId })).rejects.toMatchObject({
        code: ErrorCode.EventNotFound,
      });
      await expect(ctx.useCases.drawPrize.execute({ eventId: otherEventId, prizeId })).rejects.toMatchObject({
        code: ErrorCode.PrizeNotFound,
      });
    });
  });

  describe('DrawPrize without a prize (roulette)', () => {
    it('draws the prize weighted by its remaining units, then the winner', async () => {
      const mug = await ctx.useCases.createPrize.execute({ eventId, name: 'Caneca', quantity: 1 });
      // Tickets: 0-1 = "Kit de cabelo" (2 units), 2 = "Caneca" (1 unit).
      ctx.random.enqueue(2, 0);

      const result = await ctx.useCases.drawPrize.execute({ eventId });

      expect(ctx.random.requestedRanges).toEqual([3, 3]);
      expect(result.prize).toEqual({ id: mug.prize.id, name: 'Caneca' });
      expect(result.participant.name).toBe('Ana');

      ctx.random.enqueue(1, 0);
      const next = await ctx.useCases.drawPrize.execute({ eventId });
      // "Caneca" is gone, so only the 2 units of the kit are left in the bag.
      expect(ctx.random.requestedRanges.slice(2)).toEqual([2, 2]);
      expect(next.prize.id).toBe(prizeId);
    });

    it('fails when every prize was drawn', async () => {
      await ctx.useCases.drawPrize.execute({ eventId });
      await ctx.useCases.drawPrize.execute({ eventId });

      await expect(ctx.useCases.drawPrize.execute({ eventId })).rejects.toMatchObject({
        code: ErrorCode.NoPrizesAvailable,
      });
    });
  });

  describe('VoidDraw', () => {
    it('returns the unit to the prize but keeps the participant ineligible', async () => {
      const first = await ctx.useCases.drawPrize.execute({ eventId, prizeId });
      await ctx.useCases.drawPrize.execute({ eventId, prizeId });

      const voided = await ctx.useCases.voidDraw.execute({ eventId, drawId: first.draw.id });
      expect(voided.draw.status).toBe(DrawStatus.Voided);
      expect(voided.draw.voidedAt).toBeInstanceOf(Date);

      const [prize] = await ctx.useCases.listPrizes.execute({ eventId });
      expect(prize?.remainingUnits).toBe(1);

      ctx.random.enqueue(0);
      const redraw = await ctx.useCases.drawPrize.execute({ eventId, prizeId });
      expect(ctx.random.requestedRanges.at(-1)).toBe(1);
      expect(redraw.participant.id).not.toBe(first.participant.id);
    });

    it('cannot void the same draw twice', async () => {
      const { draw } = await ctx.useCases.drawPrize.execute({ eventId, prizeId });
      await ctx.useCases.voidDraw.execute({ eventId, drawId: draw.id });

      await expect(ctx.useCases.voidDraw.execute({ eventId, drawId: draw.id })).rejects.toMatchObject({
        code: ErrorCode.DrawAlreadyVoided,
      });
    });

    it('rejects draws from another event', async () => {
      const { draw } = await ctx.useCases.drawPrize.execute({ eventId, prizeId });
      const otherEventId = (await ctx.useCases.createEvent.execute({ name: 'Outro' })).id;

      await expect(ctx.useCases.voidDraw.execute({ eventId: otherEventId, drawId: draw.id })).rejects.toMatchObject({
        code: ErrorCode.DrawNotFound,
      });
    });
  });

  describe('ListDraws', () => {
    it('lists the most recent draws first with participant and prize names', async () => {
      ctx.random.enqueue(2, 0);
      await ctx.useCases.drawPrize.execute({ eventId, prizeId });
      await ctx.useCases.drawPrize.execute({ eventId, prizeId });

      const draws = await ctx.useCases.listDraws.execute({ eventId });

      expect(draws.map((details) => details.participant.name)).toEqual(['Ana', 'Carla']);
      expect(draws.every((details) => details.prize.name === 'Kit de cabelo')).toBe(true);
    });
  });

  describe('GetEventOverview', () => {
    it('summarizes participants, prize units and drawn units', async () => {
      await ctx.useCases.createPrize.execute({ eventId, name: 'Camiseta', quantity: 3 });
      await ctx.useCases.drawPrize.execute({ eventId, prizeId });

      const { stats } = await ctx.useCases.getEventOverview.execute({ eventId });

      expect(stats).toEqual({ participants: 3, eligibleParticipants: 2, prizeUnits: 5, drawnUnits: 1 });
    });
  });
});
