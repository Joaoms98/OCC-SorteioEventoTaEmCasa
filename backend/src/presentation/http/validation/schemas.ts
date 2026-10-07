import { z } from 'zod';
import { DESCRIPTION_MAX_LENGTH, NAME_MAX_LENGTH } from '../../../domain/shared/text.ts';
import { PRIZE_MAX_QUANTITY } from '../../../domain/entities/Prize.ts';

const emptyToUndefined = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value);
const emptyToNull = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value);

const name = (subject: string) =>
  z
    .string({ error: `Informe o nome ${subject}.` })
    .trim()
    .min(1, `Informe o nome ${subject}.`)
    .max(NAME_MAX_LENGTH, `O nome ${subject} deve ter no máximo ${NAME_MAX_LENGTH} caracteres.`);

const description = z
  .preprocess(
    emptyToNull,
    z
      .string({ error: 'Descrição inválida.' })
      .trim()
      .max(DESCRIPTION_MAX_LENGTH, `A descrição deve ter no máximo ${DESCRIPTION_MAX_LENGTH} caracteres.`)
      .nullable(),
  )
  .optional();

const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string({ error: 'E-mail inválido.' }).trim().max(160, 'E-mail inválido.').optional(),
);

// ---- Params ----

export const eventParamsSchema = z.object({ eventId: z.uuid() });
export const participantParamsSchema = eventParamsSchema.extend({ participantId: z.uuid() });
export const prizeParamsSchema = eventParamsSchema.extend({ prizeId: z.uuid() });
export const drawParamsSchema = eventParamsSchema.extend({ drawId: z.uuid() });
export const prizeIdParamsSchema = z.object({ prizeId: z.uuid() });
export const verificationParamsSchema = eventParamsSchema.extend({ verificationId: z.uuid() });

// ---- Auth ----

export const loginSchema = z.object({
  password: z.string({ error: 'Informe a senha.' }).min(1, 'Informe a senha.').max(200, 'Senha inválida.'),
});

// ---- Events ----

const eventFields = {
  description,
  eventDate: z
    .iso.datetime({ offset: true, error: 'Data do evento inválida.' })
    .transform((value) => new Date(value))
    .nullable()
    .optional(),
  registrationOpen: z.boolean({ error: 'Valor inválido para inscrições abertas.' }).optional(),
  drawMode: z.enum(['PRIZES', 'PARTICIPANTS', 'INTERACTIVE'], { error: 'Escolha o tipo de roleta.' }).optional(),
};

export const createEventSchema = z.object({ name: name('do evento'), ...eventFields });

export const updateEventSchema = z
  .object({ name: name('do evento').optional(), ...eventFields })
  .refine((changes) => Object.values(changes).some((value) => value !== undefined), {
    error: 'Informe ao menos um campo para atualizar.',
  });

// ---- Participants ----

const requiredPhone = z
  .string({ error: 'Informe o telefone com DDD.' })
  .trim()
  .min(1, 'Informe o telefone com DDD.')
  .max(30, 'Telefone inválido.');

export const addParticipantSchema = z.object({
  name: name('do participante'),
  phone: requiredPhone,
  email: optionalEmail,
});

export const startRegistrationSchema = z.object({
  name: name('do participante'),
  phone: requiredPhone,
  email: z
    .string({ error: 'Informe seu e-mail.' })
    .trim()
    .min(1, 'Informe seu e-mail para receber o código de confirmação.')
    .max(160, 'E-mail inválido.'),
});

export const confirmRegistrationSchema = z.object({
  code: z.string({ error: 'Informe o código.' }).trim().regex(/^\d{6}$/, 'Informe o código de 6 números enviado por e-mail.'),
});

export const MAX_IMPORT_ENTRIES = 5000;

/**
 * Entries are loosely validated here (types only): the domain reports invalid ones line by line,
 * so one bad line never discards the whole list. The JSON body limit caps the overall size.
 */
export const importParticipantsSchema = z.object({
  participants: z
    .array(
      z.object({
        name: z.string({ error: 'Nome inválido.' }),
        phone: z.string({ error: 'Telefone inválido.' }).nullish(),
        email: z.string({ error: 'E-mail inválido.' }).nullish(),
      }),
      { error: 'Informe a lista de participantes.' },
    )
    .min(1, 'Informe ao menos um participante.')
    .max(MAX_IMPORT_ENTRIES, `Importe no máximo ${MAX_IMPORT_ENTRIES.toLocaleString('pt-BR')} participantes por vez.`),
});

export const listParticipantsQuerySchema = z.object({
  search: z.string({ error: 'Busca inválida.' }).trim().max(100, 'A busca deve ter no máximo 100 caracteres.').optional(),
  page: z.coerce.number({ error: 'Página inválida.' }).int('Página inválida.').min(1, 'Página inválida.').default(1),
  pageSize: z.coerce
    .number({ error: 'Tamanho de página inválido.' })
    .int('Tamanho de página inválido.')
    .min(1, 'O tamanho da página deve ser entre 1 e 100.')
    .max(100, 'O tamanho da página deve ser entre 1 e 100.')
    .default(20),
});

// ---- Prizes ----

const quantity = z
  .number({ error: 'Informe a quantidade.' })
  .int('A quantidade deve ser um número inteiro.')
  .min(1, 'A quantidade deve ser no mínimo 1.')
  .max(PRIZE_MAX_QUANTITY, `A quantidade deve ser no máximo ${PRIZE_MAX_QUANTITY.toLocaleString('pt-BR')}.`);

export const createPrizeSchema = z.object({ name: name('do brinde'), description, quantity });

export const updatePrizeSchema = z
  .object({ name: name('do brinde').optional(), description, quantity: quantity.optional() })
  .refine((changes) => Object.values(changes).some((value) => value !== undefined), {
    error: 'Informe ao menos um campo para atualizar.',
  });

// ---- Draws ----

/** Without prizeId the prize is drawn by the roulette. */
export const createDrawSchema = z.object({
  prizeId: z.uuid({ error: 'Selecione um brinde válido.' }).optional(),
});
