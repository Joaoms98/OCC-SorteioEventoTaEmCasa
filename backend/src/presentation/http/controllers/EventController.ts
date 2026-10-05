import type { RequestHandler } from 'express';
import type { CreateEvent } from '../../../application/use-cases/events/CreateEvent.ts';
import type { DeleteEvent } from '../../../application/use-cases/events/DeleteEvent.ts';
import type { GetEventOverview } from '../../../application/use-cases/events/GetEventOverview.ts';
import type { ListEvents } from '../../../application/use-cases/events/ListEvents.ts';
import type { UpdateEvent } from '../../../application/use-cases/events/UpdateEvent.ts';
import { presentEvent, presentEventOverview } from '../presenters/presenters.ts';
import { parseInput, parseParams } from '../validation/parse.ts';
import { createEventSchema, eventParamsSchema, updateEventSchema } from '../validation/schemas.ts';

export interface EventUseCases {
  createEvent: CreateEvent;
  listEvents: ListEvents;
  getEventOverview: GetEventOverview;
  updateEvent: UpdateEvent;
  deleteEvent: DeleteEvent;
}

export class EventController {
  constructor(private readonly useCases: EventUseCases) {}

  create: RequestHandler = async (req, res) => {
    const input = parseInput(createEventSchema, req.body);
    const event = await this.useCases.createEvent.execute(input);
    res.status(201).json(presentEvent(event));
  };

  list: RequestHandler = async (_req, res) => {
    const events = await this.useCases.listEvents.execute();
    res.json(events.map(presentEvent));
  };

  show: RequestHandler = async (req, res) => {
    const { eventId } = parseParams(eventParamsSchema, req.params);
    const overview = await this.useCases.getEventOverview.execute({ eventId });
    res.json(presentEventOverview(overview));
  };

  update: RequestHandler = async (req, res) => {
    const { eventId } = parseParams(eventParamsSchema, req.params);
    const changes = parseInput(updateEventSchema, req.body);
    const event = await this.useCases.updateEvent.execute({ eventId, changes });
    res.json(presentEvent(event));
  };

  remove: RequestHandler = async (req, res) => {
    const { eventId } = parseParams(eventParamsSchema, req.params);
    await this.useCases.deleteEvent.execute({ eventId });
    res.status(204).end();
  };
}
