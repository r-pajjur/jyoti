import type { VercelRequest, VercelResponse } from '@vercel/node';
import { currentDay, isWithinRitual, localHour, sendHour } from '../_lib/day.js';
import { promptForDay } from '../_lib/prompts.js';
import { sendToAll } from '../_lib/push.js';
import { claimSend, countSubscribers, releaseSend } from '../_lib/store.js';
import { requireMethod } from '../_lib/http.js';

/**
 * GET /api/cron/daily — the morning notification.
 *
 * It acts on "the first run at or after DHARA_SEND_HOUR, if today is unclaimed"
 * rather than "run at exactly 08:00". That makes the hour configurable without
 * editing the schedule, lets a failed run retry itself on the next tick, and
 * stops a Vercel retry from sending twice.
 *
 *   ?dry=1    report what would happen, write nothing
 *   ?force=1  send again, ignoring today's claim
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, 'GET')) return;

  // Vercel signs cron invocations with CRON_SECRET; nothing else may fire this.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const dry = req.query.dry === '1';
  const force = req.query.force === '1';

  try {
    const day = currentDay();
    if (!isWithinRitual(day)) {
      return res.status(200).json({ skipped: 'outside the thirty days', day });
    }

    const hour = localHour();
    if (hour < sendHour() && !force) {
      return res.status(200).json({ skipped: 'before the send hour', day, hour, sendHour: sendHour() });
    }

    const prompt = promptForDay(day);
    if (!prompt) return res.status(200).json({ skipped: 'no prompt for this day', day });

    const payload = {
      title: `💧 Dhara · Day ${day}`,
      body: prompt.text,
      url: '/#/feed',
      tag: `dhara-day-${day}`,
    };

    if (dry) {
      return res.status(200).json({ dry: true, day, recipients: await countSubscribers(), payload });
    }

    if (!force && !(await claimSend(day))) {
      return res.status(200).json({ skipped: 'already sent today', day });
    }

    const report = await sendToAll(payload);
    // Nothing went out, so let the next tick try again rather than stay silent.
    if (report.sent === 0 && report.failed > 0 && !force) await releaseSend(day);

    console.log('[dhara] daily', { day, ...report });
    res.status(200).json({ day, ...report });
  } catch (error) {
    console.error('[dhara] cron', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unexpected error' });
  }
}
