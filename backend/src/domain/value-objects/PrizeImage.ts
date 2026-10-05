import { InvalidInputError } from '../errors/DomainError.ts';
import { ErrorCode } from '../errors/ErrorCode.ts';

export const PRIZE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export type PrizeImageContentType = 'image/jpeg' | 'image/png' | 'image/webp';

const startsWith = (data: Uint8Array, signature: number[], offset = 0): boolean =>
  signature.every((byte, index) => data[offset + index] === byte);

const ascii = (text: string): number[] => [...text].map((char) => char.charCodeAt(0));

/** The file content decides the type (magic bytes); the declared Content-Type is never trusted. */
function detectContentType(data: Uint8Array): PrizeImageContentType | null {
  if (startsWith(data, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(data, ascii('RIFF')) && startsWith(data, ascii('WEBP'), 8)) return 'image/webp';
  return null;
}

/** Photo of a prize: a JPEG, PNG or WebP image of at most 2 MB. */
export class PrizeImage {
  private constructor(
    readonly contentType: PrizeImageContentType,
    readonly data: Uint8Array,
  ) {}

  static create(data: Uint8Array): PrizeImage {
    if (data.length > PRIZE_IMAGE_MAX_BYTES) {
      throw new InvalidInputError(ErrorCode.ImageTooLarge, { maxBytes: PRIZE_IMAGE_MAX_BYTES });
    }
    const contentType = detectContentType(data);
    if (!contentType) throw new InvalidInputError(ErrorCode.InvalidImage);
    return new PrizeImage(contentType, data);
  }

  static restore(contentType: PrizeImageContentType, data: Uint8Array): PrizeImage {
    return new PrizeImage(contentType, data);
  }
}
