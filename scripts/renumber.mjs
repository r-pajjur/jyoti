#!/usr/bin/env node
/**
 * Moves stored posts between day numbers, for when the calendar has to be
 * corrected after people have already posted.
 *
 *   REDIS_URL=… node scripts/renumber.mjs --swap 2 3          # show the plan
 *   REDIS_URL=… node scripts/renumber.mjs --swap 2 3 --apply  # write it
 *
 * A post keeps the day it was written under, so changing the start date alone
 * leaves old posts on the wrong day. This fixes the data to match.
 */
import { createClient } from 'redis';
import { readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const at = args.indexOf('--swap');
const [a, b] = at >= 0 ? [Number(args[at + 1]), Number(args[at + 2])] : [];

if (!Number.isInteger(a) || !Number.isInteger(b)) {
  console.error('Usage: node scripts/renumber.mjs --swap <dayA> <dayB> [--apply]');
  process.exit(1);
}
/** Takes --url, then REDIS_URL, then a REDIS_URL line in .env. */
async function connectionUrl() {
  const flagAt = args.indexOf('--url');
  if (flagAt >= 0 && args[flagAt + 1]) return args[flagAt + 1];
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  try {
    const env = await readFile('.env', 'utf8');
    const line = env.split('\n').find((l) => l.startsWith('REDIS_URL='));
    if (line) return line.slice('REDIS_URL='.length).trim().replace(/^["']|["']$/g, '');
  } catch {
    /* no .env, which is fine */
  }
  return '';
}

const url = (await connectionUrl()).trim();
if (!url || !/^rediss?:\/\/.+/.test(url)) {
  console.error(`
Need the real Redis connection string, not a placeholder.

Get it from Vercel → your project → Settings → Environment Variables →
REDIS_URL → the ⋯ menu → Copy Value. It looks like:

  redis://default:SOMEPASSWORD@some-host.redis.io:13010

Then run one of:

  npm run renumber -- --swap 2 3 --url 'redis://…'
  REDIS_URL='redis://…' npm run renumber -- --swap 2 3

Quote it: the password can contain characters your shell would otherwise eat.
${url ? `\nWhat was passed: ${url.slice(0, 24)}…\n` : ''}`);
  process.exit(1);
}

const client = createClient({ url, socket: { connectTimeout: 8000 } });
client.on('error', (error) => console.error('[redis]', error?.message ?? error));
await client.connect();

const KEY = 'dhara:posts';
const rows = (await client.hGetAll(KEY)) ?? {};
const posts = Object.entries(rows)
  .map(([id, value]) => {
    try {
      return [id, JSON.parse(value)];
    } catch {
      return null;
    }
  })
  .filter(Boolean);

const moving = posts.filter(([, p]) => p.day === a || p.day === b);
const counts = (day) => posts.filter(([, p]) => p.day === day).length;

console.log(`\n${posts.length} posts stored. Day ${a}: ${counts(a)}   Day ${b}: ${counts(b)}`);
console.log(`\nPlan — swap day ${a} and day ${b}:\n`);
for (const [, p] of moving.sort((x, y) => x[1].createdAt.localeCompare(y[1].createdAt))) {
  const to = p.day === a ? b : a;
  console.log(`  ${p.author.padEnd(16)} ${p.createdAt.slice(0, 16)}   day ${p.day} → day ${to}`);
}

if (!apply) {
  console.log(`\nDry run. Nothing written. Re-run with --apply to make these changes.\n`);
  await client.quit();
  process.exit(0);
}

let written = 0;
for (const [id, p] of moving) {
  const updated = { ...p, day: p.day === a ? b : a };
  await client.hSet(KEY, id, JSON.stringify(updated));
  written++;
}
console.log(`\n${written} posts moved. Day ${a}: ${counts(b)}   Day ${b}: ${counts(a)}\n`);
await client.quit();
