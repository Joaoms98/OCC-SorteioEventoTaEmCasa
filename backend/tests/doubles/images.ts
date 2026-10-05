/** 1x1 PNG. */
export const PNG_BYTES = Uint8Array.from(
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'),
);

/** JPEG signature followed by filler (the domain only inspects the magic bytes). */
export const jpegBytes = (size = 64): Uint8Array => {
  const bytes = new Uint8Array(size);
  bytes.set([0xff, 0xd8, 0xff, 0xe0]);
  return bytes;
};

export const WEBP_BYTES = Uint8Array.from(Buffer.from('RIFF\x24\x00\x00\x00WEBPVP8 ', 'latin1'));
