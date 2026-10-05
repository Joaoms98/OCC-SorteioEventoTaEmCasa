import type { Clock } from '../application/ports/Clock.ts';
import type { EmailSender } from '../application/ports/EmailSender.ts';
import type { IdGenerator } from '../application/ports/IdGenerator.ts';
import type { LiveDrawChannel } from '../application/ports/LiveDrawChannel.ts';
import type { PasswordVerifier } from '../application/ports/PasswordVerifier.ts';
import type { RandomNumberGenerator } from '../application/ports/RandomNumberGenerator.ts';
import type { TokenService } from '../application/ports/TokenService.ts';
import type { TransactionManager } from '../application/ports/TransactionManager.ts';
import type { VerificationCodeHasher } from '../application/ports/VerificationCodeHasher.ts';
import { AuthenticateAdmin } from '../application/use-cases/auth/AuthenticateAdmin.ts';
import { ClaimPrize } from '../application/use-cases/draws/ClaimPrize.ts';
import { DrawPrize } from '../application/use-cases/draws/DrawPrize.ts';
import { ListDraws } from '../application/use-cases/draws/ListDraws.ts';
import { VoidDraw } from '../application/use-cases/draws/VoidDraw.ts';
import { CreateEvent } from '../application/use-cases/events/CreateEvent.ts';
import { DeleteEvent } from '../application/use-cases/events/DeleteEvent.ts';
import { GetEventOverview } from '../application/use-cases/events/GetEventOverview.ts';
import { GetPublicEvent } from '../application/use-cases/events/GetPublicEvent.ts';
import { ListActiveEvents } from '../application/use-cases/events/ListActiveEvents.ts';
import { ListEvents } from '../application/use-cases/events/ListEvents.ts';
import { GetLiveBoard } from '../application/use-cases/live/GetLiveBoard.ts';
import { UpdateEvent } from '../application/use-cases/events/UpdateEvent.ts';
import { AddParticipant } from '../application/use-cases/participants/AddParticipant.ts';
import { ImportParticipants } from '../application/use-cases/participants/ImportParticipants.ts';
import { ListParticipants } from '../application/use-cases/participants/ListParticipants.ts';
import { RemoveParticipant } from '../application/use-cases/participants/RemoveParticipant.ts';
import { CreatePrize } from '../application/use-cases/prizes/CreatePrize.ts';
import { DeletePrize } from '../application/use-cases/prizes/DeletePrize.ts';
import { GetPrizeImage } from '../application/use-cases/prizes/GetPrizeImage.ts';
import { ListPrizes } from '../application/use-cases/prizes/ListPrizes.ts';
import { RemovePrizeImage } from '../application/use-cases/prizes/RemovePrizeImage.ts';
import { SetPrizeImage } from '../application/use-cases/prizes/SetPrizeImage.ts';
import { UpdatePrize } from '../application/use-cases/prizes/UpdatePrize.ts';
import { ConfirmRegistration } from '../application/use-cases/registration/ConfirmRegistration.ts';
import { ResendRegistrationCode } from '../application/use-cases/registration/ResendRegistrationCode.ts';
import { StartRegistration } from '../application/use-cases/registration/StartRegistration.ts';
import type { DrawRepository } from '../domain/repositories/DrawRepository.ts';
import type { EventRepository } from '../domain/repositories/EventRepository.ts';
import type { ParticipantRepository } from '../domain/repositories/ParticipantRepository.ts';
import type { PrizeImageRepository } from '../domain/repositories/PrizeImageRepository.ts';
import type { PrizeRepository } from '../domain/repositories/PrizeRepository.ts';
import type { RegistrationVerificationRepository } from '../domain/repositories/RegistrationVerificationRepository.ts';
import type { HttpUseCases } from '../presentation/http/routes/createApiRouter.ts';

export interface UseCaseDependencies {
  events: EventRepository;
  participants: ParticipantRepository;
  prizes: PrizeRepository;
  prizeImages: PrizeImageRepository;
  draws: DrawRepository;
  transaction: TransactionManager;
  ids: IdGenerator;
  clock: Clock;
  random: RandomNumberGenerator;
  passwordVerifier: PasswordVerifier;
  tokens: TokenService;
  live: LiveDrawChannel;
  verifications: RegistrationVerificationRepository;
  codeHasher: VerificationCodeHasher;
  emailSender: EmailSender;
}

/** Wires every use case to its ports. Shared by the server and the HTTP integration tests. */
export function makeUseCases(deps: UseCaseDependencies): HttpUseCases {
  const { events, participants, prizes, draws, transaction, ids, clock, random, live } = deps;

  return {
    authenticateAdmin: new AuthenticateAdmin(deps.passwordVerifier, deps.tokens),

    createEvent: new CreateEvent(events, ids, clock),
    listEvents: new ListEvents(events),
    getEventOverview: new GetEventOverview(events, participants, prizes, draws),
    getPublicEvent: new GetPublicEvent(events),
    listActiveEvents: new ListActiveEvents(events),
    updateEvent: new UpdateEvent(events, clock),
    deleteEvent: new DeleteEvent(events),

    addParticipant: new AddParticipant(events, participants, ids, clock),
    importParticipants: new ImportParticipants(events, participants, ids, clock),
    listParticipants: new ListParticipants(events, participants),
    removeParticipant: new RemoveParticipant(transaction, events, participants, draws),

    createPrize: new CreatePrize(events, prizes, ids, clock),
    listPrizes: new ListPrizes(events, prizes, draws),
    updatePrize: new UpdatePrize(transaction, events, prizes, draws, clock),
    deletePrize: new DeletePrize(transaction, events, prizes, draws),
    setPrizeImage: new SetPrizeImage(transaction, prizes, deps.prizeImages, draws, clock),
    removePrizeImage: new RemovePrizeImage(transaction, prizes, deps.prizeImages, draws, clock),
    getPrizeImage: new GetPrizeImage(deps.prizeImages),

    drawPrize: new DrawPrize(transaction, events, participants, prizes, draws, random, ids, clock, live),
    listDraws: new ListDraws(events, draws),
    voidDraw: new VoidDraw(transaction, events, draws, clock, live),
    claimPrize: new ClaimPrize(transaction, events, draws, clock, live),

    getLiveBoard: new GetLiveBoard(events, participants, prizes, draws, live, random),

    startRegistration: new StartRegistration(
      events, participants, deps.verifications, deps.codeHasher, deps.emailSender, random, ids, clock,
    ),
    confirmRegistration: new ConfirmRegistration(
      transaction, events, participants, deps.verifications, deps.codeHasher, ids, clock,
    ),
    resendRegistrationCode: new ResendRegistrationCode(
      events, deps.verifications, deps.codeHasher, deps.emailSender, random, clock,
    ),
  };
}
