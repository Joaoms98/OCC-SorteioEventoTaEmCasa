import type { RequestHandler } from 'express';
import type { CreatePrize } from '../../../application/use-cases/prizes/CreatePrize.ts';
import type { DeletePrize } from '../../../application/use-cases/prizes/DeletePrize.ts';
import type { GetPrizeImage } from '../../../application/use-cases/prizes/GetPrizeImage.ts';
import type { ListPrizes } from '../../../application/use-cases/prizes/ListPrizes.ts';
import type { RemovePrizeImage } from '../../../application/use-cases/prizes/RemovePrizeImage.ts';
import type { SetPrizeImage } from '../../../application/use-cases/prizes/SetPrizeImage.ts';
import type { UpdatePrize } from '../../../application/use-cases/prizes/UpdatePrize.ts';
import { presentPrize } from '../presenters/presenters.ts';
import { parseInput, parseParams } from '../validation/parse.ts';
import {
  createPrizeSchema,
  eventParamsSchema,
  prizeIdParamsSchema,
  prizeParamsSchema,
  updatePrizeSchema,
} from '../validation/schemas.ts';

const ONE_YEAR_SECONDS = 31_536_000;

export interface PrizeUseCases {
  createPrize: CreatePrize;
  listPrizes: ListPrizes;
  updatePrize: UpdatePrize;
  deletePrize: DeletePrize;
  setPrizeImage: SetPrizeImage;
  removePrizeImage: RemovePrizeImage;
  getPrizeImage: GetPrizeImage;
}

export class PrizeController {
  constructor(private readonly useCases: PrizeUseCases) {}

  create: RequestHandler = async (req, res) => {
    const { eventId } = parseParams(eventParamsSchema, req.params);
    const input = parseInput(createPrizeSchema, req.body);
    const prize = await this.useCases.createPrize.execute({ eventId, ...input });
    res.status(201).json(presentPrize(prize));
  };

  list: RequestHandler = async (req, res) => {
    const { eventId } = parseParams(eventParamsSchema, req.params);
    const prizes = await this.useCases.listPrizes.execute({ eventId });
    res.json(prizes.map(presentPrize));
  };

  update: RequestHandler = async (req, res) => {
    const params = parseParams(prizeParamsSchema, req.params);
    const changes = parseInput(updatePrizeSchema, req.body);
    const prize = await this.useCases.updatePrize.execute({ ...params, changes });
    res.json(presentPrize(prize));
  };

  remove: RequestHandler = async (req, res) => {
    const params = parseParams(prizeParamsSchema, req.params);
    await this.useCases.deletePrize.execute(params);
    res.status(204).end();
  };

  /** Raw image body (image/jpeg, image/png or image/webp); anything else is rejected by the domain. */
  uploadImage: RequestHandler = async (req, res) => {
    const params = parseParams(prizeParamsSchema, req.params);
    const data: Uint8Array = Buffer.isBuffer(req.body) ? req.body : new Uint8Array();
    const prize = await this.useCases.setPrizeImage.execute({ ...params, data });
    res.json(presentPrize(prize));
  };

  removeImage: RequestHandler = async (req, res) => {
    const params = parseParams(prizeParamsSchema, req.params);
    const prize = await this.useCases.removePrizeImage.execute(params);
    res.json(presentPrize(prize));
  };

  /** URLs carry the image version (?v=), so the browser may cache each version forever. */
  showImage: RequestHandler = async (req, res) => {
    const { prizeId } = parseParams(prizeIdParamsSchema, req.params);
    const image = await this.useCases.getPrizeImage.execute({ prizeId });
    res
      .status(200)
      .set({
        'Content-Type': image.contentType,
        'Cache-Control': `public, max-age=${ONE_YEAR_SECONDS}, immutable`,
        // Lets a frontend hosted on another domain display it.
        'Cross-Origin-Resource-Policy': 'cross-origin',
      })
      .send(Buffer.from(image.data));
  };
}
