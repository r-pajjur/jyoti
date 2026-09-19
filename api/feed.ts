import type { VercelRequest, VercelResponse } from '@vercel/node';
import { currentDay, GROUP_SIZE, isWithinRitual, startDateKey, TOTAL_DAYS } from './_lib/day.js';
import { postsForDay } from './_lib/store.js';
import { promptForDay } from './_lib/prompts.js';
import { fail, handleError, normalizeName, readName, requireMethod } from './_lib/http.js';

/**
 * GET /api/feed?name=…&day=12
 *
 * The reveal gate is enforced here, not in the UI: until the caller has a post
 * of their own for that day, the response carries a count and nothing else —
 * not the posts, and not the prompt.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, 'GET')) return;
  const name = readName(req);
  if (!name) return fail(res, 400, 'A name is required');

  try {
    const day = Number(req.query.day ?? currentDay());
    if (!Number.isInteger(day)) return fail(res, 400, 'day must be an integer');

    // The screen needs to know whether the ritual has begun; without it the
    // capture button is offered on a day that cannot accept a post.
    const active = isWithinRitual(day);
    const phase = day < 1 ? 'before' : day > TOTAL_DAYS ? 'after' : 'during';
    if (!active) {
      return res.status(200).json({
        day, locked: true, active, phase, startDate: startDateKey(),
        count: 0, groupSize: GROUP_SIZE, posts: [],
      });
    }

    const posts = await postsForDay(day);
    const mine = posts.find((post) => post.authorKey === normalizeName(name));

    if (!mine) {
      return res.status(200).json({
        day, locked: true, active, phase, count: posts.length, groupSize: GROUP_SIZE, posts: [],
      });
    }
    res.status(200).json({
      day,
      locked: false,
      active,
      phase,
      count: posts.length,
      groupSize: GROUP_SIZE,
      prompt: promptForDay(day),
      posts: posts.map((post) => ({ ...post, mine: post.id === mine.id })),
    });
  } catch (error) {
    handleError(res, error);
  }
}
