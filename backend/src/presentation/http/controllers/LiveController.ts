import type { RequestHandler } from 'express';
import type { LiveBroadcaster } from '../live/LiveBroadcaster.ts';
import { parseParams } from '../validation/parse.ts';
import { eventParamsSchema } from '../validation/schemas.ts';

export class LiveController {
  constructor(private readonly broadcaster: LiveBroadcaster) {}

  /** Server-Sent Events stream of the event's live draw (public). */
  stream: RequestHandler = async (req, res) => {
    const { eventId } = parseParams(eventParamsSchema, req.params);
    await this.broadcaster.connect(eventId, req, res);
  };
}
