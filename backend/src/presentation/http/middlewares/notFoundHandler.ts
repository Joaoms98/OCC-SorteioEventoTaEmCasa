import type { RequestHandler } from 'express';
import { HttpErrorCode } from '../errors/HttpErrorCode.ts';
import { sendError } from '../errors/sendError.ts';

export const notFoundHandler: RequestHandler = (_req, res) => sendError(res, 404, HttpErrorCode.RouteNotFound);
