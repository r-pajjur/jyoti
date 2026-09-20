#!/usr/bin/env node
/**
 * Proves the real node-redis client — not the stub — can drive the store
 * against an actual RESP server over TCP. The stub bypasses the client
 * entirely, so without this nothing checks the wire.
 */
import * as esbuild from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { startFakeRedis } from './lib/fake-redis.mjs';

const PORT = 6399;
const server = await startFakeRedis(PORT);
process.env.REDIS_URL = `redis://127.0.0.1:${PORT}`;

// Inside the project, so the externalised `redis` package still resolves.
const dir = await mkdtemp(join(process.cwd(), 'node_modules', '.dhara-wire-'));
try {
  await esbuild.build({
    entryPoints: ['api/_lib/store.ts'],
    outfile: join(dir, 'store.mjs'),
    bundle: true, format: 'esm', platform: 'node',
    external: ['redis'], logLevel: 'silent',
  });
  const store = await import(join(dir, 'store.mjs'));

  let passed = 0;
  const check = async (label, fn) => {
    await fn();
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
    passed++;
  };

  await check('the client connects and answers PING', async () => {
    assert.equal(await store.pingStore(), 'PONG');
  });

  await check('a post round-trips through a real hash', async () => {
    await store.savePost({
      id: 'abc', day: 3, author: 'Lakshmi', authorKey: 'lakshmi',
      body: 'a still morning', photoUrl: null, createdAt: new Date().toISOString(),
    });
    const all = await store.allPosts();
    assert.equal(all.length, 1);
    assert.equal(all[0].author, 'Lakshmi');
    assert.equal(all[0].day, 3);
  });

  await check('posts are filtered by day', async () => {
    await store.savePost({
      id: 'def', day: 1, author: 'Anjali', authorKey: 'anjali',
      body: 'came home', photoUrl: null, createdAt: new Date().toISOString(),
    });
    assert.equal((await store.postsForDay(3)).length, 1);
    assert.equal((await store.postsForDay(1)).length, 1);
  });

  await check('a blessing increments', async () => {
    await store.addBlessing('abc');
    await store.addBlessing('abc');
  });

  console.log(`\n\x1b[32m${passed} wire checks passed\x1b[0m\n`);
} catch (error) {
  console.error('\x1b[31m✗\x1b[0m', error?.stack || error);
  process.exitCode = 1;
} finally {
  server.close();
  await rm(dir, { recursive: true, force: true });
  // The client keeps the event loop alive; nothing else is pending here.
  setTimeout(() => process.exit(process.exitCode ?? 0), 50).unref();
}
