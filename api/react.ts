import type { VercelRequest, VercelResponse } from '@vercel/node';
import { addBlessing } from './_lib/store';
import { fail, handleError, requireMethod } from './_lib/http';

/** POST /api/react { postId } — a blessing. The count is kept but never shown. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, 'POST')) return;
  const postId = (req.body as { postId?: string } | undefined)?.postId;
  if (!postId || typeof postId !== 'string') return fail(res, 400, 'postId is required');

  try {
    await addBlessing(postId);
    res.status(200).json({ ok: true });
  } catch (error) {
    handleError(res, error);
  }
}
