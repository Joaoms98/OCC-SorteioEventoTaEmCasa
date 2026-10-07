import { execSync } from 'node:child_process';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ErrorCode } from '../../../src/domain/errors/ErrorCode.ts';
import { PrismaContext } from '../../../src/infrastructure/database/prisma/PrismaContext.ts';
import { PrismaTransactionManager } from '../../../src/infrastructure/database/prisma/PrismaTransactionManager.ts';
import { PrismaDrawRepository } from '../../../src/infrastructure/database/prisma/repositories/PrismaDrawRepository.ts';
import { PrismaEventRepository } from '../../../src/infrastructure/database/prisma/repositories/PrismaEventRepository.ts';
import { PrismaParticipantRepository } from '../../../src/infrastructure/database/prisma/repositories/PrismaParticipantRepository.ts';
import { PrismaPrizeImageRepository } from '../../../src/infrastructure/database/prisma/repositories/PrismaPrizeImageRepository.ts';
import { PrismaPrizeRepository } from '../../../src/infrastructure/database/prisma/repositories/PrismaPrizeRepository.ts';
import { PrismaRegistrationVerificationRepository } from '../../../src/infrastructure/database/prisma/repositories/PrismaRegistrationVerificationRepository.ts';
import { HmacVerificationCodeHasher } from '../../../src/infrastructure/security/HmacVerificationCodeHasher.ts';
import { FakeEmailSender } from '../../doubles/fakes.ts';
import type { LiveDrawChannel } from '../../../src/application/ports/LiveDrawChannel.ts';
import { InMemoryLiveDrawChannel } from '../../../src/infrastructure/live/InMemoryLiveDrawChannel.ts';
import { CryptoIdGenerator } from '../../../src/infrastructure/services/CryptoIdGenerator.ts';
import { CryptoRandomNumberGenerator } from '../../../src/infrastructure/services/CryptoRandomNumberGenerator.ts';
import { SystemClock } from '../../../src/infrastructure/services/SystemClock.ts';
import { makeUseCases } from '../../../src/main/makeUseCases.ts';

/**
 * Runs against a real PostgreSQL (the database is wiped!). Opt-in:
 *   TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/occ_raffle_test npm run test:db -w backend
 */
