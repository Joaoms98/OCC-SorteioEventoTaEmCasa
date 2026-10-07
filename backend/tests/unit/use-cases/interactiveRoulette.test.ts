import { beforeEach, describe, expect, it } from 'vitest';
import { DrawStatus } from '../../../src/domain/entities/Draw.ts';
import { DrawMode } from '../../../src/domain/entities/Event.ts';
import { ErrorCode } from '../../../src/domain/errors/ErrorCode.ts';
import { makeTestUseCases } from '../../doubles/makeTestUseCases.ts';
import { nextPhone } from '../../doubles/phones.ts';

describe('Interactive roulette', () => {
  let ctx: ReturnType<typeof makeTestUseCases>;
  let eventId: string;
  let shirtId: string;
  let mugId: string;

  beforeEach(async () => {
    ctx = makeTestUseCases();
    const { createEvent, createPrize } = ctx.useCases;
    eventId = (await createEvent.execute({ name: 'Tá em Casa', registrationOpen: true, drawMode: DrawMode.Interactive })).id;
    shirtId = (await createPrize.execute({ eventId, name: 'Camiseta', quantity: 2 })).prize.id;
    mugId = (await createPrize.execute({ eventId, name: 'Caneca', quantity: 1 })).prize.id;
  });

  /** Public registration, both steps; `ticket` is the random position among the remaining units. */
  async function register(name: string, ticket = 0) {
    const email = `${name.toLowerCase()}@mail.com`;
    ctx.random.enqueue(0); // verification code
    const { verification } = await ctx.useCases.startRegistration.execute({ eventId, name, phone: nextPhone(), email });
    ctx.random.enqueue(ticket);
    return ctx.useCases.confirmRegistration.execute({ eventId, verificationId: verification.id, code: ctx.emails.lastCodeFor(email) });
  }

  it('whoever registers wins a prize right away, drawn by the remaining units', async () => {
    const { participant, spin } = await register('Ana', 2); // tickets: Camiseta, Camiseta, Caneca

    expect(spin?.prize.id).toBe(mugId);
    expect(spin?.wheel.map(({ prize, remainingUnits }) => [prize.name, remainingUnits])).toEqual([
      ['Camiseta', 2],
      ['Caneca', 1],
    ]);
    const draws = [...ctx.db.draws.values()];
    expect(draws).toHaveLength(1);
    expect(draws[0]).toMatchObject({ participantId: participant.id, prizeId: mugId, status: DrawStatus.Confirmed, claimedAt: null });
  });

  it('the next wheel no longer has the units already won', async () => {
    await register('Ana', 2);
    const { spin } = await register('Bruno', 1);

    expect(spin?.prize.id).toBe(shirtId);
    expect(spin?.wheel.map(({ prize, remainingUnits }) => [prize.name, remainingUnits])).toEqual([['Camiseta', 2]]);
  });

  it('takes as many participants as it has prizes: after that nobody registers nor gets a code', async () => {
    await register('Ana');
    await register('Bruno');
    await register('Carla');
    const sentBefore = ctx.emails.sent.length;

    await expect(register('Davi')).rejects.toMatchObject({ code: ErrorCode.PrizesExhausted });
    expect(ctx.emails.sent).toHaveLength(sentBefore);
    expect(ctx.db.participants.size).toBe(3);
    expect(ctx.db.draws.size).toBe(3);
  });

  it('whoever confirms after the last prize is gone is not registered', async () => {
    ctx.random.enqueue(0);
    const late = await ctx.useCases.startRegistration.execute({ eventId, name: 'Atrasada', phone: nextPhone(), email: 'late@mail.com' });
    await register('Ana');
    await register('Bruno');
    await register('Carla');

    await expect(
      ctx.useCases.confirmRegistration.execute({ eventId, verificationId: late.verification.id, code: ctx.emails.lastCodeFor('late@mail.com') }),
    ).rejects.toMatchObject({ code: ErrorCode.PrizesExhausted });
    expect(ctx.db.participants.size).toBe(3);
    expect(ctx.db.draws.size).toBe(3);
  });

  it('a voided spin gives the unit back to the wheel, and the prize can be handed over', async () => {
    const ana = await register('Ana');
    await register('Bruno');
    await register('Carla');
    await ctx.useCases.voidDraw.execute({ eventId, drawId: ana.spin!.draw.id });

    const { spin } = await register('Davi');
    expect(spin).not.toBeNull();
    const claimed = await ctx.useCases.claimPrize.execute({ eventId, drawId: spin!.draw.id });
    expect(claimed.draw.claimedAt).not.toBeNull();
  });

  it('the organizer neither draws nor registers people by hand', async () => {
    await expect(ctx.useCases.drawPrize.execute({ eventId })).rejects.toMatchObject({ code: ErrorCode.OrganizerDrawNotAllowed });
    await expect(ctx.useCases.drawPrize.execute({ eventId, prizeId: shirtId })).rejects.toMatchObject({
      code: ErrorCode.OrganizerDrawNotAllowed,
    });
    await expect(ctx.useCases.addParticipant.execute({ eventId, name: 'Manual', phone: nextPhone() })).rejects.toMatchObject({
      code: ErrorCode.ManualRegistrationNotAllowed,
    });
    await expect(
      ctx.useCases.importParticipants.execute({ eventId, entries: [{ name: 'Lista', phone: nextPhone() }] }),
    ).rejects.toMatchObject({ code: ErrorCode.ManualRegistrationNotAllowed });
    expect(ctx.db.participants.size).toBe(0);
  });

  it('the type can only change while the event has no participants', async () => {
    const { updateEvent, createEvent, addParticipant } = ctx.useCases;
    await updateEvent.execute({ eventId, changes: { drawMode: DrawMode.Prizes } });
    await updateEvent.execute({ eventId, changes: { drawMode: DrawMode.Interactive } });
    await register('Ana');
    await expect(updateEvent.execute({ eventId, changes: { drawMode: DrawMode.Prizes } })).rejects.toMatchObject({
      code: ErrorCode.DrawModeLocked,
    });
    // Other fields keep working, and so does sending the same type again.
    await updateEvent.execute({ eventId, changes: { name: 'Novo nome', drawMode: DrawMode.Interactive } });

    const classic = await createEvent.execute({ name: 'Clássico' });
    await addParticipant.execute({ eventId: classic.id, name: 'Zé', phone: nextPhone() });
    await updateEvent.execute({ eventId: classic.id, changes: { drawMode: DrawMode.Participants } });
    await expect(updateEvent.execute({ eventId: classic.id, changes: { drawMode: DrawMode.Interactive } })).rejects.toMatchObject({
      code: ErrorCode.DrawModeLocked,
    });
  });

  it('other event types are untouched: registering does not draw anything', async () => {
    const classic = await ctx.useCases.createEvent.execute({ name: 'Clássico', registrationOpen: true });
    ctx.random.enqueue(0);
    const { verification } = await ctx.useCases.startRegistration.execute({
      eventId: classic.id,
      name: 'Eva',
      phone: nextPhone(),
      email: 'eva@mail.com',
    });
    const { spin } = await ctx.useCases.confirmRegistration.execute({
      eventId: classic.id,
      verificationId: verification.id,
      code: ctx.emails.lastCodeFor('eva@mail.com'),
    });
    expect(spin).toBeNull();
    expect(ctx.db.draws.size).toBe(0);
  });
});
