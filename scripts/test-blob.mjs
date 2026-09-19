#!/usr/bin/env node
/**
 * Proves the photo path against the real Vercel Blob store: upload through the
 * app's own uploadPhoto(), then fetch the returned URL back and compare bytes.
 *
 *   BLOB_READ_WRITE_TOKEN=… node scripts/test-blob.mjs
 */
import * as esbuild from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('Set BLOB_READ_WRITE_TOKEN first (vercel env pull .env, or paste it inline).');
  process.exit(1);
}

// A 4×4 red PNG — small, but real image bytes, not a placeholder string.
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC';

const dir = await mkdtemp(join(process.cwd(), 'node_modules', '.jyoti-blob-'));
try {
  await esbuild.build({
    entryPoints: ['api/_lib/photos.ts'],
    outfile: join(dir, 'photos.mjs'),
    bundle: true, format: 'esm', platform: 'node',
    external: ['@vercel/blob'], logLevel: 'silent',
  });
  const { decodePhoto, uploadPhoto } = await import(join(dir, 'photos.mjs'));

  let passed = 0;
  const check = async (label, fn) => { await fn(); console.log(`  \x1b[32m✓\x1b[0m ${label}`); passed++; };

  const photo = decodePhoto(`data:image/png;base64,${PNG_B64}`);
  await check('the image decodes to real bytes', () => {
    assert.equal(photo.contentType, 'image/png');
    assert.ok(photo.bytes.length > 50);
  });

  let src;
  await check('uploadPhoto() puts it in the Blob store', async () => {
    src = await uploadPhoto(photo, 'Wire Test', 3);
    assert.ok(src, 'expected an <img> src back');
  });
  console.log(`     → ${src}`);

  if (src.startsWith('/api/photo')) {
    // Private store: the bytes come back through our own endpoint.
    await check('the private blob reads back through get() with matching bytes', async () => {
      const { get } = await import('@vercel/blob');
      const pathname = decodeURIComponent(new URL(src, 'http://x').searchParams.get('p'));
      const result = await get(pathname, { access: 'private' });
      assert.ok(result, 'get() returned nothing');
      assert.equal(result.statusCode, 200);
      const chunks = [];
      const reader = result.stream.getReader();
      for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(Buffer.from(value)); }
      const got = Buffer.concat(chunks);
      assert.equal(got.length, photo.bytes.length);
      assert.ok(got.equals(photo.bytes), 'bytes differ from what was uploaded');
    });
  } else {
    await check('the public URL is fetchable and the bytes match', async () => {
      const res = await fetch(src);
      assert.equal(res.status, 200, `expected 200, got ${res.status}`);
      const got = Buffer.from(await res.arrayBuffer());
      assert.ok(got.equals(photo.bytes), 'bytes differ from what was uploaded');
    });
  }

  await check('an oversized photo is refused before any upload', () => {
    const huge = { bytes: Buffer.alloc(5 * 1024 * 1024), contentType: 'image/jpeg' };
    assert.throws(() => decodePhoto(huge.bytes.toString('base64'), 'image/jpeg'), /limit is 4MB/);
  });

  console.log(`\n\x1b[32m${passed} blob checks passed\x1b[0m — the photo path is real.\n`);
} catch (error) {
  console.error('\x1b[31m✗\x1b[0m', error?.message || error);
  process.exitCode = 1;
} finally {
  await rm(dir, { recursive: true, force: true });
}
