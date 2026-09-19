/** In-memory stand-ins for Upstash Redis and web-push, used by selftest.mjs. */
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export const REDIS_STUB = `
// Each handler is bundled separately, so the state must live on globalThis.
globalThis.__redis ??= new Map();
const store = globalThis.__redis;
export class Redis {
  constructor() {}
  async hget(key, field) { return (store.get(key) ?? {})[field] ?? null; }
  async hset(key, obj) { store.set(key, { ...(store.get(key) ?? {}), ...obj }); return 1; }
  async hgetall(key) { return store.get(key) ?? null; }
  async hdel(key, field) { const h = store.get(key) ?? {}; delete h[field]; store.set(key, h); return 1; }
  async hlen(key) { return Object.keys(store.get(key) ?? {}).length; }
  async hincrby(key, field, by) {
    const h = store.get(key) ?? {};
    h[field] = Number(h[field] ?? 0) + by;
    store.set(key, h);
    return h[field];
  }
  async set(key, value, opts) {
    if (opts?.nx && store.has(key)) return null;
    store.set(key, value);
    return 'OK';
  }
  async del(key) { store.delete(key); return 1; }
}
`;

export const WEBPUSH_STUB = `
globalThis.__pushes ??= [];
export default {
  setVapidDetails() {},
  async sendNotification(subscription, payload) {
    globalThis.__pushes.push({ endpoint: subscription.endpoint, payload });
    if (subscription.endpoint.includes('gone')) {
      const error = new Error('gone');
      error.statusCode = 410;
      throw error;
    }
    return { statusCode: 201 };
  },
};
`;

export async function writeStubs(dir) {
  await mkdir(dir, { recursive: true });
  const redis = join(dir, 'stub-redis.mjs');
  const webpush = join(dir, 'stub-webpush.mjs');
  await writeFile(redis, REDIS_STUB);
  await writeFile(webpush, WEBPUSH_STUB);
  return { '@upstash/redis': redis, 'web-push': webpush };
}

/** Stand-in for @vercel/blob used by the demo server: keeps bytes in memory and
 *  hands back a URL this machine can actually serve, so photos really appear. */
export const BLOB_STUB = `
globalThis.__blobs ??= new Map();
export async function put(key, bytes, opts) {
  const id = key.replace(/[^a-zA-Z0-9.-]+/g, '-') + '-' + globalThis.__blobs.size;
  globalThis.__blobs.set(id, { bytes, contentType: opts?.contentType || 'image/jpeg' });
  return { url: (globalThis.__demoOrigin || 'http://localhost:4000') + '/demo-blob/' + id };
}
`;

export async function writeDemoStubs(dir) {
  const base = await writeStubs(dir);
  const blob = join(dir, 'stub-blob.mjs');
  await writeFile(blob, BLOB_STUB);
  return { ...base, '@vercel/blob': blob };
}
