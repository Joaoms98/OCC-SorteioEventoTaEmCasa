import { UserFacingError } from '../api/ApiError';

const MAX_SIDE_PX = 1200;
const QUALITY = 0.85;
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/**
 * Shrinks a photo in the browser before upload: at most 1200px on the longest side, re-encoded
 * as WebP (JPEG where WebP encoding is unavailable). Re-encoding also strips EXIF data (e.g. GPS).
 */
export async function preparePrizeImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new UserFacingError('Selecione um arquivo de imagem (JPG, PNG ou WebP).');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new UserFacingError('Não foi possível ler esta imagem. Tente outra foto em JPG, PNG ou WebP.');
  }

  try {
    const scale = Math.min(1, MAX_SIDE_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const webp = await encode(bitmap, width, height, 'image/webp');
    const blob = webp?.type === 'image/webp' ? webp : await encode(bitmap, width, height, 'image/jpeg');
    if (!blob) throw new UserFacingError('Não foi possível processar esta imagem. Tente outra foto.');
    if (blob.size > MAX_UPLOAD_BYTES) throw new UserFacingError('A foto deve ter no máximo 2 MB.');
    return blob;
  } finally {
    bitmap.close();
  }
}

function encode(bitmap: ImageBitmap, width: number, height: number, type: string): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return Promise.resolve(null);
  if (type === 'image/jpeg') {
    // JPEG has no transparency: paint it white instead of black.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}
