#!/usr/bin/env node
/**
 * Local demo server. Runs the REAL serverless handlers against an in-memory
 * Redis and Blob, so the whole app is clickable with no credentials.
 *
 *   npm run demo        → http://localhost:4000
 *
 * What is real: every screen, the day maths, the post-to-reveal gate, the
 * archive, blessings, and all the api/ handler code.
 * What is faked: only the storage. Nothing survives a restart.
 */

import * as esbuild from 'esbuild';
import { createServer } from 'node:http';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir, networkInterfaces } from 'node:os';
import { join, extname } from 'node:path';
import { writeDemoStubs } from './lib/stubs.mjs';

const PORT = Number(process.env.PORT || 4000);

process.env.KV_REST_API_URL = 'https://stub.invalid';
process.env.KV_REST_API_TOKEN = 'stub';
process.env.JYOTI_TIMEZONE = 'UTC';
process.env.JYOTI_TOTAL_DAYS = '30';
process.env.JYOTI_SEND_HOUR = '8';

// Pin the demo to Day 3, so there is already an archive behind you.
process.env.JYOTI_START_DATE = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);

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

/* Seed a board mid-ritual, through the real write path. */
const seed = async (name, day, text) => {
  const res = {
    statusCode: 200,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json() { return this; },
  };
  await handlers.post({ method: 'POST', query: {}, body: { name, day, text }, headers: {} }, res);
};

await seed('Lakshmi', 1, 'I carried back the quiet of the river at dawn.');
await seed('Meera Nair', 1, 'A stillness I did not have before.');
await seed('Anjali', 2, 'My small corner, swept and lit.');
await seed('Lakshmi', 2, 'Marigolds from the balcony today.');
await seed('Anjali', 3, 'The light through the kitchen window at 6am.');
await seed('Meera Nair', 3, 'My mother on the phone, laughing.');

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
  console.log(`\n💧 Jyoti demo — Day 3 of 30, in-memory storage, no keys needed`);
  console.log(`   laptop  http://localhost:${PORT}`);
  if (lan) console.log(`   phone   http://${lan}:${PORT}   (screens only — install needs https)`);
  console.log(`\n   Seeded: 2 past days, and 2 other people have already posted today.`);
  console.log(`   Try: onboard as yourself → Today (locked) → Capture → Today (revealed) → Calendar.\n`);
});
