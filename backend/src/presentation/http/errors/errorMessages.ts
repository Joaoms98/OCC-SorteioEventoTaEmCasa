import { ErrorCode } from '../../../domain/errors/ErrorCode.ts';
import { HttpErrorCode } from './HttpErrorCode.ts';

export type ApiErrorCode = ErrorCode | HttpErrorCode;

type MessageResolver = string | ((details: Record<string, unknown>) => string);

/**
 * User-facing (pt-BR) messages for every error the API can return.
 * Codes stay in English so clients can branch on them; only the message is translated.
 */
const messages: Record<ApiErrorCode, MessageResolver> = {
  [ErrorCode.EventNotFound]: 'Evento não encontrado.',
  [ErrorCode.ParticipantNotFound]: 'Participante não encontrado.',
  [ErrorCode.PrizeNotFound]: 'Brinde não encontrado.',
  [ErrorCode.PrizeImageNotFound]: 'Este brinde não tem foto.',
  [ErrorCode.DrawNotFound]: 'Sorteio não encontrado.',
  [ErrorCode.VerificationNotFound]: 'Esta solicitação de inscrição não existe mais. Preencha seus dados novamente.',

  [ErrorCode.ParticipantAlreadyRegistered]: (details) =>
    details.field === 'email'
      ? 'Este e-mail já está cadastrado neste evento.'
      : details.field === 'phone'
        ? 'Este telefone já está cadastrado neste evento.'
        : 'Já existe um participante com este telefone ou e-mail neste evento.',
  [ErrorCode.ParticipantHasDraw]: 'Não é possível remover um participante que já foi sorteado.',
  [ErrorCode.PrizeHasDraws]: 'Não é possível remover um brinde que já possui sorteios registrados.',
  [ErrorCode.DrawConflict]: 'Outro sorteio foi realizado ao mesmo tempo. Tente novamente.',

  [ErrorCode.PrizeOutOfStock]: 'Todas as unidades deste brinde já foram sorteadas.',
  [ErrorCode.NoPrizesAvailable]: 'Não há brindes disponíveis: todos já foram sorteados ou nenhum foi cadastrado.',
  [ErrorCode.PrizeQuantityBelowDrawn]: (details) =>
    `A quantidade não pode ser menor que o total de unidades já sorteadas (${String(details.drawnUnits ?? 0)}).`,
  [ErrorCode.NoEligibleParticipants]: 'Não há participantes aptos para o sorteio.',
  [ErrorCode.RegistrationClosed]: 'As inscrições para este evento estão encerradas.',
  [ErrorCode.DrawAlreadyVoided]: 'Este sorteio já foi anulado.',
  [ErrorCode.DrawInProgress]: 'Aguarde a revelação do sorteio em andamento antes de sortear novamente.',
  [ErrorCode.DrawNotRevealed]: 'Aguarde a revelação do ganhador antes de entregar o brinde.',
  [ErrorCode.PrizeAlreadyClaimed]: 'O brinde deste sorteio já foi entregue.',
  [ErrorCode.PhoneRequired]: 'Informe o telefone com DDD.',
  [ErrorCode.EmailRequired]: 'Informe seu e-mail para receber o código de confirmação.',
  [ErrorCode.VerificationExpired]: 'O código expirou. Peça um novo código.',
  [ErrorCode.InvalidVerificationCode]: (details) => {
    const left = Number(details.attemptsLeft ?? 0);
    return `Código incorreto. Você tem mais ${left} ${left === 1 ? 'tentativa' : 'tentativas'}.`;
  },
  [ErrorCode.TooManyVerificationAttempts]: 'Muitas tentativas com código incorreto. Peça um novo código.',
  [ErrorCode.VerificationResendTooSoon]: (details) =>
    `Aguarde ${String(details.secondsLeft ?? 60)} segundos para pedir um novo código.`,
  [ErrorCode.VerificationResendLimit]: 'Limite de reenvios atingido. Preencha seus dados novamente mais tarde.',
  [ErrorCode.TooManyVerificationsForEmail]: 'Muitos códigos enviados para este e-mail. Tente novamente em uma hora.',
  [ErrorCode.EmailDeliveryFailed]: 'Não foi possível enviar o e-mail com o código agora. Tente novamente em instantes.',

  [ErrorCode.InvalidEventName]: 'O nome do evento é obrigatório e deve ter no máximo 120 caracteres.',
  [ErrorCode.InvalidParticipantName]: 'O nome do participante é obrigatório e deve ter no máximo 120 caracteres.',
  [ErrorCode.InvalidPrizeName]: 'O nome do brinde é obrigatório e deve ter no máximo 120 caracteres.',
  [ErrorCode.InvalidPrizeQuantity]: 'A quantidade do brinde deve ser um número inteiro entre 1 e 10.000.',
  [ErrorCode.InvalidPhone]: 'Telefone inválido. Informe o DDD e o número.',
  [ErrorCode.InvalidEmail]: 'E-mail inválido.',
  [ErrorCode.InvalidImage]: 'Imagem inválida. Envie uma foto em JPG, PNG ou WebP.',
  [ErrorCode.ImageTooLarge]: 'A foto deve ter no máximo 2 MB.',

  [ErrorCode.InvalidCredentials]: 'Senha incorreta.',

  [HttpErrorCode.ValidationError]: 'Dados inválidos. Verifique os campos informados.',
  [HttpErrorCode.InvalidJson]: 'O corpo da requisição não é um JSON válido.',
  [HttpErrorCode.PayloadTooLarge]: 'O conteúdo enviado é muito grande.',
  [HttpErrorCode.RouteNotFound]: 'Rota não encontrada.',
  [HttpErrorCode.ResourceNotFound]: 'Recurso não encontrado.',
  [HttpErrorCode.Unauthorized]: 'Sessão inválida ou expirada. Faça login novamente.',
  [HttpErrorCode.TooManyRequests]: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  [HttpErrorCode.InternalError]: 'Ocorreu um erro inesperado. Tente novamente mais tarde.',
};

export function translateError(code: ApiErrorCode, details: Record<string, unknown> = {}): string {
  const resolver = messages[code];
  return typeof resolver === 'function' ? resolver(details) : resolver;
}
