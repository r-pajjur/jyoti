import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';
import { currentDay, TOTAL_DAYS } from './_lib/day';
import { decodePhoto, uploadPhoto } from './_lib/photos';
import { savePost } from './_lib/store';
import { fail, handleError, normalizeName, readName, requireMethod } from './_lib/http';

interface PostBody {
  name?: string;
  day?: number;
  text?: string;
  photo?: string;
  photoType?: string;
}

/**
 * POST /api/post — the capture flow's single write.
 * Photo bytes go to Vercel Blob first, then the row goes to Redis.
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
    const post = await savePost({
      id: randomUUID(),
      day,
      author: name,
      authorKey: normalizeName(name),
      body: text.slice(0, 10000),
      photoUrl,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ post });
  } catch (error) {
    handleError(res, error);
  }
}
