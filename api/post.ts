import type { VercelRequest, VercelResponse } from '@vercel/node';
import { currentDay, TOTAL_DAYS } from './_lib/day';
import { createPost, userSubject } from './_lib/padlet';
import { decodePhoto, uploadPhoto } from './_lib/photos';
import { promptForDay } from './_lib/prompts';
import { fail, handleError, readName, requireMethod } from './_lib/http';

interface PostBody {
  name?: string;
  day?: number;
  text?: string;
  photo?: string;
  photoType?: string;
}

/**
 * POST /api/post — the capture flow's single write.
 * Photo bytes go to Vercel Blob first, then the resulting URL goes to Padlet.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, 'POST')) return;
  const name = readName(req);
  if (!name) return fail(res, 400, 'A name is required');

  const body = (req.body ?? {}) as PostBody;
  const day = Number.isInteger(body.day) ? Number(body.day) : currentDay();
  if (day < 1 || day > TOTAL_DAYS) return fail(res, 400, 'That day is outside the thirty days');

  const text = (body.text ?? '').trim();
  if (!text && !body.photo) return fail(res, 400, 'Add a photo or a few words before posting');

  try {
    const photoUrl = body.photo
      ? await uploadPhoto(decodePhoto(body.photo, body.photoType), name, day)
      : null;
    const prompt = promptForDay(day);
    const post = await createPost({
      subject: userSubject(name, day),
      body: text || prompt?.title || '',
      photoUrl,
      color: 'orange',
    });
    res.status(201).json({ post });
  } catch (error) {
    handleError(res, error);
  }
}
