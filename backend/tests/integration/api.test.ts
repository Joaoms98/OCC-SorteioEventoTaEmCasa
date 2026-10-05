import type { Express } from 'express';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { JwtTokenService } from '../../src/infrastructure/security/JwtTokenService.ts';
import { createApp } from '../../src/presentation/http/app.ts';
import { LiveBroadcaster } from '../../src/presentation/http/live/LiveBroadcaster.ts';
import type { Logger } from '../../src/presentation/http/Logger.ts';
import { jpegBytes, PNG_BYTES } from '../doubles/images.ts';
import { makeTestUseCases, TEST_ADMIN_PASSWORD } from '../doubles/makeTestUseCases.ts';

const silentLogger: Logger = { info: () => {}, error: () => {} };
const UNKNOWN_ID = '00000000-0000-4000-8000-999999999999';

function setup(frontendDistPath?: string, clientIpHeader?: string) {
  const tokenService = new JwtTokenService('test-secret-with-at-least-32-characters!!', 3600);
  const { useCases, random, live, emails } = makeTestUseCases({ tokens: tokenService });
  const liveBroadcaster = new LiveBroadcaster(useCases.getLiveBoard, live, silentLogger);
  const app = createApp({
    useCases,
    tokenService,
    liveBroadcaster,
    isProduction: false,
    logger: silentLogger,
    frontendDistPath,
    clientIpHeader,
  });
  return { app, random, emails };
}

/** Public registration with the e-mail code (start + confirm). */
async function registerWithCode(
  app: ReturnType<typeof setup>['app'],
  emails: ReturnType<typeof setup>['emails'],
  eventId: string,
  data: { name: string; phone: string; email: string },
) {
  const started = await request(app).post(`/api/public/events/${eventId}/registrations`).send(data);
  if (started.status !== 201) return started;
  return request(app)
    .post(`/api/public/events/${eventId}/registrations/${started.body.verificationId}/confirm`)
    .send({ code: emails.lastCodeFor(data.email.trim().toLowerCase()) });
}

const ADMIN_ROUTES: Array<[method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string]> = [
  ['get', '/api/events'],
  ['post', '/api/events'],
  ['get', `/api/events/${UNKNOWN_ID}`],
  ['patch', `/api/events/${UNKNOWN_ID}`],
  ['delete', `/api/events/${UNKNOWN_ID}`],
  ['get', `/api/events/${UNKNOWN_ID}/participants`],
  ['post', `/api/events/${UNKNOWN_ID}/participants`],
  ['post', `/api/events/${UNKNOWN_ID}/participants/import`],
  ['delete', `/api/events/${UNKNOWN_ID}/participants/${UNKNOWN_ID}`],
  ['get', `/api/events/${UNKNOWN_ID}/prizes`],
  ['post', `/api/events/${UNKNOWN_ID}/prizes`],
  ['patch', `/api/events/${UNKNOWN_ID}/prizes/${UNKNOWN_ID}`],
  ['delete', `/api/events/${UNKNOWN_ID}/prizes/${UNKNOWN_ID}`],
  ['put', `/api/events/${UNKNOWN_ID}/prizes/${UNKNOWN_ID}/image`],
  ['delete', `/api/events/${UNKNOWN_ID}/prizes/${UNKNOWN_ID}/image`],
  ['get', `/api/events/${UNKNOWN_ID}/draws`],
  ['post', `/api/events/${UNKNOWN_ID}/draws`],
  ['post', `/api/events/${UNKNOWN_ID}/draws/${UNKNOWN_ID}/void`],
  ['post', `/api/events/${UNKNOWN_ID}/draws/${UNKNOWN_ID}/claim`],
];

