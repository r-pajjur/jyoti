import { put } from '@vercel/blob';

/**
 * Padlet only accepts an attachment URL, so every captured photo is hosted on
 * Vercel Blob first and the resulting public https URL is handed to Padlet.
 */

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const MAX_BYTES = 4 * 1024 * 1024;

export interface DecodedPhoto {
  bytes: Buffer;
  contentType: string;
}

/** Accepts a `data:` URI or a bare base64 string plus an explicit content type. */
export function decodePhoto(input: string, declaredType?: string): DecodedPhoto {
  const dataUri = /^data:([^;,]+);base64,(.*)$/s.exec(input.trim());
  const contentType = (dataUri?.[1] || declaredType || 'image/jpeg').toLowerCase();
  const base64 = dataUri?.[2] ?? input.trim();

  if (!ALLOWED.has(contentType)) {
    throw new Error(`Unsupported image type: ${contentType}`);
  }
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0) throw new Error('Photo payload was empty');
  if (bytes.length > MAX_BYTES) {
    throw new Error(`Photo is ${(bytes.length / 1048576).toFixed(1)}MB; the limit is 4MB`);
  }
  return { bytes, contentType };
}

function extensionFor(contentType: string): string {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/heic' || contentType === 'image/heif') return 'heic';
  return 'jpg';
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'lamp';
}

/** Uploads to Blob and returns the public URL Padlet will fetch. */
export async function uploadPhoto(photo: DecodedPhoto, name: string, day: number): Promise<string> {
  const key = `jyoti/day-${String(day).padStart(2, '0')}/${slug(name)}-${Date.now()}.${extensionFor(photo.contentType)}`;
  const blob = await put(key, photo.bytes, {
    access: 'public',
    contentType: photo.contentType,
    addRandomSuffix: true,
    cacheControlMaxAge: 31_536_000,
  });
  return blob.url;
}
