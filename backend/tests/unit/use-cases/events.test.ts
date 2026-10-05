import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestUseCases } from '../../doubles/makeTestUseCases.ts';
import { nextPhone } from '../../doubles/phones.ts';

describe('ListActiveEvents', () => {
  let ctx: ReturnType<typeof makeTestUseCases>;

  beforeEach(() => {
    ctx = makeTestUseCases();
  });

  const names = async () => (await ctx.useCases.listActiveEvents.execute()).map(({ event }) => event.name);

  it('lists events open for registration or with prizes left, and hides empty drafts', async () => {
    const { createEvent, createPrize } = ctx.useCases;
    await createEvent.execute({ name: 'Rascunho' });
    await createEvent.execute({ name: 'Inscrições abertas', registrationOpen: true });
    const closed = await createEvent.execute({ name: 'Fechado com brinde' });
    await createPrize.execute({ eventId: closed.id, name: 'Kit', quantity: 2 });

    const listed = await ctx.useCases.listActiveEvents.execute();

    expect(listed.map(({ event }) => event.name).sort()).toEqual(['Fechado com brinde', 'Inscrições abertas']);
    expect(listed.find(({ event }) => event.id === closed.id)?.remainingUnits).toBe(2);
  });

  it('drops an event once every prize was drawn and registration is closed; a voided draw brings it back', async () => {
    const { createEvent, createPrize, addParticipant, drawPrize, voidDraw, updateEvent } = ctx.useCases;
    const event = await createEvent.execute({ name: 'Tá em Casa', registrationOpen: true });
    const { prize } = await createPrize.execute({ eventId: event.id, name: 'Kit', quantity: 1 });
    await addParticipant.execute({ eventId: event.id, name: 'Ana', phone: nextPhone() });
    await addParticipant.execute({ eventId: event.id, name: 'Bruno', phone: nextPhone() });
    await updateEvent.execute({ eventId: event.id, changes: { registrationOpen: false } });
    expect(await names()).toEqual(['Tá em Casa']);

    const drawn = await drawPrize.execute({ eventId: event.id, prizeId: prize.id });
    expect(await names()).toEqual([]);

    await voidDraw.execute({ eventId: event.id, drawId: drawn.draw.id });
    expect((await ctx.useCases.listActiveEvents.execute())[0]).toMatchObject({ remainingUnits: 1 });
  });

  it('shows the next event first and events without a date last', async () => {
    const { createEvent } = ctx.useCases;
    await createEvent.execute({ name: 'Sem data', registrationOpen: true });
    await createEvent.execute({ name: 'Dezembro', registrationOpen: true, eventDate: new Date('2026-12-05T22:00:00Z') });
    await createEvent.execute({ name: 'Novembro', registrationOpen: true, eventDate: new Date('2026-11-20T22:00:00Z') });

    expect(await names()).toEqual(['Novembro', 'Dezembro', 'Sem data']);
  });
});
