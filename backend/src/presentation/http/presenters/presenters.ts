import type { EventOverview } from '../../../application/use-cases/events/GetEventOverview.ts';
import type { ActiveEvent } from '../../../application/use-cases/events/ListActiveEvents.ts';
import type { ImportParticipantsOutput } from '../../../application/use-cases/participants/ImportParticipants.ts';
import type { PrizeAvailability } from '../../../application/use-cases/prizes/PrizeAvailability.ts';
import type { ConfirmRegistrationOutput } from '../../../application/use-cases/registration/ConfirmRegistration.ts';
import type { Event } from '../../../domain/entities/Event.ts';
import type { RegistrationVerification } from '../../../domain/entities/RegistrationVerification.ts';
import type { Participant } from '../../../domain/entities/Participant.ts';
import type { DrawDetails } from '../../../domain/repositories/DrawRepository.ts';
import type { Page } from '../../../domain/repositories/Pagination.ts';
import { translateError } from '../errors/errorMessages.ts';

const iso = (date: Date | null): string | null => date?.toISOString() ?? null;

/** Versioned public URL of a prize photo (null when there is none). */
export const prizeImageUrl = (prize: { id: string; imageUpdatedAt: Date | null }): string | null =>
  prize.imageUpdatedAt ? `/api/public/prizes/${prize.id}/image?v=${prize.imageUpdatedAt.getTime()}` : null;

export const presentEvent = (event: Event) => ({
  id: event.id,
  name: event.name,
  description: event.description,
  eventDate: iso(event.eventDate),
  registrationOpen: event.registrationOpen,
  drawMode: event.drawMode,
  createdAt: iso(event.createdAt),
  updatedAt: iso(event.updatedAt),
});

export const presentEventOverview = ({ event, stats }: EventOverview) => ({ ...presentEvent(event), stats });

/** Public view of an event: no internal timestamps. */
export const presentPublicEvent = (event: Event) => ({
  id: event.id,
  name: event.name,
  description: event.description,
  eventDate: iso(event.eventDate),
  registrationOpen: event.registrationOpen,
  drawMode: event.drawMode,
});

export const presentActiveEvent = ({ event, remainingUnits }: ActiveEvent) => ({
  ...presentPublicEvent(event),
  remainingUnits,
});

export const presentParticipant = (participant: Participant) => ({
  id: participant.id,
  name: participant.name,
  phone: participant.phone,
  email: participant.email,
  createdAt: iso(participant.createdAt),
});

export const presentParticipantPage = (page: Page<Participant>) => ({
  items: page.items.map(presentParticipant),
  total: page.total,
  page: page.page,
  pageSize: page.pageSize,
  totalPages: Math.max(Math.ceil(page.total / page.pageSize), 1),
});

export const presentImportResult = (result: ImportParticipantsOutput) => ({
  created: result.created,
  rejected: result.rejected.map((entry) => ({ ...entry, message: translateError(entry.code) })),
});

export const presentPrize = ({ prize, drawnUnits, remainingUnits }: PrizeAvailability) => ({
  id: prize.id,
  name: prize.name,
  description: prize.description,
  quantity: prize.quantity,
  imageUrl: prizeImageUrl(prize),
  drawnUnits,
  remainingUnits,
  createdAt: iso(prize.createdAt),
  updatedAt: iso(prize.updatedAt),
});

/** What anyone may know about a prize: enough to draw the roulette. */
export const presentPublicPrize = ({ prize, remainingUnits }: PrizeAvailability) => ({
  id: prize.id,
  name: prize.name,
  imageUrl: prizeImageUrl(prize),
  remainingUnits,
});

/** Contact data is not echoed back on the public endpoint. */
export const presentRegistrationResult = ({ participant, spin }: ConfirmRegistrationOutput) => ({
  id: participant.id,
  name: participant.name,
  // Interactive roulette: the prize was already drawn; the wheel on the phone lands on it.
  spin: spin && {
    drawId: spin.draw.id,
    prize: { id: spin.prize.id, name: spin.prize.name, imageUrl: prizeImageUrl(spin.prize) },
    wheel: spin.wheel.map(presentPublicPrize),
  },
});

export const presentDraw = ({ draw, participant, prize }: DrawDetails) => ({
  id: draw.id,
  status: draw.status,
  drawnAt: iso(draw.drawnAt),
  voidedAt: iso(draw.voidedAt),
  claimedAt: iso(draw.claimedAt),
  participant,
  prize,
});

/** "maria.silva@gmail.com" -> "ma*********@gmail.com": enough to recognize, not to harvest. */
export function maskEmail(email: string): string {
  const [user = '', domain = ''] = email.split('@');
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}${'*'.repeat(Math.max(user.length - visible.length, 3))}@${domain}`;
}

export const presentRegistrationVerification = (verification: RegistrationVerification, previewCode: string | null) => ({
  verificationId: verification.id,
  email: maskEmail(verification.email),
  expiresAt: verification.expiresAt.toISOString(),
  resendAvailableAt: verification.resendAvailableAt.toISOString(),
  // Development only (console e-mail sender); never present with a real e-mail provider.
  ...(previewCode ? { previewCode } : {}),
});
