import type { RequestHandler } from 'express';
import type { GetPublicEvent } from '../../../application/use-cases/events/GetPublicEvent.ts';
import type { ListActiveEvents } from '../../../application/use-cases/events/ListActiveEvents.ts';
import type { ConfirmRegistration } from '../../../application/use-cases/registration/ConfirmRegistration.ts';
import type { ResendRegistrationCode } from '../../../application/use-cases/registration/ResendRegistrationCode.ts';
import type { StartRegistration } from '../../../application/use-cases/registration/StartRegistration.ts';
import { presentActiveEvent, presentPublicEvent, presentRegistrationVerification } from '../presenters/presenters.ts';
import { parseInput, parseParams } from '../validation/parse.ts';
import {
  confirmRegistrationSchema,
  eventParamsSchema,
  startRegistrationSchema,
  verificationParamsSchema,
} from '../validation/schemas.ts';

export interface PublicEventUseCases {
  getPublicEvent: GetPublicEvent;
  listActiveEvents: ListActiveEvents;
  startRegistration: StartRegistration;
  confirmRegistration: ConfirmRegistration;
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
    const participant = await this.useCases.confirmRegistration.execute({ ...params, code });
    // Contact data is not echoed back on the public endpoint.
    res.status(201).json({ id: participant.id, name: participant.name });
  };

  resendCode: RequestHandler = async (req, res) => {
    const params = parseParams(verificationParamsSchema, req.params);
    const { verification, previewCode } = await this.useCases.resendRegistrationCode.execute(params);
    res.json(presentRegistrationVerification(verification, previewCode));
  };
}
