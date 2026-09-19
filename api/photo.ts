import type { VercelRequest, VercelResponse } from '@vercel/node';
import { get } from '@vercel/blob';
import { fail, requireMethod } from './_lib/http.js';

/**
 * GET /api/photo?p=<pathname> — streams one photo out of a private Blob store.
 *
 * A private store has no publicly fetchable URL, so the image is read here with
 * the server-side token. Public stores never reach this route; their URLs are
 * stored directly.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, 'GET')) return;
  const pathname = typeof req.query.p === 'string' ? req.query.p : '';
  if (!pathname) return fail(res, 400, 'A photo path is required');

  try {
    const result = await get(pathname, { access: 'private' });
    if (!result || result.statusCode !== 200) return fail(res, 404, 'That photo is no longer here');

    res.setHeader('Content-Type', result.headers.get('content-type') ?? 'image/jpeg');
    // The pathname carries a random suffix, so a stored image never changes.
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    const length = result.headers.get('content-length');
    if (length) res.setHeader('Content-Length', length);
    res.status(200);

    const reader = result.stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('[jyoti] photo', message);
    fail(res, /not found/i.test(message) ? 404 : 502, message);
  }
}
