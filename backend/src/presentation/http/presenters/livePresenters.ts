import type { LiveDrawMessage, PendingLiveDraw } from '../../../application/ports/LiveDrawChannel.ts';
import type { LiveBoard } from '../../../application/use-cases/live/GetLiveBoard.ts';
import { presentPublicEvent, prizeImageUrl } from './presenters.ts';

const msUntil = (date: Date, now: number): number => Math.max(date.getTime() - now, 0);

/** "Maria da Silva" -> "Maria S.": the rolling animation only needs a hint of who is competing. */
export function abbreviateName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
}

/** Participant roulette as the audience sees it: abbreviated names, slot once the wheel is landing. */
export const presentWheel = (wheel: { names: string[]; winnerSlot: number | null } | null | undefined) =>
  wheel ? { names: wheel.names.map(abbreviateName), slot: wheel.winnerSlot } : null;

export function presentLiveSnapshot(board: LiveBoard, pending: PendingLiveDraw | null, viewers: number, now: number) {
  return {
    event: presentPublicEvent(board.event),
    prizes: board.prizes.map(({ prize, remainingUnits }) => ({
      id: prize.id,
      name: prize.name,
      quantity: prize.quantity,
      remainingUnits,
      imageUrl: prizeImageUrl(prize),
    })),
    recentWinners: board.recentWinners
      .filter(({ draw }) => draw.id !== pending?.drawId)
      .map(({ draw, participant, prize }) => ({
        drawId: draw.id,
        winnerName: participant.name,
        prize,
        drawnAt: draw.drawnAt.toISOString(),
        claimedAt: draw.claimedAt?.toISOString() ?? null,
      })),
    stats: { participants: board.participants, eligibleParticipants: board.eligibleParticipants },
    rollNames: board.rollNames.map(abbreviateName),
    pendingDraw:
      pending?.prize && pending.revealAt && pending.landingAt
        ? {
            drawId: pending.drawId,
            prize: pending.prize,
            landingInMs: msUntil(pending.landingAt, now),
            revealInMs: msUntil(pending.revealAt, now),
            wheel: presentWheel(pending.wheel),
          }
        : null,
    viewers,
  };
}

/** Relative delays instead of absolute times, so viewers' clocks do not need to be in sync. */
export function presentLiveMessage(message: LiveDrawMessage, now: number) {
  switch (message.type) {
    case 'draw_started':
      return {
        drawId: message.drawId,
        prize: message.prize,
        landingInMs: msUntil(message.landingAt, now),
        revealInMs: msUntil(message.revealAt, now),
        wheelNames: message.wheelNames?.map(abbreviateName) ?? null,
      };
    case 'draw_landing':
      return { drawId: message.drawId, slot: message.winnerSlot };
    case 'draw_revealed':
      return {
        drawId: message.drawId,
        prize: message.prize,
        winnerName: message.winnerName,
        wheel: presentWheel(message.wheel),
      };
    case 'draw_voided':
    case 'draw_claimed':
      return { drawId: message.drawId, prize: message.prize, winnerName: message.winnerName };
  }
}
