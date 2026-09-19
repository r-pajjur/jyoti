import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createReaction } from './_lib/padlet';
import { fail, handleError, requireMethod } from './_lib/http';

/** POST /api/react { postId } — a "blessing", stored as a native Padlet like. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, 'POST')) return;
  const postId = (req.body as { postId?: string } | undefined)?.postId;
  if (!postId || typeof postId !== 'string') return fail(res, 400, 'postId is required');

  try {
    await createReaction(postId);
    res.status(200).json({ ok: true });
  } catch (error) {
    handleError(res, error);
  }
}
