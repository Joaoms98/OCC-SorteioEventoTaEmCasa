import { isIP } from 'node:net';
import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { HttpErrorCode } from '../errors/HttpErrorCode.ts';
import { sendError } from '../errors/sendError.ts';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

export interface RateLimitOptions {
  /**
   * Header in which the hosting edge puts the visitor's real address (Render: `cf-connecting-ip`).
   * Behind such an edge the connection comes from the edge itself, so without it everybody would
   * share the same counters. Only set it when every request passes through that edge: anywhere
   * else a visitor could send the header and dodge the limits.
   */
  clientIpHeader?: string;
}

/** Counters are kept per visitor address (IPv6 by /56 block, as express-rate-limit recommends). */
function visitorKey({ clientIpHeader }: RateLimitOptions) {
  return (req: Request): string => {
    const fromEdge = clientIpHeader ? req.get(clientIpHeader)?.trim() : undefined;
    return ipKeyGenerator(fromEdge && isIP(fromEdge) ? fromEdge : (req.ip ?? 'unknown'));
  };
}

function createLimiter(limit: number, options: RateLimitOptions, skipSuccessfulRequests = false): RequestHandler {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES_MS,
    limit,
    skipSuccessfulRequests,
    keyGenerator: visitorKey(options),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => sendError(res, 429, HttpErrorCode.TooManyRequests),
  });
}

/** Brute-force protection: only failed logins count. */
export const createLoginRateLimiter = (options: RateLimitOptions = {}): RequestHandler => createLimiter(10, options, true);

/** Generous on purpose: at the venue many phones may share the same Wi-Fi public IP. */
export const createRegistrationRateLimiter = (options: RateLimitOptions = {}): RequestHandler => createLimiter(300, options);

/** Live viewers reconnect on their own after network hiccups; this only stops connection floods. */
export const createLiveStreamRateLimiter = (options: RateLimitOptions = {}): RequestHandler => createLimiter(1000, options);
