import type { RandomNumberGenerator } from '../../ports/RandomNumberGenerator.ts';

const CODE_SPACE = 1_000_000;

/** Six random digits (leading zeros allowed), e.g. "042917". */
export const generateVerificationCode = (random: RandomNumberGenerator): string =>
  String(random.nextInt(CODE_SPACE)).padStart(6, '0');
