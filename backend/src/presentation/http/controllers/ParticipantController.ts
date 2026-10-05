import type { RequestHandler } from 'express';
import type { AddParticipant } from '../../../application/use-cases/participants/AddParticipant.ts';
import type { ImportParticipants } from '../../../application/use-cases/participants/ImportParticipants.ts';
import type { ListParticipants } from '../../../application/use-cases/participants/ListParticipants.ts';
import type { RemoveParticipant } from '../../../application/use-cases/participants/RemoveParticipant.ts';
import { presentImportResult, presentParticipant, presentParticipantPage } from '../presenters/presenters.ts';
import { parseInput, parseParams } from '../validation/parse.ts';
import {
  addParticipantSchema,
  eventParamsSchema,
  importParticipantsSchema,
  listParticipantsQuerySchema,
  participantParamsSchema,
} from '../validation/schemas.ts';

export interface ParticipantUseCases {
  addParticipant: AddParticipant;
  importParticipants: ImportParticipants;
  listParticipants: ListParticipants;
  removeParticipant: RemoveParticipant;
}

export class ParticipantController {
  constructor(private readonly useCases: ParticipantUseCases) {}

  create: RequestHandler = async (req, res) => {
    const { eventId } = parseParams(eventParamsSchema, req.params);
    const input = parseInput(addParticipantSchema, req.body);
    const participant = await this.useCases.addParticipant.execute({ eventId, ...input });
    res.status(201).json(presentParticipant(participant));
  };

  import: RequestHandler = async (req, res) => {
    const { eventId } = parseParams(eventParamsSchema, req.params);
    const { participants } = parseInput(importParticipantsSchema, req.body);
    const result = await this.useCases.importParticipants.execute({ eventId, entries: participants });
    res.status(201).json(presentImportResult(result));
  };

  list: RequestHandler = async (req, res) => {
    const { eventId } = parseParams(eventParamsSchema, req.params);
    const query = parseInput(listParticipantsQuerySchema, req.query);
    const page = await this.useCases.listParticipants.execute({ eventId, ...query });
    res.json(presentParticipantPage(page));
  };

  remove: RequestHandler = async (req, res) => {
    const params = parseParams(participantParamsSchema, req.params);
    await this.useCases.removeParticipant.execute(params);
    res.status(204).end();
  };
}
