import type { VercelRequest, VercelResponse } from '@vercel/node';
import { currentDay, GROUP_SIZE, TOTAL_DAYS } from './_lib/day.js';
import { allPosts, pingStore, storageVarNames } from './_lib/store.js';
import { requireMethod } from './_lib/http.js';

/**
 * GET /api/health — is this deployment actually wired up?
 *
 * Reports which credentials are present and whether the store answers. It
 * reveals no secret values, only whether each one is set.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, 'GET')) return;

  const env = {
    redis: !!(process.env.REDIS_URL || process.env.KV_URL),
    blob: !!process.env.BLOB_READ_WRITE_TOKEN,
    startDate: process.env.JYOTI_START_DATE ?? null,
    timezone: process.env.JYOTI_TIMEZONE ?? null,
    groupSize: GROUP_SIZE,
    totalDays: TOTAL_DAYS,
  };

  // Names only, never values: which storage variables does this deployment see?
  const seen = storageVarNames();

  // The env report must survive a store that hangs, so the probe is raced
  // against a deadline shorter than the function's own timeout.
  const deadline = <T>(promise: Promise<T>, ms: number): Promise<T> =>
    Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms).unref?.(),
      ),
    ]);

  let store: { ok: boolean; ping?: string; posts?: number; error?: string };
  try {
    const ping = await deadline(pingStore(), 6000);
    store = { ok: true, ping, posts: (await deadline(allPosts(), 6000)).length };
  } catch (error) {
    store = { ok: false, error: error instanceof Error ? error.message : 'unknown' };
  }

  const ok = env.redis && env.blob && store.ok;
  res.status(ok ? 200 : 503).json({ ok, day: currentDay(), env, seen, store });
}
