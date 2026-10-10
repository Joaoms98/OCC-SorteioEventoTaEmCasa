import type { RequestHandler } from 'express';
import type { GetPublicEvent } from '../../../application/use-cases/events/GetPublicEvent.ts';
import type { ListActiveEvents } from '../../../application/use-cases/events/ListActiveEvents.ts';
import type { ListPrizes } from '../../../application/use-cases/prizes/ListPrizes.ts';
import type { ConfirmRegistration } from '../../../application/use-cases/registration/ConfirmRegistration.ts';
import type { RegisterAndSpin } from '../../../application/use-cases/registration/RegisterAndSpin.ts';
import type { ResendRegistrationCode } from '../../../application/use-cases/registration/ResendRegistrationCode.ts';
import type { StartRegistration } from '../../../application/use-cases/registration/StartRegistration.ts';
import {
  presentActiveEvent,
  presentPublicEvent,
  presentPublicPrize,
  presentRegistrationResult,
  presentRegistrationVerification,
  presentSpinResult,
} from '../presenters/presenters.ts';
import { parseInput, parseParams } from '../validation/parse.ts';
import {
  confirmRegistrationSchema,
  eventParamsSchema,
  registerAndSpinSchema,
  startRegistrationSchema,
  verificationParamsSchema,
} from '../validation/schemas.ts';

export interface PublicEventUseCases {
  getPublicEvent: GetPublicEvent;
  listActiveEvents: ListActiveEvents;
  listPrizes: ListPrizes;
  startRegistration: StartRegistration;
  confirmRegistration: ConfirmRegistration;
  registerAndSpin: RegisterAndSpin;
  resendRegistrationCode: ResendRegistrationCode;
}

export class PublicEventController {
  constructor(private readonly useCases: PublicEventUseCases) {}

  /** Home page: events open for registration or with prizes still to draw. */
  list: RequestHandler = async (_req, res) => {
    const events = await this.useCases.listActiveEvents.execute();
    res.json(events.map(presentActiveEvent));
  };

  show: RequestHandler = async (req, res) => {
    const { eventId } = parseParams(eventParamsSchema, req.params);
    const event = await this.useCases.getPublicEvent.execute({ eventId });
    res.json(presentPublicEvent(event));
  };

  /** Prizes of the event as the roulette shows them (name, photo, units left). */
  prizes: RequestHandler = async (req, res) => {
    const { eventId } = parseParams(eventParamsSchema, req.params);
    const prizes = await this.useCases.listPrizes.execute({ eventId });
    res.json(prizes.map(presentPublicPrize));
  };

  /** Step 1: validates the data and e-mails a code; nobody is registered yet. */
  startRegistration: RequestHandler = async (req, res) => {
    const { eventId } = parseParams(eventParamsSchema, req.params);
    const input = parseInput(startRegistrationSchema, req.body);
    const { verification, previewCode } = await this.useCases.startRegistration.execute({ eventId, ...input });
    res.status(201).json(presentRegistrationVerification(verification, previewCode));
  };

  /** Step 2: the right code creates the participant. */
  confirmRegistration: RequestHandler = async (req, res) => {
    const params = parseParams(verificationParamsSchema, req.params);
    const { code } = parseInput(confirmRegistrationSchema, req.body);
    const result = await this.useCases.confirmRegistration.execute({ ...params, code });
    res.status(201).json(presentRegistrationResult(result));
  };

  /** Interactive roulette: registers and draws the prize in one step, with no e-mail code. */
  registerAndSpin: RequestHandler = async (req, res) => {
    const { eventId } = parseParams(eventParamsSchema, req.params);
    const input = parseInput(registerAndSpinSchema, req.body);
    const result = await this.useCases.registerAndSpin.execute({ eventId, ...input });
    res.status(201).json(presentSpinResult(result));
  };

  resendCode: RequestHandler = async (req, res) => {
    const params = parseParams(verificationParamsSchema, req.params);
    const { verification, previewCode } = await this.useCases.resendRegistrationCode.execute(params);
    res.json(presentRegistrationVerification(verification, previewCode));
  };
}
