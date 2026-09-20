/** In-memory stand-ins for Upstash Redis and web-push, used by selftest.mjs. */
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export const REDIS_STUB = `
// Each handler is bundled separately, so the state must live on globalThis.
globalThis.__redis ??= new Map();
const store = globalThis.__redis;
export function createClient() {
  return {
    isOpen: true,
    on() { return this; },
    async connect() { return this; },
    async ping() { return 'PONG'; },
    async hGet(key, field) { return (store.get(key) ?? {})[field] ?? null; },
    async hSet(key, field, value) {
      store.set(key, { ...(store.get(key) ?? {}), [field]: value });
      return 1;
    },
    async hGetAll(key) { return store.get(key) ?? {}; },
    async hDel(key, field) { const h = store.get(key) ?? {}; delete h[field]; store.set(key, h); return 1; },
    async hLen(key) { return Object.keys(store.get(key) ?? {}).length; },
    async hIncrBy(key, field, by) {
      const h = store.get(key) ?? {};
      h[field] = Number(h[field] ?? 0) + by;
      store.set(key, h);
      return h[field];
    },
  };
}
`;


export async function writeStubs(dir) {
  await mkdir(dir, { recursive: true });
  const redis = join(dir, 'stub-redis.mjs');
  await writeFile(redis, REDIS_STUB);
  return { redis: redis };
}

/** Stand-in for @vercel/blob used by the demo server: keeps bytes in memory and
 *  hands back a URL this machine can actually serve, so photos really appear. */
export const BLOB_STUB = `
globalThis.__blobs ??= new Map();
export async function put(key, bytes, opts) {
  const id = key.replace(/[^a-zA-Z0-9.-]+/g, '-') + '-' + globalThis.__blobs.size;
  globalThis.__blobs.set(id, { bytes, contentType: opts?.contentType || 'image/jpeg' });
  return {
    url: (globalThis.__demoOrigin || 'http://localhost:4000') + '/demo-blob/' + id,
    pathname: id,
  };
}
export async function list({ limit = 1000 } = {}) {
  return { blobs: [...globalThis.__blobs.keys()].slice(0, limit).map((pathname) => ({ pathname })) };
}
export async function get(pathname) {
  const blob = globalThis.__blobs.get(pathname);
  if (!blob) return null;
  return {
    statusCode: 200,
    headers: new Headers({ 'content-type': blob.contentType }),
    stream: new Blob([blob.bytes]).stream(),
  };
}
`;

export async function writeDemoStubs(dir) {
  const base = await writeStubs(dir);
  const blob = join(dir, 'stub-blob.mjs');
  await writeFile(blob, BLOB_STUB);
  return { ...base, '@vercel/blob': blob };
}
