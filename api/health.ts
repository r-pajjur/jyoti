import type { VercelRequest, VercelResponse } from '@vercel/node';
import { currentDay, GROUP_SIZE, isConfigured, ritualConfig, TOTAL_DAYS } from './_lib/day.js';
import { list } from '@vercel/blob';
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

  // Probes are raced against a deadline shorter than the function's timeout,
  // so a hanging dependency still yields a report.
  const deadline = <T>(promise: Promise<T>, ms: number): Promise<T> =>
    Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms).unref?.(),
      ),
    ]);

  // Which build is actually serving? Vercel injects these at build time.
  const build = {
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    message: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split('\n')[0] ?? null,
    environment: process.env.VERCEL_ENV ?? null,
    region: process.env.VERCEL_REGION ?? null,
  };

  // Effective values — what the app actually uses — not the raw variables. A
  // variable present but empty reads as unset, which is otherwise invisible.
  const config = ritualConfig();
  const env = {
    redis: !!(process.env.REDIS_URL || process.env.KV_URL),
    startDate: config.startDate,
    startDateVar: process.env.DHARA_START_DATE ? 'DHARA_START_DATE'
      : process.env.JYOTI_START_DATE ? 'JYOTI_START_DATE' : null,
    startDateConfigured: isConfigured(),
    timezone: config.timezone,
    groupSize: GROUP_SIZE,
    totalDays: TOTAL_DAYS,
  };

  // Names only, never values: which storage variables does this deployment see?
  const seen = storageVarNames();

  // Ask Blob whether it works rather than inferring it from a variable: on
  // Vercel the SDK can authenticate through the linked store without
  // BLOB_READ_WRITE_TOKEN ever being set, so the variable proves nothing.
  let blob: { ok: boolean; error?: string };
  try {
    await deadline(list({ limit: 1 }), 6000);
    blob = { ok: true };
  } catch (error) {
    blob = { ok: false, error: error instanceof Error ? error.message : 'unknown' };
  }

  let store: { ok: boolean; ping?: string; posts?: number; error?: string };
  try {
    const ping = await deadline(pingStore(), 6000);
    store = { ok: true, ping, posts: (await deadline(allPosts(), 6000)).length };
  } catch (error) {
    store = { ok: false, error: error instanceof Error ? error.message : 'unknown' };
  }

  const ok = env.startDateConfigured && store.ok && blob.ok;
  res.status(ok ? 200 : 503).json({ ok, build, day: currentDay(), env, seen, store, blob });
}
