/**
 * iPhone photos are 3–6 MB and often rotated by EXIF. Downscale in the browser
 * so the serverless body limit is never the thing that breaks a post.
 */

const MAX_EDGE = 1600;
const QUALITY = 0.82;

async function toBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* Safari < 17 on some formats — fall through */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('That image could not be opened.'));
      image.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

export interface PreparedPhoto {
  dataUrl: string;
  contentType: 'image/jpeg';
  bytes: number;
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const source = await toBitmap(file);
  const width = 'width' in source ? source.width : 0;
  const height = 'height' in source ? source.height : 0;
  if (!width || !height) throw new Error('That image could not be read.');

  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not process the photo.');
  context.drawImage(source as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  if ('close' in source) source.close();

  // Always re-encode to JPEG: HEIC straight off an iPhone is not web-renderable.
  const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
  const bytes = Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);
  if (bytes > 4 * 1024 * 1024) throw new Error('That photo is too large even after shrinking.');
  return { dataUrl, contentType: 'image/jpeg', bytes };
}
