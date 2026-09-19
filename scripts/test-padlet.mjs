#!/usr/bin/env node
/**
 * Jyoti — Padlet photo-attachment round-trip test.
 *
 * Verifies the ONE path the whole capture flow depends on:
 *   image bytes → Vercel Blob (public URL) → Padlet post attachment → read back.
 *
 * Padlet's public API has no multipart upload and no DELETE-post endpoint, so
 * run this against a scratch board: the posts it creates stay there.
 *
 *   node scripts/test-padlet.mjs
 *   node scripts/test-padlet.mjs --no-blob     # skip Blob, attach a known URL
 */

import { readFile } from 'node:fs/promises';
import { encodePNG } from './lib/png.mjs';
import { renderLamp } from './lib/lamp.mjs';

const NO_BLOB = process.argv.includes('--no-blob');
const FALLBACK_IMAGE = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png';

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

async function loadDotEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      const text = await readFile(file, 'utf8');
      for (const line of text.split('\n')) {
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
        if (!m || !m[1]) continue;
        const value = (m[2] ?? '').trim().replace(/^['"]|['"]$/g, '');
        if (value && !process.env[m[1]]) process.env[m[1]] = value;
      }
      console.log(c.dim(`  loaded ${file}`));
    } catch {
      /* optional */
    }
  }
}

let stepNumber = 0;
async function step(label, fn) {
  stepNumber++;
  process.stdout.write(`${c.bold(`${stepNumber}.`)} ${label} … `);
  try {
    const result = await fn();
    console.log(c.green('ok'));
    return result;
  } catch (error) {
    console.log(c.red('FAILED'));
    console.log(c.red(`   ${error.message}`));
    if (error.detail) console.log(c.dim(`   ${String(error.detail).slice(0, 900)}`));
    process.exitCode = 1;
    throw error;
  }
}

function detailed(message, detail) {
  const error = new Error(message);
  error.detail = detail;
  return error;
}

