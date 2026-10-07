import type { Prize } from '../../../domain/entities/Prize.ts';
import { BusinessRuleError } from '../../../domain/errors/DomainError.ts';
import { ErrorCode } from '../../../domain/errors/ErrorCode.ts';
import type { DrawRepository } from '../../../domain/repositories/DrawRepository.ts';
import type { PrizeRepository } from '../../../domain/repositories/PrizeRepository.ts';
import type { RandomNumberGenerator } from '../../ports/RandomNumberGenerator.ts';
import { toPrizeAvailability, type PrizeAvailability } from '../prizes/PrizeAvailability.ts';

export interface RoulettePick {
  prize: Prize;
  drawnUnits: number;
  /** Every prize with units left before this pick: what the wheel shows while it spins. */
  wheel: PrizeAvailability[];
}

/** Prizes of the event that still have units to give away. */
export async function availablePrizes(
  prizes: PrizeRepository,
  draws: DrawRepository,
  eventId: string,
): Promise<PrizeAvailability[]> {
  const [all, drawnByPrize] = await Promise.all([
    prizes.findByEvent(eventId),
    draws.countConfirmedByEventGroupedByPrize(eventId),
  ]);
  return all
    .map((prize) => toPrizeAvailability(prize, drawnByPrize.get(prize.id) ?? 0))
    .filter(({ remainingUnits }) => remainingUnits > 0);
}

/**
 * Every remaining unit is one equal chance, like tickets in a bag: a prize with 3 units left is
 * three times as likely as a prize with 1. (The roulette on screen shows each prize once, in
 * equal slices; the stock decides the odds, not the drawing.) Returns null when nothing is left.
 */
export function pickFromWheel(wheel: PrizeAvailability[], random: RandomNumberGenerator): PrizeAvailability | null {
  const totalUnits = wheel.reduce((sum, { remainingUnits }) => sum + remainingUnits, 0);
  if (totalUnits === 0) return null;

  let ticket = random.nextInt(totalUnits);
  for (const slice of wheel) {
    ticket -= slice.remainingUnits;
    if (ticket < 0) return slice;
  }
  throw new Error('Unreachable: ticket outside of the remaining units');
}

/** Call it with the event locked, so the stock cannot change before the draw is saved. */
export async function pickRoulettePrize(
  prizes: PrizeRepository,
  draws: DrawRepository,
  random: RandomNumberGenerator,
  eventId: string,
): Promise<RoulettePick> {
  const wheel = await availablePrizes(prizes, draws, eventId);
  const picked = pickFromWheel(wheel, random);
  if (!picked) throw new BusinessRuleError(ErrorCode.NoPrizesAvailable);
  return { prize: picked.prize, drawnUnits: picked.drawnUnits, wheel };
}
