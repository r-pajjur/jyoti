import { put } from '@vercel/blob';

/**
 * Photos are hosted on Vercel Blob; the stored post keeps only the resulting
 * public https URL, so no image bytes ever pass through the database.
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
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'drop';
}

/**
 * A Blob store is created either public or private and cannot be both, so the
 * mode is discovered once from the store's own rejection and remembered for
 * the life of the instance.
 */
let storeAccess: 'public' | 'private' | null = null;

/**
 * Uploads to Blob and returns what the feed should use as an <img> src:
 * the blob's own URL for a public store, or a path through /api/photo for a
 * private one, which streams it back with the server-side token.
 */
export async function uploadPhoto(photo: DecodedPhoto, name: string, day: number): Promise<string> {
  const key = `dhara/day-${String(day).padStart(2, '0')}/${slug(name)}-${Date.now()}.${extensionFor(photo.contentType)}`;
  const options = {
    contentType: photo.contentType,
    addRandomSuffix: true,
    cacheControlMaxAge: 31_536_000,
  };

  if (storeAccess !== 'private') {
    try {
      const blob = await put(key, photo.bytes, { ...options, access: 'public' });
      storeAccess = 'public';
      return blob.url;
    } catch (error) {
      if (!/private store/i.test(error instanceof Error ? error.message : '')) throw error;
      storeAccess = 'private';
    }
  }

  const blob = await put(key, photo.bytes, { ...options, access: 'private' });
  return `/api/photo?p=${encodeURIComponent(blob.pathname)}`;
}
