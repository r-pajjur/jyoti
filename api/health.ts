import type { VercelRequest, VercelResponse } from '@vercel/node';
import { currentDay, GROUP_SIZE, TOTAL_DAYS } from './_lib/day';
import { allPosts } from './_lib/store';
import { requireMethod } from './_lib/http';

/**
 * GET /api/health — is this deployment actually wired up?
 *
 * Reports which credentials are present and whether the store answers. It
 * reveals no secret values, only whether each one is set.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, 'GET')) return;

  const env = {
    kv: !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL),
    kvToken: !!(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN),
    blob: !!process.env.BLOB_READ_WRITE_TOKEN,
    startDate: process.env.JYOTI_START_DATE ?? null,
    timezone: process.env.JYOTI_TIMEZONE ?? null,
    groupSize: GROUP_SIZE,
    totalDays: TOTAL_DAYS,
  };

  let store: { ok: boolean; posts?: number; error?: string };
  try {
    store = { ok: true, posts: (await allPosts()).length };
  } catch (error) {
    store = { ok: false, error: error instanceof Error ? error.message : 'unknown' };
  }

  const ok = env.kv && env.kvToken && env.blob && store.ok;
  res.status(ok ? 200 : 503).json({ ok, day: currentDay(), env, store });
}
