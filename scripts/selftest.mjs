#!/usr/bin/env node
/**
 * Offline self-test: runs the serverless handlers against an in-memory store.
 * No API key, no network, no Blob. Checks day maths, subject parsing, the
 * reveal gate, and the archive's past-days-are-open rule.
 *
 *   node scripts/selftest.mjs
 */

import * as esbuild from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { writeDemoStubs } from './lib/stubs.mjs';

process.env.REDIS_URL = 'redis://stub.invalid:6379';
process.env.DHARA_TIMEZONE = 'UTC';
process.env.DHARA_TOTAL_DAYS = '30';
process.env.DHARA_SEND_HOUR = '8';

// Pin "today" to day 3 of the ritual.
const today = new Date();
const start = new Date(today.getTime() - 2 * 86_400_000);
process.env.DHARA_START_DATE = start.toISOString().slice(0, 10);

globalThis.__demoOrigin = 'https://blob.test';

function fakeRes() {
  const res = {
    statusCode: 0,
    payload: undefined,
    setHeader() {},
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(value) {
      res.payload = value;
      return res;
    },
  };
  return res;
}

async function call(handler, query = {}, body = undefined, method = 'GET', headers = {}) {
  const res = fakeRes();
  await handler({ method, query, body, headers }, res);
  return res;
}

