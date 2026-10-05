import type { Prize } from '../../../domain/entities/Prize.ts';

export interface PrizeAvailability {
  prize: Prize;
  drawnUnits: number;
  remainingUnits: number;
}

export function toPrizeAvailability(prize: Prize, drawnUnits: number): PrizeAvailability {
  return { prize, drawnUnits, remainingUnits: prize.remainingUnits(drawnUnits) };
}
