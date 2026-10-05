import { beforeEach, describe, expect, it } from 'vitest';
import { ErrorCode } from '../../../src/domain/errors/ErrorCode.ts';
import { makeTestUseCases } from '../../doubles/makeTestUseCases.ts';
import { nextPhone } from '../../doubles/phones.ts';

describe('Participant use cases', () => {
  let ctx: ReturnType<typeof makeTestUseCases>;
  let eventId: string;

  beforeEach(async () => {
    ctx = makeTestUseCases();
    eventId = (await ctx.useCases.createEvent.execute({ name: 'Tá em Casa', registrationOpen: true })).id;
  });

  describe('AddParticipant', () => {
    it('requires a phone, so the same person cannot be added twice under different names', async () => {
      await expect(ctx.useCases.addParticipant.execute({ eventId, name: 'Ana', email: 'ana@mail.com' })).rejects.toMatchObject({
        code: ErrorCode.PhoneRequired,
        details: { field: 'phone' },
      });
    });

    it('rejects a phone already registered in the event, whatever its formatting', async () => {
      await ctx.useCases.addParticipant.execute({ eventId, name: 'Ana', phone: '(11) 98765-4321' });

      await expect(
        ctx.useCases.addParticipant.execute({ eventId, name: 'Ana Maria', phone: '+55 11 987654321' }),
      ).rejects.toMatchObject({ code: ErrorCode.ParticipantAlreadyRegistered, details: { field: 'phone' } });
    });

    it('allows the same contact in different events', async () => {
      const otherEventId = (await ctx.useCases.createEvent.execute({ name: 'Outro' })).id;
      await ctx.useCases.addParticipant.execute({ eventId, name: 'Ana', phone: '11911110001', email: 'ana@mail.com' });

      await expect(
        ctx.useCases.addParticipant.execute({ eventId: otherEventId, name: 'Ana', phone: '11911110001', email: 'ana@mail.com' }),
      ).resolves.toBeDefined();
    });
  });

  describe('ImportParticipants', () => {
    it('creates valid entries and reports invalid or duplicated ones by line', async () => {
      await ctx.useCases.addParticipant.execute({ eventId, name: 'Já Cadastrada', phone: '11911112222' });

      const result = await ctx.useCases.importParticipants.execute({
        eventId,
        entries: [
          { name: 'Ana', phone: '11 93333-4444' },
          { name: '   ' },
          { name: 'Bruno', phone: '(11) 91111-2222' },
          { name: 'Carla', phone: '11955556666', email: 'carla@mail.com' },
          { name: 'Carla de novo', phone: '11977778888', email: 'CARLA@mail.com' },
          { name: 'Davi', phone: '123' },
          { name: 'Eva' },
          { name: 'Fábio', phone: '21988887777' },
        ],
      });

      expect(result.created).toBe(3);
      expect(result.rejected).toEqual([
        { line: 2, name: '   ', code: ErrorCode.InvalidParticipantName },
        { line: 3, name: 'Bruno', code: ErrorCode.ParticipantAlreadyRegistered },
        { line: 5, name: 'Carla de novo', code: ErrorCode.ParticipantAlreadyRegistered },
        { line: 6, name: 'Davi', code: ErrorCode.InvalidPhone },
        { line: 7, name: 'Eva', code: ErrorCode.PhoneRequired },
      ]);
      expect(await ctx.useCases.listParticipants.execute({ eventId, page: 1, pageSize: 50 })).toMatchObject({
        total: 4,
      });
    });
  });

  describe('ListParticipants', () => {
    it('paginates alphabetically and filters by name', async () => {
      for (const name of ['Carla', 'Ana', 'Bruno']) {
        await ctx.useCases.addParticipant.execute({ eventId, name, phone: nextPhone() });
      }

      const page = await ctx.useCases.listParticipants.execute({ eventId, page: 2, pageSize: 2 });
      expect(page.items.map((participant) => participant.name)).toEqual(['Carla']);
      expect(page.total).toBe(3);

      const filtered = await ctx.useCases.listParticipants.execute({ eventId, search: 'BRU', page: 1, pageSize: 10 });
      expect(filtered.items.map((participant) => participant.name)).toEqual(['Bruno']);
    });
  });

  describe('RemoveParticipant', () => {
    it('removes participants that were never drawn', async () => {
      const { id } = await ctx.useCases.addParticipant.execute({ eventId, name: 'Ana', phone: nextPhone() });
      await ctx.useCases.removeParticipant.execute({ eventId, participantId: id });
      expect(ctx.db.participants.size).toBe(0);
    });

    it('keeps drawn participants for auditing', async () => {
      const { id } = await ctx.useCases.addParticipant.execute({ eventId, name: 'Ana', phone: nextPhone() });
      const { prize } = await ctx.useCases.createPrize.execute({ eventId, name: 'Kit', quantity: 1 });
      await ctx.useCases.drawPrize.execute({ eventId, prizeId: prize.id });

      await expect(ctx.useCases.removeParticipant.execute({ eventId, participantId: id })).rejects.toMatchObject({
        code: ErrorCode.ParticipantHasDraw,
      });
    });
  });
});
