import { describe, expect, it } from 'vitest';
import { ErrorCode } from '../../../src/domain/errors/ErrorCode.ts';
import { PRIZE_IMAGE_MAX_BYTES, PrizeImage } from '../../../src/domain/value-objects/PrizeImage.ts';
import { jpegBytes, PNG_BYTES, WEBP_BYTES } from '../../doubles/images.ts';

describe('PrizeImage', () => {
  it.each([
    ['image/png', PNG_BYTES],
    ['image/jpeg', jpegBytes()],
    ['image/webp', WEBP_BYTES],
  ])('detects %s from the file content', (contentType, data) => {
    expect(PrizeImage.create(data).contentType).toBe(contentType);
  });

  it.each([
    ['empty', new Uint8Array()],
    ['gif', Uint8Array.from(Buffer.from('GIF89a......'))],
    ['svg', Uint8Array.from(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))],
    ['text', Uint8Array.from(Buffer.from('not an image'))],
  ])('rejects %s', (_kind, data) => {
    expect(() => PrizeImage.create(data)).toThrow(expect.objectContaining({ code: ErrorCode.InvalidImage }));
  });

  it('rejects photos above 2 MB', () => {
    expect(() => PrizeImage.create(jpegBytes(PRIZE_IMAGE_MAX_BYTES + 1))).toThrow(
      expect.objectContaining({ code: ErrorCode.ImageTooLarge }),
    );
    expect(PrizeImage.create(jpegBytes(PRIZE_IMAGE_MAX_BYTES)).data).toHaveLength(PRIZE_IMAGE_MAX_BYTES);
  });
});
