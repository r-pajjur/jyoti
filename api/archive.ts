import type { VercelRequest, VercelResponse } from '@vercel/node';
import { currentDay, dateKeyForDay, TOTAL_DAYS } from './_lib/day.js';
import { allPosts } from './_lib/store.js';
import { promptForDay } from './_lib/prompts.js';
import { fail, handleError, normalizeName, readName, requireMethod } from './_lib/http.js';

/**
 * GET /api/archive?name=…
 *
 * Days already past are open to everyone — the reveal gate only guards the
 * day in progress, so nobody is locked out of the month's gallery later.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, 'GET')) return;
  const name = readName(req);
  if (!name) return fail(res, 400, 'A name is required');

  try {
    const today = currentDay();
    const key = normalizeName(name);
    const all = await allPosts();
    const postedToday = all.some((post) => post.day === today && post.authorKey === key);

    const days = [];
    for (let day = 1; day <= Math.min(today, TOTAL_DAYS); day++) {
      const posts = all.filter((post) => post.day === day);
      const locked = day === today && !postedToday;
      days.push({
        day,
        dateKey: dateKeyForDay(day),
        prompt: promptForDay(day),
        count: posts.length,
        locked,
        posts: locked ? [] : posts.map((post) => ({ ...post, mine: post.authorKey === key })),
      });
    }
    res.status(200).json({ today, totalDays: TOTAL_DAYS, days: days.reverse() });
  } catch (error) {
    handleError(res, error);
  }
}