const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)('Prisma repositories on PostgreSQL', () => {
  let database: PrismaContext;
  let repositories: {
    participants: PrismaParticipantRepository;
    prizes: PrismaPrizeRepository;
  };
  let useCases: ReturnType<typeof makeUseCases>;

  function buildUseCases(live: LiveDrawChannel) {
    return makeUseCases({
      events: new PrismaEventRepository(database),
      participants: repositories.participants,
      prizes: repositories.prizes,
      prizeImages: new PrismaPrizeImageRepository(database),
      draws: new PrismaDrawRepository(database),
      transaction: new PrismaTransactionManager(database),
      ids: new CryptoIdGenerator(),
      clock: new SystemClock(),
      random: new CryptoRandomNumberGenerator(),
      passwordVerifier: { verify: () => true },
      tokens: { issue: () => ({ token: 't', expiresInSeconds: 1 }), verify: () => null },
      live,
      verifications: new PrismaRegistrationVerificationRepository(database),
      codeHasher: new HmacVerificationCodeHasher('test-secret'),
      emailSender: emails,
    });
  }
  const emails = new FakeEmailSender();

  beforeAll(() => {
    const url = databaseUrl as string;
    execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url }, stdio: 'ignore' });
    database = PrismaContext.connect(url);
    repositories = {
      participants: new PrismaParticipantRepository(database),
      prizes: new PrismaPrizeRepository(database),
    };
    useCases = buildUseCases(new InMemoryLiveDrawChannel(new SystemClock(), 0));
  });

  beforeEach(async () => {
    await database.prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "registration_verifications", "prize_images", "draws", "participants", "prizes", "events"',
    );
  });

  afterAll(async () => {
    await database?.disconnect();
  });

  async function seedEvent(participantCount: number, quantity: number) {
    const event = await useCases.createEvent.execute({ name: 'Evento de teste' });
    await useCases.importParticipants.execute({
      eventId: event.id,
      entries: Array.from({ length: participantCount }, (_, index) => ({
        name: `Pessoa ${index + 1}`,
        phone: `119${String(10_000_000 + index).slice(-8)}`,
      })),
    });
    const { prize } = await useCases.createPrize.execute({ eventId: event.id, name: 'Kit', quantity });
    return { eventId: event.id, prizeId: prize.id };
  }

  it('database lock alone keeps concurrent draws within stock and without repeated winners', async () => {
    const { eventId, prizeId } = await seedEvent(20, 3);
    // A stage that never refuses, so the requests really race inside PostgreSQL.
    const permissiveStage: LiveDrawChannel = {
      claim: () => true,
      release: () => {},
      start: () => ({ landingAt: new Date(), revealAt: new Date() }),
      voided: () => {},
      claimed: () => {},
      pending: () => null,
      subscribe: () => () => {},
    };
    const racing = buildUseCases(permissiveStage);

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => racing.drawPrize.execute({ eventId, prizeId })),
    );

    const winners = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value.participant.id] : []));
    const failures = results.flatMap((result) => (result.status === 'rejected' ? [result.reason.code] : []));
    expect(winners).toHaveLength(3);
    expect(new Set(winners).size).toBe(3);
    expect(new Set(failures)).toEqual(new Set([ErrorCode.PrizeOutOfStock]));
  });

  it('participant roulette: the wheel holds the winner once, among names never drawn', async () => {
    const { eventId, prizeId } = await seedEvent(5, 3);
    await useCases.updateEvent.execute({ eventId, changes: { drawMode: 'PARTICIPANTS' } });
    const first = await useCases.drawPrize.execute({ eventId, prizeId });
    const second = await useCases.drawPrize.execute({ eventId, prizeId });

    expect(first.wheel?.names).toHaveLength(5);
    expect(second.wheel?.names).toHaveLength(4);
    expect(second.wheel?.names).not.toContain(first.participant.name);
    expect(second.wheel?.names.filter((name) => name === second.participant.name)).toHaveLength(1);
    expect(second.wheel?.names[second.wheel.winnerSlot]).toBe(second.participant.name);
  });

  it('home page: active events with their remaining units, counting only confirmed draws', async () => {
    const { eventId, prizeId } = await seedEvent(3, 2);
    await useCases.createPrize.execute({ eventId, name: 'Caneca', quantity: 4 });
    await useCases.createEvent.execute({ name: 'Rascunho vazio' });
    const voided = await useCases.drawPrize.execute({ eventId, prizeId });
    await useCases.voidDraw.execute({ eventId, drawId: voided.draw.id });
    await useCases.drawPrize.execute({ eventId, prizeId });

    const listed = await useCases.listActiveEvents.execute();

    expect(listed.map(({ event, remainingUnits }) => [event.id, remainingUnits])).toEqual([[eventId, 5]]);
  });

  it('interactive roulette: simultaneous registrations never give away more prizes than there are', async () => {
    const event = await useCases.createEvent.execute({ name: 'Interativa', registrationOpen: true, drawMode: 'INTERACTIVE' });
    await useCases.createPrize.execute({ eventId: event.id, name: 'Camiseta', quantity: 2 });
    await useCases.createPrize.execute({ eventId: event.id, name: 'Caneca', quantity: 1 });
    const people = Array.from({ length: 8 }, (_, index) => ({
      name: `Pessoa ${index}`,
      phone: `119${String(20_000_000 + index)}`,
      email: `pessoa${index}@mail.com`,
    }));
    const started = [];
    for (const person of people) started.push(await useCases.startRegistration.execute({ eventId: event.id, ...person }));

    const results = await Promise.allSettled(
      started.map(({ verification }, index) =>
        useCases.confirmRegistration.execute({
          eventId: event.id,
          verificationId: verification.id,
          code: emails.lastCodeFor(people[index]!.email),
        }),
      ),
    );

    const winners = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
    const refused = results.flatMap((result) => (result.status === 'rejected' ? [result.reason.code] : []));
    expect(winners).toHaveLength(3);
    expect(new Set(refused)).toEqual(new Set([ErrorCode.PrizesExhausted]));
    expect(winners.map(({ spin }) => spin?.prize.name).sort()).toEqual(['Camiseta', 'Camiseta', 'Caneca']);
    // Nobody is registered without a prize, and nobody has two.
    expect(await database.prisma.participant.count({ where: { eventId: event.id } })).toBe(3);
    expect(await database.prisma.draw.count({ where: { eventId: event.id } })).toBe(3);
    await expect(useCases.startRegistration.execute({ eventId: event.id, name: 'Tarde', phone: '11930000000', email: 't@mail.com' })).rejects.toMatchObject({
      code: ErrorCode.PrizesExhausted,
    });
    const listed = await useCases.listActiveEvents.execute();
    expect(listed.find((item) => item.event.id === event.id)).toMatchObject({ remainingUnits: 0 });
  });

  it('live stage accepts one draw at a time', async () => {
    const { eventId, prizeId } = await seedEvent(20, 3);
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => useCases.drawPrize.execute({ eventId, prizeId })),
    );
    const failures = results.flatMap((result) => (result.status === 'rejected' ? [result.reason.code] : []));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(new Set(failures)).toEqual(new Set([ErrorCode.DrawInProgress]));
  });

  it('keeps voided winners ineligible while giving the unit back', async () => {
    const { eventId, prizeId } = await seedEvent(2, 2);
    const first = await useCases.drawPrize.execute({ eventId, prizeId });
    await useCases.voidDraw.execute({ eventId, drawId: first.draw.id });

    const second = await useCases.drawPrize.execute({ eventId, prizeId });
    expect(second.participant.id).not.toBe(first.participant.id);
    await expect(useCases.drawPrize.execute({ eventId, prizeId })).rejects.toMatchObject({
      code: ErrorCode.NoEligibleParticipants,
    });

    const { stats } = await useCases.getEventOverview.execute({ eventId });
    expect(stats).toEqual({ participants: 2, eligibleParticipants: 0, prizeUnits: 2, drawnUnits: 1 });
  });

  it('turns concurrent registrations with the same phone into a conflict', async () => {
    const event = await useCases.createEvent.execute({ name: 'Evento', registrationOpen: true });
    const register = () => useCases.addParticipant.execute({ eventId: event.id, name: 'Ana', phone: '11987654321' });

    const results = await Promise.allSettled([register(), register(), register()]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    for (const result of results) {
      if (result.status === 'rejected') expect(result.reason.code).toBe(ErrorCode.ParticipantAlreadyRegistered);
    }
  });

  it('maps foreign key violations to conflicts when deleting drawn records', async () => {
    const { eventId, prizeId } = await seedEvent(1, 1);
    const { participant } = await useCases.drawPrize.execute({ eventId, prizeId });

    await expect(repositories.participants.delete(participant.id)).rejects.toMatchObject({
      code: ErrorCode.ParticipantHasDraw,
    });
    await expect(repositories.prizes.delete(prizeId)).rejects.toMatchObject({ code: ErrorCode.PrizeHasDraws });
  });

  it('persists prize claims and keeps claimed draws from being voided', async () => {
    const { eventId, prizeId } = await seedEvent(2, 1);
    const { draw } = await useCases.drawPrize.execute({ eventId, prizeId });

    const claimed = await useCases.claimPrize.execute({ eventId, drawId: draw.id });
    expect(claimed.draw.claimedAt).toBeInstanceOf(Date);

    const [stored] = await useCases.listDraws.execute({ eventId });
    expect(stored?.draw.claimedAt?.getTime()).toBe(claimed.draw.claimedAt?.getTime());
    await expect(useCases.voidDraw.execute({ eventId, drawId: draw.id })).rejects.toMatchObject({
      code: ErrorCode.PrizeAlreadyClaimed,
    });
  });

  it('stores prize photos in the database and drops them with the prize', async () => {
    const event = await useCases.createEvent.execute({ name: 'Evento' });
    const { prize } = await useCases.createPrize.execute({ eventId: event.id, name: 'Kit', quantity: 1 });
    const png = Uint8Array.from(
      Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'),
    );

    await useCases.setPrizeImage.execute({ eventId: event.id, prizeId: prize.id, data: png });
    const stored = await useCases.getPrizeImage.execute({ prizeId: prize.id });
    expect(stored.contentType).toBe('image/png');
    expect(Buffer.compare(Buffer.from(stored.data), Buffer.from(png))).toBe(0);

    const [listed] = await useCases.listPrizes.execute({ eventId: event.id });
    expect(listed?.prize.imageUpdatedAt).toBeInstanceOf(Date);

    await useCases.deletePrize.execute({ eventId: event.id, prizeId: prize.id });
    expect(await database.prisma.prizeImage.count()).toBe(0);
  });

  it('registers through the e-mail code and keeps only one registration per contact', async () => {
    const event = await useCases.createEvent.execute({ name: 'Evento', registrationOpen: true });
    const data = { eventId: event.id, name: 'Ana Lima', phone: '11987654321', email: 'ana@mail.com' };
    const { verification } = await useCases.startRegistration.execute(data);

    await expect(
      useCases.confirmRegistration.execute({
        eventId: event.id,
        verificationId: verification.id,
        code: emails.lastCodeFor('ana@mail.com') === '000000' ? '111111' : '000000',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.InvalidVerificationCode, details: { attemptsLeft: 4 } });

    const { participant, spin } = await useCases.confirmRegistration.execute({
      eventId: event.id,
      verificationId: verification.id,
      code: emails.lastCodeFor('ana@mail.com'),
    });
    expect(participant.email).toBe('ana@mail.com');
    expect(spin).toBeNull();
    expect(await database.prisma.registrationVerification.count()).toBe(0);
    await expect(useCases.startRegistration.execute(data)).rejects.toMatchObject({
      code: ErrorCode.ParticipantAlreadyRegistered,
    });
  });

  it('searches by name, e-mail or phone and deletes events in cascade', async () => {
    const event = await useCases.createEvent.execute({ name: 'Evento' });
    await useCases.addParticipant.execute({ eventId: event.id, name: 'Mariana', phone: '11955554444', email: 'MARI@mail.com' });
    await useCases.addParticipant.execute({ eventId: event.id, name: 'Bruno', phone: '(21) 99999-0000' });
    const list = (search: string) => useCases.listParticipants.execute({ eventId: event.id, search, page: 1, pageSize: 10 });

    expect((await list('mari')).items.map((p) => p.name)).toEqual(['Mariana']);
    expect((await list('mari@MAIL')).total).toBe(1);
    expect((await list('(21) 99999')).items.map((p) => p.name)).toEqual(['Bruno']);

    const { prize } = await useCases.createPrize.execute({ eventId: event.id, name: 'Kit', quantity: 1 });
    await useCases.drawPrize.execute({ eventId: event.id, prizeId: prize.id });
    await useCases.deleteEvent.execute({ eventId: event.id });

    expect(await database.prisma.participant.count()).toBe(0);
    expect(await database.prisma.draw.count()).toBe(0);
  });
});
