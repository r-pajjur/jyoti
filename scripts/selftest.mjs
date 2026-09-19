#!/usr/bin/env node
/**
 * Offline self-test: runs the serverless handlers against a fake Padlet board.
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

process.env.PADLET_API_KEY = 'test-key';
process.env.PADLET_BOARD_ID = 'test-board';
process.env.JYOTI_TIMEZONE = 'UTC';
process.env.JYOTI_TOTAL_DAYS = '30';
process.env.JYOTI_SEND_HOUR = '8';

// Pin "today" to day 3 of the ritual.
const today = new Date();
const start = new Date(today.getTime() - 2 * 86_400_000);
process.env.JYOTI_START_DATE = start.toISOString().slice(0, 10);

const board = {
  data: { id: 'test-board', type: 'board', attributes: { title: 'Jyoti test' } },
  included: [
    post('p1', '💧 Day 3 · Prompt', 'the prompt', null),
    post('p2', 'Lakshmi · Day 3', 'a still morning', 'https://blob.example/1.jpg'),
    post('p3', 'Meera Nair · Day 3', 'grateful', null),
    post('p4', 'Lakshmi · Day 1', 'came home', null),
    post('p5', 'Anjali · Day 2', 'my altar', 'https://blob.example/2.jpg'),
  ],
};

function post(id, subject, body, url) {
  return {
    id,
    type: 'post',
    attributes: {
      content: { subject, body: `<p>${body}</p>`, attachment: url ? { url, previewImageUrl: url } : null },
      createdAt: new Date().toISOString(),
      webUrl: `https://padlet.com/${id}`,
    },
  };
}

let createdPosts = 0;
let reactions = 0;
globalThis.__demoOrigin = 'https://blob.test';
globalThis.fetch = async (url, init) => {
  const target = String(url);
  if (target.includes('/boards/test-board?include=posts')) {
    return new Response(JSON.stringify(board), { status: 200 });
  }
  if (target.endsWith('/boards/test-board/posts') && init?.method === 'POST') {
    createdPosts++;
    const sent = JSON.parse(init.body).data.attributes.content;
    const created = post(`new${createdPosts}`, sent.subject, sent.body, sent.attachment?.url ?? null);
    board.included.push(created);
    return new Response(JSON.stringify({ data: created }), { status: 201 });
  }
  if (/\/posts\/[^/]+\/reactions$/.test(target) && init?.method === 'POST') {
    reactions++;
    return new Response(JSON.stringify({ data: {} }), { status: 201 });
  }
  throw new Error(`unexpected fetch: ${target}`);
};

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

const dir = await mkdtemp(join(tmpdir(), 'jyoti-'));
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

  const t = await call(todayHandler);
  check('GET /api/today returns day 3 and its prompt', () => {
    assert.equal(t.statusCode, 200);
    assert.equal(t.payload.day, 3);
    assert.equal(t.payload.phase, 'during');
    assert.equal(t.payload.prompt.type, 'photo');
    assert.match(t.payload.prompt.text, /green/i);
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
    assert.equal(open.payload.posts.find((p) => p.id === 'p2').mine, true);
    assert.equal(open.payload.posts.find((p) => p.id === 'p3').mine, false);
  });

  check('the daily prompt post is excluded from the feed', () => {
    assert.equal(open.payload.posts.some((p) => p.id === 'p1'), false);
  });

  check('HTML is stripped out of Padlet bodies', () => {
    assert.equal(open.payload.posts.find((p) => p.id === 'p2').body, 'a still morning');
  });

  check('a multi-word name parses back out of the subject line', () => {
    assert.equal(open.payload.posts.find((p) => p.id === 'p3').author, 'Meera Nair');
  });

  check('attachment URLs survive the round trip', () => {
    assert.equal(open.payload.posts.find((p) => p.id === 'p2').photoUrl, 'https://blob.example/1.jpg');
  });

  const archive = await call(archiveHandler, { name: 'Priya' });
  check('archive opens past days but keeps today gated', () => {
    const byDay = Object.fromEntries(archive.payload.days.map((d) => [d.day, d]));
    assert.equal(byDay[3].locked, true);
    assert.deepEqual(byDay[3].posts, []);
    assert.equal(byDay[2].locked, false);
    assert.equal(byDay[2].posts.length, 1);
    assert.equal(byDay[1].posts.length, 1);
  });

  check('archive is ordered newest day first and stops at today', () => {
    assert.deepEqual(archive.payload.days.map((d) => d.day), [3, 2, 1]);
  });

  const missing = await call(feedHandler, {});
  check('a request without a name is rejected', () => assert.equal(missing.statusCode, 400));

  const wrongMethod = await call(feedHandler, { name: 'Lakshmi' }, undefined, 'POST');
  check('the wrong HTTP method is rejected', () => assert.equal(wrongMethod.statusCode, 405));

  /* ── the capture path ───────────────────────────────────────────────── */

  const noContent = await call(postHandler, {}, { name: 'Lakshmi' }, 'POST');
  check('a post with neither photo nor words is rejected', () => assert.equal(noContent.statusCode, 400));

  const anonymous = await call(postHandler, {}, { text: 'hello' }, 'POST');
  check('a post without a name is rejected', () => assert.equal(anonymous.statusCode, 400));

  const written = await call(postHandler, {}, { name: 'Priya', text: 'a quiet morning' }, 'POST');
  check('a text-only post reaches Padlet under the day subject', () => {
    assert.equal(written.statusCode, 201);
    assert.equal(written.payload.post.author, 'Priya');
    assert.equal(written.payload.post.day, 3);
  });

  const PIXEL =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const withPhoto = await call(postHandler, {}, { name: 'Priya', text: 'the sky now', photo: PIXEL }, 'POST');
  check('a photo is hosted first, then handed to Padlet as a URL', () => {
    assert.equal(withPhoto.statusCode, 201);
    assert.match(withPhoto.payload.post.photoUrl, /^https?:\/\//);
    assert.equal(globalThis.__blobs.size, 1);
  });

  const badType = await call(postHandler, {}, { name: 'Priya', photo: 'x', photoType: 'image/gif' }, 'POST');
  check('an unsupported image type is refused', () => assert.equal(badType.statusCode, 502));

  const revealed = await call(feedHandler, { name: 'Priya' });
  check('posting unlocks the feed for that person', () => {
    assert.equal(revealed.payload.locked, false);
    assert.ok(revealed.payload.posts.some((post) => post.mine));
  });

  const blessed = await call(reactHandler, {}, { postId: 'p2' }, 'POST');
  check('a blessing is recorded on Padlet', () => {
    assert.equal(blessed.statusCode, 200);
    assert.equal(reactions, 1);
  });

  const blessNothing = await call(reactHandler, {}, {}, 'POST');
  check('a blessing without a post id is rejected', () => assert.equal(blessNothing.statusCode, 400));

  console.log(`\n\x1b[32m${passed} checks passed\x1b[0m\n`);
} finally {
  await rm(dir, { recursive: true, force: true });
}
