import express, { Router } from 'express';
import type { AuthenticateAdmin } from '../../../application/use-cases/auth/AuthenticateAdmin.ts';
import type { GetLiveBoard } from '../../../application/use-cases/live/GetLiveBoard.ts';
import type { TokenService } from '../../../application/ports/TokenService.ts';
import { AuthController } from '../controllers/AuthController.ts';
import { DrawController, type DrawUseCases } from '../controllers/DrawController.ts';
import { EventController, type EventUseCases } from '../controllers/EventController.ts';
import { LiveController } from '../controllers/LiveController.ts';
import { ParticipantController, type ParticipantUseCases } from '../controllers/ParticipantController.ts';
import { PrizeController, type PrizeUseCases } from '../controllers/PrizeController.ts';
import { PublicEventController, type PublicEventUseCases } from '../controllers/PublicEventController.ts';
import type { LiveBroadcaster } from '../live/LiveBroadcaster.ts';
import {
  createLiveStreamRateLimiter,
  createLoginRateLimiter,
  createRegistrationRateLimiter,
  type RateLimitOptions,
} from '../middlewares/rateLimiters.ts';
import { refreshLiveBoardAfterWrites } from '../middlewares/refreshLiveBoard.ts';
import { requireAuth } from '../middlewares/requireAuth.ts';

export type HttpUseCases = EventUseCases &
  ParticipantUseCases &
  PrizeUseCases &
  DrawUseCases &
  PublicEventUseCases & { authenticateAdmin: AuthenticateAdmin; getLiveBoard: GetLiveBoard };

export function createApiRouter(
  useCases: HttpUseCases,
  tokens: TokenService,
  live: LiveBroadcaster,
  rateLimits: RateLimitOptions = {},
): Router {
  const router = Router();
  const liveStream = new LiveController(live);
  const auth = new AuthController(useCases.authenticateAdmin);
  const events = new EventController(useCases);
  const participants = new ParticipantController(useCases);
  const prizes = new PrizeController(useCases);
  const draws = new DrawController(useCases);
  const publicEvents = new PublicEventController(useCases);

  router.use(refreshLiveBoardAfterWrites(live));

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.post('/auth/login', createLoginRateLimiter(rateLimits), auth.login);

  router.get('/public/events', publicEvents.list);
  router.get('/public/events/:eventId', publicEvents.show);
  router.get('/public/events/:eventId/prizes', publicEvents.prizes);
  const registrationLimiter = createRegistrationRateLimiter(rateLimits);
  router.post('/public/events/:eventId/registrations', registrationLimiter, publicEvents.startRegistration);
  router.post(
    '/public/events/:eventId/registrations/:verificationId/confirm',
    registrationLimiter,
    publicEvents.confirmRegistration,
  );
  router.post('/public/events/:eventId/registrations/:verificationId/resend', registrationLimiter, publicEvents.resendCode);
  router.get('/public/events/:eventId/live', createLiveStreamRateLimiter(rateLimits), liveStream.stream);
  router.get('/public/prizes/:prizeId/image', prizes.showImage);

  // Limit above the 2 MB domain rule, so oversized photos get the specific "too large" message.
  const imageBody = express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' });

  // Everything under /events is admin-only.
  const admin = Router();
  admin.use(requireAuth(tokens));

  admin.get('/', events.list);
  admin.post('/', events.create);
  admin.get('/:eventId', events.show);
  admin.patch('/:eventId', events.update);
  admin.delete('/:eventId', events.remove);

  admin.get('/:eventId/participants', participants.list);
  admin.post('/:eventId/participants', participants.create);
  admin.post('/:eventId/participants/import', participants.import);
  admin.delete('/:eventId/participants/:participantId', participants.remove);

  admin.get('/:eventId/prizes', prizes.list);
  admin.post('/:eventId/prizes', prizes.create);
  admin.patch('/:eventId/prizes/:prizeId', prizes.update);
  admin.delete('/:eventId/prizes/:prizeId', prizes.remove);
  admin.put('/:eventId/prizes/:prizeId/image', imageBody, prizes.uploadImage);
  admin.delete('/:eventId/prizes/:prizeId/image', prizes.removeImage);

  admin.get('/:eventId/draws', draws.list);
  admin.post('/:eventId/draws', draws.create);
  admin.post('/:eventId/draws/:drawId/void', draws.void);
  admin.post('/:eventId/draws/:drawId/claim', draws.claim);

  router.use('/events', admin);
  return router;
}
