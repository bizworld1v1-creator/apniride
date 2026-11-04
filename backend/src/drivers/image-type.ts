export type ImageContentType = 'image/jpeg' | 'image/png';

/**
 * Detects JPEG / PNG from the file's first bytes. The phone's Content-Type and file name are not trusted:
 * anything that isn't really a photo is refused.
 */
export function detectImageType(data: Buffer): ImageContentType | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (data.length >= png.length && png.every((b, i) => data[i] === b)) return 'image/png';
  return null;
}

export const IMAGE_EXTENSIONS: Record<ImageContentType, string> = { 'image/jpeg': 'jpg', 'image/png': 'png' };
