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

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const at = args.indexOf('--swap');
const [a, b] = at >= 0 ? [Number(args[at + 1]), Number(args[at + 2])] : [];

if (!Number.isInteger(a) || !Number.isInteger(b)) {
  console.error('Usage: node scripts/renumber.mjs --swap <dayA> <dayB> [--apply]');
  process.exit(1);
}
if (!process.env.REDIS_URL) {
  console.error('Set REDIS_URL (Vercel → Settings → Environment Variables → REDIS_URL).');
  process.exit(1);
}

const client = createClient({ url: process.env.REDIS_URL, socket: { connectTimeout: 8000 } });
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