describe('HTTP API', () => {
  let ctx: ReturnType<typeof setup>;
  let auth: { Authorization: string };

  beforeEach(async () => {
    ctx = setup();
    const login = await request(ctx.app).post('/api/auth/login').send({ password: TEST_ADMIN_PASSWORD });
    auth = { Authorization: `Bearer ${login.body.token}` };
  });

  it.each(ADMIN_ROUTES)('requires a token for %s %s', async (method, path) => {
    const response = await request(ctx.app)[method](path).expect(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('answers the health check', async () => {
    await request(ctx.app).get('/api/health').expect(200, { status: 'ok' });
  });

  it('allows local previews (blob:) of photos in the Content Security Policy', async () => {
    const response = await request(ctx.app).get('/api/health');
    expect(response.headers['content-security-policy']).toContain("img-src 'self' data: blob:");
  });

  describe('errors are returned with an English code and a Portuguese message', () => {
    it('wrong password', async () => {
      const response = await request(ctx.app).post('/api/auth/login').send({ password: 'nope' }).expect(401);
      expect(response.body).toEqual({ error: { code: 'INVALID_CREDENTIALS', message: 'Senha incorreta.' } });
    });

    it('missing or tampered token', async () => {
      const missing = await request(ctx.app).get('/api/events').expect(401);
      expect(missing.body.error).toEqual({
        code: 'UNAUTHORIZED',
        message: 'Sessão inválida ou expirada. Faça login novamente.',
      });
      await request(ctx.app).get('/api/events').set({ Authorization: 'Bearer abc.def.ghi' }).expect(401);
    });

    it('validation errors list each field', async () => {
      const response = await request(ctx.app).post('/api/events').set(auth).send({ name: '', eventDate: 'ontem', drawMode: 'DADOS' });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Dados inválidos. Verifique os campos informados.');
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          { field: 'name', message: 'Informe o nome do evento.' },
          { field: 'eventDate', message: 'Data do evento inválida.' },
          { field: 'drawMode', message: 'Escolha o tipo de roleta.' },
        ]),
      );
    });

    it('malformed JSON', async () => {
      const response = await request(ctx.app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"password":')
        .expect(400);
      expect(response.body.error).toEqual({
        code: 'INVALID_JSON',
        message: 'O corpo da requisição não é um JSON válido.',
      });
    });

    it('unknown routes and malformed ids', async () => {
      const route = await request(ctx.app).get('/api/nothing-here').expect(404);
      expect(route.body.error).toEqual({ code: 'ROUTE_NOT_FOUND', message: 'Rota não encontrada.' });

      const badId = await request(ctx.app).get('/api/events/not-a-uuid').set(auth).expect(404);
      expect(badId.body.error.code).toBe('RESOURCE_NOT_FOUND');

      const missing = await request(ctx.app).get(`/api/events/${UNKNOWN_ID}`).set(auth).expect(404);
      expect(missing.body.error).toEqual({ code: 'EVENT_NOT_FOUND', message: 'Evento não encontrado.' });
    });

    it('a JSON body that is not an object', async () => {
      const response = await request(ctx.app).post('/api/events').set(auth).send([{ name: 'x' }]).expect(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('domain validation errors keep the offending field', async () => {
      const event = await request(ctx.app).post('/api/events').set(auth).send({ name: 'Evento' });
      const response = await request(ctx.app)
        .post(`/api/events/${event.body.id}/participants`)
        .set(auth)
        .send({ name: 'Ana', phone: '123' })
        .expect(400);
      expect(response.body.error).toEqual({
        code: 'INVALID_PHONE',
        message: 'Telefone inválido. Informe o DDD e o número.',
        details: { field: 'phone' },
      });
    });
  });

  it('runs a whole raffle: event, participants, prize, draw, void and redraw', async () => {
    const event = await request(ctx.app)
      .post('/api/events')
      .set(auth)
      .send({ name: 'Tá em Casa', eventDate: '2026-11-20T19:00:00-03:00', registrationOpen: true })
      .expect(201);
    const eventId: string = event.body.id;
    expect(event.body.eventDate).toBe('2026-11-20T22:00:00.000Z');

    const imported = await request(ctx.app)
      .post(`/api/events/${eventId}/participants/import`)
      .set(auth)
      .send({ participants: [{ name: 'Ana', phone: '11911112222' }, { name: 'Bruno', phone: '11922223333' }, { name: '' }] })
      .expect(201);
    expect(imported.body).toEqual({
      created: 2,
      rejected: [
        {
          line: 3,
          name: '',
          code: 'INVALID_PARTICIPANT_NAME',
          message: 'O nome do participante é obrigatório e deve ter no máximo 120 caracteres.',
        },
      ],
    });

    const carla = await registerWithCode(ctx.app, ctx.emails, eventId, {
      name: 'Carla',
      phone: '(11) 93333-4444',
      email: 'carla@mail.com',
    });
    expect(carla.status).toBe(201);
    const duplicate = await request(ctx.app)
      .post(`/api/public/events/${eventId}/registrations`)
      .send({ name: 'Ana de novo', phone: '11 91111-2222', email: 'outra@mail.com' })
      .expect(409);
    expect(duplicate.body.error.message).toBe('Este telefone já está cadastrado neste evento.');

    const prize = await request(ctx.app)
      .post(`/api/events/${eventId}/prizes`)
      .set(auth)
      .send({ name: 'Kit de cabelo', quantity: 1 })
      .expect(201);
    expect(prize.body).toMatchObject({ quantity: 1, drawnUnits: 0, remainingUnits: 1 });

    ctx.random.enqueue(2);
    const draw = await request(ctx.app)
      .post(`/api/events/${eventId}/draws`)
      .set(auth)
      .send({ prizeId: prize.body.id })
      .expect(201);
    expect(draw.body).toMatchObject({
      status: 'CONFIRMED',
      participant: { name: 'Carla', phone: '11933334444' },
      prize: { name: 'Kit de cabelo' },
      remainingUnits: 0,
    });

    const rouletteEmpty = await request(ctx.app).post(`/api/events/${eventId}/draws`).set(auth).send({}).expect(422);
    expect(rouletteEmpty.body.error).toEqual({
      code: 'NO_PRIZES_AVAILABLE',
      message: 'Não há brindes disponíveis: todos já foram sorteados ou nenhum foi cadastrado.',
    });

    const outOfStock = await request(ctx.app)
      .post(`/api/events/${eventId}/draws`)
      .set(auth)
      .send({ prizeId: prize.body.id })
      .expect(422);
    expect(outOfStock.body.error.message).toBe('Todas as unidades deste brinde já foram sorteadas.');

    const voided = await request(ctx.app)
      .post(`/api/events/${eventId}/draws/${draw.body.id}/void`)
      .set(auth)
      .expect(200);
    expect(voided.body.status).toBe('VOIDED');

    await request(ctx.app).post(`/api/events/${eventId}/draws`).set(auth).send({ prizeId: prize.body.id }).expect(201);

    const overview = await request(ctx.app).get(`/api/events/${eventId}`).set(auth).expect(200);
    expect(overview.body.stats).toEqual({ participants: 3, eligibleParticipants: 1, prizeUnits: 1, drawnUnits: 1 });

    const draws = await request(ctx.app).get(`/api/events/${eventId}/draws`).set(auth).expect(200);
    expect(draws.body.map((item: { status: string }) => item.status)).toEqual(['CONFIRMED', 'VOIDED']);
  });

  it('public endpoints expose only what participants need', async () => {
    const event = await request(ctx.app).post('/api/events').set(auth).send({ name: 'Evento' });

    const publicEvent = await request(ctx.app).get(`/api/public/events/${event.body.id}`).expect(200);
    expect(Object.keys(publicEvent.body).sort()).toEqual(['description', 'drawMode', 'eventDate', 'id', 'name', 'registrationOpen']);

    const closed = await request(ctx.app)
      .post(`/api/public/events/${event.body.id}/registrations`)
      .send({ name: 'Ana', phone: '11911112222', email: 'ana@mail.com' })
      .expect(422);
    expect(closed.body.error.message).toBe('As inscrições para este evento estão encerradas.');
  });

  it('home page: lists active events without login and without internal fields', async () => {
    await request(ctx.app).post('/api/events').set(auth).send({ name: 'Rascunho' });
    const open = await request(ctx.app).post('/api/events').set(auth).send({ name: 'Aberto', registrationOpen: true });
    await request(ctx.app).post(`/api/events/${open.body.id}/prizes`).set(auth).send({ name: 'Kit', quantity: 3 });

    const listed = await request(ctx.app).get('/api/public/events').expect(200);

    expect(listed.body).toEqual([
      { id: open.body.id, name: 'Aberto', description: null, eventDate: null, registrationOpen: true, drawMode: 'PRIZES', remainingUnits: 3 },
    ]);
  });

  describe('public registration', () => {
    let eventId: string;

    beforeEach(async () => {
      const event = await request(ctx.app).post('/api/events').set(auth).send({ name: 'Evento', registrationOpen: true });
      eventId = event.body.id;
    });

    const register = (data: Record<string, string>) =>
      request(ctx.app).post(`/api/public/events/${eventId}/registrations`).send(data);

    it('requires phone and e-mail', async () => {
      const missing = await register({ name: 'Ana' });
      expect(missing.status).toBe(400);
      expect(missing.body.error.details).toEqual([
        { field: 'phone', message: 'Informe o telefone com DDD.' },
        { field: 'email', message: 'Informe seu e-mail.' },
      ]);

      const invalid = await register({ name: 'Ana', phone: '(00) 12345-6789', email: 'ana@mail.com' });
      expect(invalid.body.error).toMatchObject({ code: 'INVALID_PHONE', details: { field: 'phone' } });

      const badEmail = await register({ name: 'Ana', phone: '11987654321', email: 'ana@' });
      expect(badEmail.body.error).toMatchObject({ code: 'INVALID_EMAIL', message: 'E-mail inválido.' });
      expect(ctx.emails.sent).toHaveLength(0);
    });

    it('only registers after the e-mailed code is confirmed', async () => {
      const started = await register({ name: 'Ana Lima', phone: '+55 (11) 98765-4321', email: 'Ana@Mail.com' }).expect(201);
      expect(started.body).toEqual({
        verificationId: expect.any(String),
        email: 'an***@mail.com',
        expiresAt: expect.any(String),
        resendAvailableAt: expect.any(String),
      });
      expect(ctx.emails.sent).toEqual([expect.objectContaining({ to: 'ana@mail.com', name: 'Ana Lima', eventName: 'Evento' })]);

      const listBefore = await request(ctx.app).get(`/api/events/${eventId}/participants`).set(auth);
      expect(listBefore.body.total).toBe(0);

      const confirmPath = `/api/public/events/${eventId}/registrations/${started.body.verificationId}/confirm`;
      const code = ctx.emails.lastCodeFor('ana@mail.com');
      const wrong = await request(ctx.app).post(confirmPath).send({ code: code === '000000' ? '111111' : '000000' }).expect(400);
      expect(wrong.body.error).toEqual({
        code: 'INVALID_VERIFICATION_CODE',
        message: 'Código incorreto. Você tem mais 4 tentativas.',
        details: { attemptsLeft: 4 },
      });
      const badFormat = await request(ctx.app).post(confirmPath).send({ code: '12' }).expect(400);
      expect(badFormat.body.error.details).toEqual([
        { field: 'code', message: 'Informe o código de 6 números enviado por e-mail.' },
      ]);

      const confirmed = await request(ctx.app).post(confirmPath).send({ code }).expect(201);
      expect(confirmed.body).toEqual({ id: expect.any(String), name: 'Ana Lima' });
      const listAfter = await request(ctx.app).get(`/api/events/${eventId}/participants`).set(auth);
      expect(listAfter.body.items).toEqual([expect.objectContaining({ phone: '11987654321', email: 'ana@mail.com' })]);

      // The same code cannot be reused, and the same phone or e-mail cannot start again.
      await request(ctx.app).post(confirmPath).send({ code }).expect(404);
      const again = await register({ name: 'Ana', phone: '11987654321', email: 'nova@mail.com' }).expect(409);
      expect(again.body.error.message).toBe('Este telefone já está cadastrado neste evento.');
      const sameEmail = await register({ name: 'Ana', phone: '11911112222', email: 'ANA@mail.com' }).expect(409);
      expect(sameEmail.body.error.message).toBe('Este e-mail já está cadastrado neste evento.');
    });

    it('locks the code after 5 wrong attempts and lets the participant ask for a new one later', async () => {
      const started = await register({ name: 'Ana', phone: '11987654321', email: 'ana@mail.com' }).expect(201);
      const base = `/api/public/events/${eventId}/registrations/${started.body.verificationId}`;
      const code = ctx.emails.lastCodeFor('ana@mail.com');
      const wrongCode = code === '000000' ? '111111' : '000000';
      for (let attempt = 0; attempt < 4; attempt++) await request(ctx.app).post(`${base}/confirm`).send({ code: wrongCode }).expect(400);
      const locked = await request(ctx.app).post(`${base}/confirm`).send({ code: wrongCode }).expect(422);
      expect(locked.body.error.message).toBe('Muitas tentativas com código incorreto. Peça um novo código.');
      await request(ctx.app).post(`${base}/confirm`).send({ code }).expect(422);

      const tooSoon = await request(ctx.app).post(`${base}/resend`).expect(422);
      expect(tooSoon.body.error.code).toBe('VERIFICATION_RESEND_TOO_SOON');
      expect(tooSoon.body.error.message).toMatch(/^Aguarde \d+ segundos para pedir um novo código\.$/);
    });

    it('explains when the e-mail could not be sent', async () => {
      ctx.emails.failing = true;
      const response = await register({ name: 'Ana', phone: '11987654321', email: 'ana@mail.com' }).expect(503);
      expect(response.body.error).toEqual({
        code: 'EMAIL_DELIVERY_FAILED',
        message: 'Não foi possível enviar o e-mail com o código agora. Tente novamente em instantes.',
      });
    });

    it('no longer accepts direct registrations without the code', async () => {
      await request(ctx.app)
        .post(`/api/public/events/${eventId}/participants`)
        .send({ name: 'Ana', phone: '11987654321', email: 'ana@mail.com' })
        .expect(404);
    });
  });

  it('reports an oversized import line instead of rejecting the whole list', async () => {
    const event = await request(ctx.app).post('/api/events').set(auth).send({ name: 'Evento' });
    const response = await request(ctx.app)
      .post(`/api/events/${event.body.id}/participants/import`)
      .set(auth)
      .send({ participants: [{ name: 'Ana', phone: '11987654321' }, { name: 'x'.repeat(121), phone: '11912345678' }] })
      .expect(201);
    expect(response.body.created).toBe(1);
    expect(response.body.rejected).toEqual([expect.objectContaining({ line: 2, code: 'INVALID_PARTICIPANT_NAME' })]);
  });

  it('serves the SPA shell for client routes but 404 for missing files', async () => {
    const dist = mkdtempSync(join(tmpdir(), 'occ-dist-'));
    mkdirSync(join(dist, 'assets'));
    writeFileSync(join(dist, 'index.html'), '<!doctype html><title>SPA</title>');
    writeFileSync(join(dist, 'assets', 'app-abc123.js'), 'console.info(1)');
    const { app } = setup(dist);

    const page = await request(app).get('/events/123/draw').set('Accept', 'text/html').expect(200);
    expect(page.text).toContain('SPA');
    expect(page.headers['cache-control']).toBe('no-cache');

    const asset = await request(app).get('/assets/app-abc123.js').expect(200);
    expect(asset.headers['cache-control']).toContain('immutable');

    await request(app).get('/assets/old-chunk.js').set('Accept', '*/*').expect(404);
  });

  it('lets e-mail apps load the brand images (the logo of the verification e-mail)', async () => {
    const dist = mkdtempSync(join(tmpdir(), 'occ-dist-'));
    mkdirSync(join(dist, 'brand'));
    writeFileSync(join(dist, 'index.html'), '<!doctype html><title>SPA</title>');
    writeFileSync(join(dist, 'brand', 'occ-logo-email.png'), 'png');
    const { app } = setup(dist);

    const logo = await request(app).get('/brand/occ-logo-email.png').expect(200);
    expect(logo.headers['cross-origin-resource-policy']).toBe('cross-origin');
    const page = await request(app).get('/').set('Accept', 'text/html').expect(200);
    expect(page.headers['cross-origin-resource-policy']).not.toBe('cross-origin');
  });

  describe('prize photos', () => {
    let imagePath: string;

    beforeEach(async () => {
      const event = await request(ctx.app).post('/api/events').set(auth).send({ name: 'Evento' });
      const prize = await request(ctx.app).post(`/api/events/${event.body.id}/prizes`).set(auth).send({ name: 'Kit', quantity: 1 });
      expect(prize.body.imageUrl).toBeNull();
      imagePath = `/api/events/${event.body.id}/prizes/${prize.body.id}/image`;
    });

    it('uploads a photo and serves it publicly with long-lived caching', async () => {
      const uploaded = await request(ctx.app)
        .put(imagePath)
        .set(auth)
        .set('Content-Type', 'image/png')
        .send(Buffer.from(PNG_BYTES))
        .expect(200);
      expect(uploaded.body.imageUrl).toMatch(/^\/api\/public\/prizes\/[0-9a-f-]{36}\/image\?v=\d+$/);

      const image = await request(ctx.app).get(uploaded.body.imageUrl).expect(200);
      expect(image.headers['content-type']).toBe('image/png');
      expect(image.headers['cache-control']).toContain('immutable');
      expect(image.headers['cross-origin-resource-policy']).toBe('cross-origin');
      expect(Buffer.compare(image.body, Buffer.from(PNG_BYTES))).toBe(0);

      const removed = await request(ctx.app).delete(imagePath).set(auth).expect(200);
      expect(removed.body.imageUrl).toBeNull();
      const gone = await request(ctx.app).get(uploaded.body.imageUrl).expect(404);
      expect(gone.body.error).toEqual({ code: 'PRIZE_IMAGE_NOT_FOUND', message: 'Este brinde não tem foto.' });
    });

    it('rejects files that are not photos, whatever the declared type', async () => {
      const fake = await request(ctx.app)
        .put(imagePath)
        .set(auth)
        .set('Content-Type', 'image/png')
        .send(Buffer.from('<script>alert(1)</script>'))
        .expect(400);
      expect(fake.body.error).toEqual({
        code: 'INVALID_IMAGE',
        message: 'Imagem inválida. Envie uma foto em JPG, PNG ou WebP.',
      });

      const json = await request(ctx.app).put(imagePath).set(auth).send({ image: 'base64...' }).expect(400);
      expect(json.body.error.code).toBe('INVALID_IMAGE');
    });

    it('explains when the photo is too large', async () => {
      const response = await request(ctx.app)
        .put(imagePath)
        .set(auth)
        .set('Content-Type', 'image/jpeg')
        .send(Buffer.from(jpegBytes(2 * 1024 * 1024 + 10)))
        .expect(400);
      expect(response.body.error).toMatchObject({ code: 'IMAGE_TOO_LARGE', message: 'A foto deve ter no máximo 2 MB.' });
    });
  });

  it('rate limits failed logins', async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await request(ctx.app).post('/api/auth/login').send({ password: 'wrong' }).expect(401);
    }
    const blocked = await request(ctx.app).post('/api/auth/login').send({ password: 'wrong' }).expect(429);
    expect(blocked.body.error.message).toBe('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
  });

  describe('rate limits behind the hosting edge', () => {
    const failLogin = (app: Express, visitor?: string) => {
      const attempt = request(app).post('/api/auth/login').send({ password: 'wrong' });
      return visitor ? attempt.set('CF-Connecting-IP', visitor) : attempt;
    };

    it('counts per visitor when the edge header is configured: one visitor cannot lock the others out', async () => {
      const { app } = setup(undefined, 'cf-connecting-ip');
      for (let attempt = 0; attempt < 10; attempt += 1) await failLogin(app, '203.0.113.7').expect(401);

      await failLogin(app, '203.0.113.7').expect(429);
      await failLogin(app, '198.51.100.20').expect(401);
      // Not an address: falls back to the connection address instead of becoming a free new counter.
      for (let attempt = 0; attempt < 10; attempt += 1) await failLogin(app, `lixo-${attempt}`).expect(401);
      await failLogin(app, 'outro-lixo').expect(429);
    });

    it('ignores the header when it is not configured, so nobody dodges the limit by sending it', async () => {
      for (let attempt = 0; attempt < 10; attempt += 1) await failLogin(ctx.app, `203.0.113.${attempt}`).expect(401);
      await failLogin(ctx.app, '198.51.100.99').expect(429);
    });
  });
});
