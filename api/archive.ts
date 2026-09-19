import type { VercelRequest, VercelResponse } from '@vercel/node';
import { currentDay, dateKeyForDay, TOTAL_DAYS } from './_lib/day';
import { fetchBoardPosts } from './_lib/padlet';
import { promptForDay } from './_lib/prompts';
import { fail, handleError, normalizeName, readName, requireMethod } from './_lib/http';

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
    const all = (await fetchBoardPosts()).filter((post) => !post.isPrompt && post.day !== null);
    const postedToday = all.some(
      (post) => post.day === today && post.author && normalizeName(post.author) === normalizeName(name),
    );

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
        posts: locked
          ? []
          : posts.map((post) => ({
              ...post,
              mine: !!post.author && normalizeName(post.author) === normalizeName(name),
            })),
      });
    }
    res.status(200).json({ today, totalDays: TOTAL_DAYS, days: days.reverse() });
  } catch (error) {
    handleError(res, error);
  }
}
