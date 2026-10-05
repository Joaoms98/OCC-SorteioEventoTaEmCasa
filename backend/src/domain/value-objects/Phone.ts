import { InvalidInputError } from '../errors/DomainError.ts';
import { ErrorCode } from '../errors/ErrorCode.ts';

const BRAZIL_COUNTRY_CODE = '55';

/** Area codes (DDD) in use in Brazil. */
const VALID_AREA_CODES = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48,
  49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/**
 * Brazilian phone number stored as digits only (DDD + number), e.g. "11987654321".
 * Accepts landlines (10 digits) and mobiles (11 digits, starting with 9 after the DDD).
 */
export class Phone {
  private constructor(readonly value: string) {}

  static create(raw: string): Phone {
    let digits = raw.replace(/\D/g, '');
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith(BRAZIL_COUNTRY_CODE)) {
      digits = digits.slice(BRAZIL_COUNTRY_CODE.length);
    }
    if (!Phone.isValid(digits)) {
      throw new InvalidInputError(ErrorCode.InvalidPhone, { field: 'phone' });
    }
    return new Phone(digits);
  }

  static createOptional(raw: string | null | undefined): Phone | null {
    return raw?.trim() ? Phone.create(raw) : null;
  }

  private static isValid(digits: string): boolean {
    if (digits.length !== 10 && digits.length !== 11) return false;
    if (!VALID_AREA_CODES.has(Number(digits.slice(0, 2)))) return false;
    const subscriber = digits.slice(2);
    if (subscriber.length === 9) return subscriber.startsWith('9');
    return /^[2-5]/.test(subscriber); // landlines start with 2-5
  }
}
