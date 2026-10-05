import type { RequestHandler } from 'express';

const EVENT_ID_IN_PATH = /\/events\/([0-9a-f-]{36})(?:\/|$)/i;

/** After any successful write on an event, live viewers get the updated board. */
export function refreshLiveBoardAfterWrites(live: { refresh(eventId: string): void }): RequestHandler {
  return (req, res, next) => {
    const eventId = req.method === 'GET' || req.method === 'HEAD' ? undefined : EVENT_ID_IN_PATH.exec(req.path)?.[1];
    if (eventId) {
      res.on('finish', () => {
        if (res.statusCode < 400) live.refresh(eventId);
      });
    }
    next();
  };
}