const dir = await mkdtemp(join(tmpdir(), 'dhara-'));
try {
  await esbuild.build({
    entryPoints: ['api/today.ts', 'api/feed.ts', 'api/archive.ts', 'api/post.ts', 'api/react.ts'],
    entryNames: '[name]',
    alias: await writeDemoStubs(dir),
    outdir: dir,
    bundle: true,
    format: 'esm',
    platform: 'node',
    outExtension: { '.js': '.mjs' },
    logLevel: 'silent',
  });

  const todayHandler = (await import(join(dir, 'today.mjs'))).default;
  const feedHandler = (await import(join(dir, 'feed.mjs'))).default;
  const archiveHandler = (await import(join(dir, 'archive.mjs'))).default;
  const postHandler = (await import(join(dir, 'post.mjs'))).default;
  const reactHandler = (await import(join(dir, 'react.mjs'))).default;

  let passed = 0;
  const check = (label, fn) => {
    fn();
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
    passed++;
  };

  /* Seed the board the way the app does — through the post handler itself. */
  const seed = async (name, day, text, photo) =>
    call(postHandler, {}, { name, day, text, ...(photo ? { photo } : {}) }, 'POST');

  const PIXEL =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  await seed('Lakshmi', 1, 'came home');
  await seed('Anjali', 2, 'my altar');
  await seed('Lakshmi', 3, 'a still morning', PIXEL);
  await seed('Meera Nair', 3, 'grateful');

  const t = await call(todayHandler);
  check('GET /api/today returns day 3 and its prompt', () => {
    assert.equal(t.statusCode, 200);
    assert.equal(t.payload.day, 3);
    assert.equal(t.payload.phase, 'during');
    // Structure, not wording — the prompts are edited often.
    assert.ok(['photo', 'reflection'].includes(t.payload.prompt.type));
    assert.ok(t.payload.prompt.text.length > 10);
    assert.ok(t.payload.prompt.title.length > 0);
  });

  const locked = await call(feedHandler, { name: 'Priya' });
  check('feed is locked, and leaks only a count, for someone who has not posted', () => {
    assert.equal(locked.payload.locked, true);
    assert.equal(locked.payload.count, 2);
    assert.equal(locked.payload.groupSize, 20);
    assert.deepEqual(locked.payload.posts, []);
  });

  check('the prompt itself is withheld while the feed is locked', () => {
    assert.equal(locked.payload.prompt, undefined);
  });

  const open = await call(feedHandler, { name: '  lakshmi  ' });
  check('the prompt arrives once the feed is unlocked', () => {
    assert.ok(open.payload.prompt.text);
  });

  check('feed unlocks on a case- and space-insensitive name match', () => {
    assert.equal(open.payload.locked, false);
    assert.equal(open.payload.posts.length, 2);
    assert.equal(open.payload.posts.filter((post) => post.mine).length, 1);
    assert.equal(open.payload.posts.find((post) => post.mine).author, 'Lakshmi');
  });

  check('a multi-word name is kept intact', () => {
    assert.ok(open.payload.posts.some((post) => post.author === 'Meera Nair'));
  });

  check('a photo survives the round trip as a URL', () => {
    const withPhoto = open.payload.posts.find((post) => post.photoUrl);
    assert.match(withPhoto.photoUrl, /^https?:\/\//);
    assert.equal(globalThis.__blobs.size, 1);
  });

  check('one day\'s posts never leak into another', () => {
    assert.ok(open.payload.posts.every((post) => post.day === 3));
  });

  const archive = await call(archiveHandler, { name: 'Priya' });
  check('archive opens past days but keeps today gated', () => {
    const byDay = Object.fromEntries(archive.payload.days.map((entry) => [entry.day, entry]));
    assert.equal(byDay[3].locked, true);
    assert.deepEqual(byDay[3].posts, []);
    assert.equal(byDay[3].count, 2);
    assert.equal(byDay[1].locked, false);
    assert.equal(byDay[1].posts.length, 1);
  });

  check('archive is ordered newest day first and stops at today', () => {
    assert.deepEqual(archive.payload.days.map((entry) => entry.day), [3, 2, 1]);
    assert.equal(archive.payload.totalDays, 30);
  });

  /* Before Day 1 the feed must say so, and offer nothing to post. */
  {
    const realStart = process.env.DHARA_START_DATE;
    process.env.DHARA_START_DATE = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    const early = await call(
      (await import(join(dir, `feed.mjs?before=${Date.now()}`))).default,
      { name: 'Priya' },
    );
    check('before Day 1 the feed reports the wait instead of a locked day', () => {
      assert.equal(early.payload.active, false);
      assert.equal(early.payload.phase, 'before');
      assert.ok(early.payload.startDate);
      assert.equal(early.payload.count, 0);
      assert.deepEqual(early.payload.posts, []);
    });
    process.env.DHARA_START_DATE = realStart;
  }

  const missing = await call(feedHandler, {});
  check('a request without a name is rejected', () => assert.equal(missing.statusCode, 400));

  const wrongMethod = await call(feedHandler, { name: 'Lakshmi' }, undefined, 'POST');
  check('the wrong HTTP method is rejected', () => assert.equal(wrongMethod.statusCode, 405));

  /* ── the capture path ───────────────────────────────────────────────── */

  const noContent = await call(postHandler, {}, { name: 'Lakshmi' }, 'POST');
  check('a post with neither photo nor words is rejected', () => assert.equal(noContent.statusCode, 400));

  const anonymous = await call(postHandler, {}, { text: 'hello' }, 'POST');
  check('a post without a name is rejected', () => assert.equal(anonymous.statusCode, 400));

  const outside = await call(postHandler, {}, { name: 'Priya', day: 99, text: 'too far' }, 'POST');
  check('a day outside the thirty is rejected', () => assert.equal(outside.statusCode, 400));

  const badType = await call(postHandler, {}, { name: 'Priya', photo: 'x', photoType: 'image/gif' }, 'POST');
  check('an unsupported image type is refused', () => assert.equal(badType.statusCode, 502));

  const written = await call(postHandler, {}, { name: 'Priya', text: 'a quiet morning' }, 'POST');
  check('a post is stored and comes back with an id', () => {
    assert.equal(written.statusCode, 201);
    assert.equal(written.payload.post.author, 'Priya');
    assert.equal(written.payload.post.day, 3);
    assert.ok(written.payload.post.id);
  });

  const revealed = await call(feedHandler, { name: 'Priya' });
  check('posting unlocks the feed for that person', () => {
    assert.equal(revealed.payload.locked, false);
    assert.equal(revealed.payload.count, 3);
    assert.ok(revealed.payload.posts.some((post) => post.mine));
  });

  const blessed = await call(reactHandler, {}, { postId: written.payload.post.id }, 'POST');
  check('a blessing is recorded', () => {
    assert.equal(blessed.statusCode, 200);
    assert.equal(globalThis.__redis.get('dhara:blessings')[written.payload.post.id], 1);
  });

  const blessNothing = await call(reactHandler, {}, {}, 'POST');
  check('a blessing without a post id is rejected', () => assert.equal(blessNothing.statusCode, 400));

  console.log(`\n\x1b[32m${passed} checks passed\x1b[0m\n`);
} finally {
  await rm(dir, { recursive: true, force: true });
}
