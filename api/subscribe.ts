import type { VercelRequest, VercelResponse } from '@vercel/node';
import { saveSubscriber } from './_lib/store.js';
import { fail, handleError, readName, requireMethod } from './_lib/http.js';

interface Body {
  name?: string;
  subscription?: { endpoint?: string };
}

/** POST /api/subscribe — one row per device, keyed by the push endpoint. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, 'POST')) return;
  const name = readName(req);
  if (!name) return fail(res, 400, 'A name is required');

  const subscription = (req.body as Body | undefined)?.subscription;
  const endpoint = subscription?.endpoint;
  if (!endpoint || typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint)) {
    return fail(res, 400, 'A valid push subscription is required');
  }

  try {
    // Re-subscribing the same device updates the row instead of duplicating it.
    await saveSubscriber({ endpoint, name, subscription, joinedAt: new Date().toISOString() });
    res.status(200).json({ ok: true });
  } catch (error) {
    handleError(res, error);
  }
}
