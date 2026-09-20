import type { VercelRequest, VercelResponse } from '@vercel/node';
import { removeSubscriber } from './_lib/store.js';
import { fail, handleError, requireMethod } from './_lib/http.js';

/** POST /api/unsubscribe { endpoint } — turning reminders off. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, 'POST')) return;
  const endpoint = (req.body as { endpoint?: string } | undefined)?.endpoint;
  if (!endpoint || typeof endpoint !== 'string') return fail(res, 400, 'endpoint is required');

  try {
    await removeSubscriber(endpoint);
    res.status(200).json({ ok: true });
  } catch (error) {
    handleError(res, error);
  }
}
