#!/usr/bin/env node
/**
 * Local demo server. Runs the REAL serverless handlers against an in-memory
 * fake Padlet board and a fake Blob store, so the whole app is clickable with
 * no API keys and no network.
 *
 *   npm run demo        → http://localhost:4000
 *
 * What is real: every screen, the day maths, the post-to-reveal gate, the
 * archive, blessings, and all the api/ handler code.
 * What is faked: Padlet and Vercel Blob.
 */

import * as esbuild from 'esbuild';
import { createServer } from 'node:http';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir, networkInterfaces } from 'node:os';
import { join, extname } from 'node:path';
import { writeDemoStubs } from './lib/stubs.mjs';

const PORT = Number(process.env.PORT || 4000);

process.env.PADLET_API_KEY = 'demo-key';
process.env.PADLET_BOARD_ID = 'demo-board';
process.env.JYOTI_TIMEZONE = 'UTC';
process.env.JYOTI_TOTAL_DAYS = '30';
process.env.JYOTI_SEND_HOUR = '8';

// Pin the demo to Day 3, so there is already an archive behind you.
process.env.JYOTI_START_DATE = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);

const DAY = (n) => new Date(Date.now() - (3 - n) * 86_400_000).toISOString();
let seq = 100;

function post(subject, body, url, createdAt) {
  return {
    id: `p${seq++}`,
    type: 'post',
    attributes: {
      content: { subject, body: `<p>${body}</p>`, attachment: url ? { url, previewImageUrl: url } : null },
      createdAt: createdAt || new Date().toISOString(),
      webUrl: 'https://padlet.com/demo',
    },
  };
}

// A board mid-ritual: two days behind you, and today already has other lamps lit.
const posts = [
  post('🪔 Day 1 · Prompt', 'What did you carry home?', null, DAY(1)),
  post('Lakshmi · Day 1', 'I carried back the quiet of the river at dawn.', null, DAY(1)),
  post('Meera Nair · Day 1', 'A stillness I did not have before.', null, DAY(1)),
  post('🪔 Day 2 · Prompt', 'Your altar corner.', null, DAY(2)),
  post('Anjali · Day 2', 'My small corner, swept and lit.', null, DAY(2)),
  post('Lakshmi · Day 2', 'Marigolds from the balcony today.', null, DAY(2)),
  post('🪔 Day 3 · Prompt', 'Something near you that brought peace.', null, DAY(3)),
  post('Anjali · Day 3', 'The light through the kitchen window at 6am.', null, DAY(3)),
  post('Meera Nair · Day 3', 'My mother on the phone, laughing.', null, DAY(3)),
];

let reactions = 0;
globalThis.fetch = async (url, init) => {
  const target = String(url);
  if (target.includes('/boards/demo-board?include=posts')) {
    return new Response(JSON.stringify({ data: { id: 'demo-board', type: 'board' }, included: posts }), { status: 200 });
  }
  if (target.endsWith('/boards/demo-board/posts') && init?.method === 'POST') {
    const sent = JSON.parse(init.body).data.attributes.content;
    const created = post(sent.subject, sent.body, sent.attachment?.url ?? null);
    posts.push(created);
    console.log(`  [padlet] + ${sent.subject}${sent.attachment ? ' (with photo)' : ''}`);
    return new Response(JSON.stringify({ data: created }), { status: 201 });
  }
  if (/\/posts\/[^/]+\/reactions$/.test(target) && init?.method === 'POST') {
    reactions++;
    console.log(`  [padlet] blessing #${reactions}`);
    return new Response(JSON.stringify({ data: {} }), { status: 201 });
  }
  throw new Error(`demo: unexpected fetch ${target}`);
};

const dir = await mkdtemp(join(tmpdir(), 'jyoti-demo-'));
const names = ['today', 'feed', 'archive', 'post', 'react'];
await esbuild.build({
  entryPoints: names.map((n) => `api/${n}.ts`),
  entryNames: '[name]',
  alias: await writeDemoStubs(dir),
  outdir: dir,
  bundle: true,
  format: 'esm',
  platform: 'node',
  outExtension: { '.js': '.mjs' },
  logLevel: 'silent',
});

const handlers = {};
for (const n of names) handlers[n] = (await import(join(dir, `${n}.mjs`))).default;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.map': 'application/json',
};

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  globalThis.__demoOrigin = `http://${req.headers.host}`;
  res.setHeader('Cache-Control', 'no-store');

  if (url.pathname.startsWith('/demo-blob/')) {
    const blob = globalThis.__blobs?.get(url.pathname.slice('/demo-blob/'.length));
    if (!blob) return res.writeHead(404).end('no such blob');
    res.writeHead(200, { 'Content-Type': blob.contentType });
    return res.end(Buffer.from(blob.bytes));
  }

  const route = url.pathname.replace(/^\/api\//, '');
  if (url.pathname.startsWith('/api/') && handlers[route]) {
    const vercelReq = {
      method: req.method,
      query: Object.fromEntries(url.searchParams),
      body: req.method === 'GET' ? undefined : await readBody(req),
      headers: req.headers,
    };
    const vercelRes = {
      statusCode: 200,
      setHeader: (k, v) => res.setHeader(k, v),
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(value) {
        res.writeHead(this.statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(value));
        return this;
      },
    };
    console.log(`  ${req.method} ${url.pathname}${url.search}`);
    try {
      await handlers[route](vercelReq, vercelRes);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(error?.message || error) }));
    }
    return;
  }

  const rel = url.pathname === '/' ? '/index.html' : url.pathname;
  try {
    const file = await readFile(join(process.cwd(), 'public', rel));
    res.writeHead(200, { 'Content-Type': TYPES[extname(rel)] || 'application/octet-stream' });
    res.end(file);
  } catch {
    const file = await readFile(join(process.cwd(), 'public', 'index.html'));
    res.writeHead(200, { 'Content-Type': TYPES['.html'] });
    res.end(file);
  }
});

const lan = Object.values(networkInterfaces())
  .flat()
  .find((i) => i && i.family === 'IPv4' && !i.internal)?.address;

server.listen(PORT, () => {
  console.log(`\n🪔 Jyoti demo — Day 3 of 30, fake Padlet board, no keys needed`);
  console.log(`   laptop  http://localhost:${PORT}`);
  if (lan) console.log(`   phone   http://${lan}:${PORT}   (screens only — install needs https)`);
  console.log(`\n   Seeded: 2 past days, and 2 other people have already posted today.`);
  console.log(`   Try: onboard as yourself → Today (locked) → Capture → Today (revealed) → Calendar.\n`);
});
