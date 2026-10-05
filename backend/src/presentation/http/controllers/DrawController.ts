import type { RequestHandler } from 'express';
import type { ClaimPrize } from '../../../application/use-cases/draws/ClaimPrize.ts';
import type { DrawPrize } from '../../../application/use-cases/draws/DrawPrize.ts';
import type { ListDraws } from '../../../application/use-cases/draws/ListDraws.ts';
import type { VoidDraw } from '../../../application/use-cases/draws/VoidDraw.ts';
import { presentWheel } from '../presenters/livePresenters.ts';
import { presentDraw } from '../presenters/presenters.ts';
import { parseInput, parseParams } from '../validation/parse.ts';
import { createDrawSchema, drawParamsSchema, eventParamsSchema } from '../validation/schemas.ts';

export interface DrawUseCases {
  drawPrize: DrawPrize;
  listDraws: ListDraws;
  voidDraw: VoidDraw;
  claimPrize: ClaimPrize;
}

export class DrawController {
  constructor(private readonly useCases: DrawUseCases) {}

  create: RequestHandler = async (req, res) => {
    const { eventId } = parseParams(eventParamsSchema, req.params);
    const { prizeId } = parseInput(createDrawSchema, req.body);
    const result = await this.useCases.drawPrize.execute({ eventId, prizeId });
    const now = Date.now();
    res.status(201).json({
      ...presentDraw(result),
      remainingUnits: result.remainingUnits,
      // The projector lands the wheel and reveals the winner together with the live audience.
      landingInMs: Math.max(result.landingAt.getTime() - now, 0),
      revealInMs: Math.max(result.revealAt.getTime() - now, 0),
      wheel: presentWheel(result.wheel),
    });
  };

  list: RequestHandler = async (req, res) => {
    const { eventId } = parseParams(eventParamsSchema, req.params);
    const draws = await this.useCases.listDraws.execute({ eventId });
    res.json(draws.map(presentDraw));
  };

  void: RequestHandler = async (req, res) => {
    const params = parseParams(drawParamsSchema, req.params);
    const draw = await this.useCases.voidDraw.execute(params);
    res.json(presentDraw(draw));
  };

  claim: RequestHandler = async (req, res) => {
    const params = parseParams(drawParamsSchema, req.params);
    const draw = await this.useCases.claimPrize.execute(params);
    res.json(presentDraw(draw));
  };
}
