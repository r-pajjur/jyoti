import type { VercelRequest, VercelResponse } from '@vercel/node';
import { currentDay, isWithinRitual, ritualConfig, todayKey, TOTAL_DAYS } from './_lib/day.js';
import { promptForDay } from './_lib/prompts.js';
import { handleError, requireMethod } from './_lib/http.js';

/** GET /api/today → the day number, its prompt, and the ritual window. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, 'GET')) return;
  try {
    const day = currentDay();
    const clamped = Math.min(Math.max(day, 1), TOTAL_DAYS);
    res.status(200).json({
      day,
      dateKey: todayKey(),
      active: isWithinRitual(day),
      phase: day < 1 ? 'before' : day > TOTAL_DAYS ? 'after' : 'during',
      prompt: promptForDay(clamped),
      ...ritualConfig(),
    });
  } catch (error) {
    handleError(res, error);
  }
}