async function padlet(base, path, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'X-API-KEY': process.env.PADLET_API_KEY,
      Accept: 'application/vnd.api+json',
      ...(init.body ? { 'Content-Type': 'application/vnd.api+json' } : {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw detailed(`${init.method || 'GET'} ${path} → HTTP ${res.status}`, text);
  return text ? JSON.parse(text) : {};
}

console.log(c.bold('\n🪔 Jyoti — Padlet attachment round-trip\n'));
await loadDotEnv();

const boardId = process.env.PADLET_BOARD_ID;
const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

try {
  await step('config present', async () => {
    const missing = ['PADLET_API_KEY', 'PADLET_BOARD_ID'].filter((k) => !process.env[k]);
    if (missing.length) throw new Error(`missing env: ${missing.join(', ')}`);
    if (!NO_BLOB && !process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('missing env: BLOB_READ_WRITE_TOKEN (or rerun with --no-blob)');
    }
  });

  // The docs show both https://api.padlet.dev and .../v1 — settle it empirically.
  const base = await step('resolve API base URL', async () => {
    const candidates = [
      process.env.PADLET_API_BASE,
      'https://api.padlet.dev/v1',
      'https://api.padlet.dev',
    ].filter(Boolean).map((u) => u.replace(/\/+$/, ''));
    const failures = [];
    for (const candidate of candidates) {
      try {
        await padlet(candidate, `/boards/${boardId}`);
        console.log(c.dim(`\n   → ${candidate}`));
        return candidate;
      } catch (error) {
        failures.push(`${candidate}: ${error.message}`);
      }
    }
    throw detailed('no base URL answered', failures.join('\n   '));
  });

  const before = await step('GET /boards/{id}?include=posts', async () => {
    const payload = await padlet(base, `/boards/${boardId}?include=posts`);
    const posts = (payload.included ?? []).filter((e) => e?.type === 'post');
    console.log(c.dim(`\n   → board "${payload.data?.attributes?.title ?? '?'}" · ${posts.length} existing posts`));
    return posts;
  });

  await step('POST a text-only post', async () => {
    const payload = await padlet(base, `/boards/${boardId}/posts`, {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'post',
          attributes: {
            content: { subject: `Jyoti smoke test · text · ${stamp}`, body: 'Text write path works.' },
            color: 'purple',
          },
        },
      }),
    });
    if (!payload.data?.id) throw detailed('no post id returned', JSON.stringify(payload));
    console.log(c.dim(`\n   → post ${payload.data.id}`));
  });

  const imageUrl = NO_BLOB
    ? await step('use fallback image URL (--no-blob)', async () => FALLBACK_IMAGE)
    : await step('upload PNG to Vercel Blob', async () => {
        const { put } = await import('@vercel/blob');
        const png = encodePNG(512, 512, renderLamp(512));
        const blob = await put(`jyoti/smoke-test/${Date.now()}.png`, png, {
          access: 'public',
          contentType: 'image/png',
          addRandomSuffix: true,
        });
        console.log(c.dim(`\n   → ${blob.url} (${(png.length / 1024).toFixed(0)} KB)`));
        return blob.url;
      });

  await step('image URL is publicly reachable', async () => {
    const res = await fetch(imageUrl, { method: 'GET', headers: { Range: 'bytes=0-64' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching the image`);
    const type = res.headers.get('content-type') ?? '';
    if (!type.startsWith('image/')) throw new Error(`content-type is "${type}", expected image/*`);
    console.log(c.dim(`\n   → ${type}`));
  });

  const postId = await step('POST a post with attachment.url', async () => {
    const payload = await padlet(base, `/boards/${boardId}/posts`, {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'post',
          attributes: {
            content: {
              subject: `Jyoti smoke test · photo · ${stamp}`,
              body: 'If you can see the lamp above this line, the capture flow will work.',
              attachment: { url: imageUrl, previewImageUrl: imageUrl, caption: 'Jyoti test lamp' },
            },
            color: 'orange',
          },
        },
      }),
    });
    const id = payload.data?.id;
    if (!id) throw detailed('no post id returned', JSON.stringify(payload));
    const echoed = payload.data?.attributes?.content?.attachment ?? null;
    console.log(c.dim(`\n   → post ${id}`));
    console.log(c.dim(`   → attachment echoed: ${JSON.stringify(echoed)}`));
    return id;
  });

  await step('GET /posts/{id}/attachmentData', async () => {
    const payload = await padlet(base, `/posts/${postId}/attachmentData`);
    const attrs = payload.data?.attributes ?? payload.data ?? {};
    console.log(c.dim(`\n   → ${JSON.stringify(attrs).slice(0, 400)}`));
    if (!attrs.previewImageUrl && !attrs.url) {
      console.log(c.yellow('   ! no previewImageUrl yet — Padlet may still be fetching the image'));
    }
  });

  await step('re-read the board and find the attachment', async () => {
    const payload = await padlet(base, `/boards/${boardId}?include=posts`);
    const posts = (payload.included ?? []).filter((e) => e?.type === 'post');
    const mine = posts.find((p) => String(p.id) === String(postId));
    if (!mine) throw detailed('new post not present in board read', `saw ${posts.length} posts`);
    const attachment = mine.attributes?.content?.attachment;
    if (!attachment?.url) throw detailed('attachment missing on read-back', JSON.stringify(mine.attributes?.content));
    console.log(c.dim(`\n   → ${posts.length - before.length} new post(s); attachment.url = ${attachment.url}`));
  });

  console.log(c.green(c.bold('\n✓ Round-trip works. Blob → Padlet attachment is a viable capture path.\n')));
  console.log(c.dim('  Open the board in a browser and confirm the image actually renders,'));
  console.log(c.dim('  then delete the two smoke-test posts by hand (the API has no delete).\n'));
} catch {
  console.log(c.red(c.bold('\n✗ Stopped at the step above. Nothing further was attempted.\n')));
}
