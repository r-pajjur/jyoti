/**
 * The whole database: two Redis hashes.
 *
 *   dhara:posts      postId → the post
 *   dhara:blessings  postId → how many hearts it has
 *
 * At ~25 people over 30 days this tops out around 750 small rows, so the
 * archive reads every post in one round trip and filters in memory. No schema,
 * no migrations, no query language.
 *
 * Speaks plain Redis over TCP, so any provider works — Redis Cloud, Upstash,
 * or a local server — from one REDIS_URL.
 */

import type { RedisClientType } from 'redis';

const POSTS = 'dhara:posts';
const BLESSINGS = 'dhara:blessings';

export interface DharaPost {
  id: string;
  day: number;
  /** As typed, for display. */
  author: string;
  /** Normalized, so the reveal gate survives capitalization and stray spaces. */
  authorKey: string;
  body: string;
  photoUrl: string | null;
  createdAt: string;
}

let client: RedisClientType | null = null;

/**
 * One connection per warm serverless instance, reconnected if it dropped
 * between invocations.
 */
/** Names storage providers are known to use, tried in order. */
const URL_VARS = ['REDIS_URL', 'KV_URL', 'REDIS_TLS_URL', 'UPSTASH_REDIS_URL', 'REDISCLOUD_URL'];

/**
 * Finds the connection string. Providers disagree about the variable's name,
 * so after the known ones this falls back to any variable whose value is
 * itself a redis:// URL — which is unambiguous, and saves a deploy cycle spent
 * guessing.
 */
function connectionUrl(): string | null {
  for (const name of URL_VARS) {
    const value = process.env[name];
    if (value && /^rediss?:\/\//.test(value)) return value;
  }
  for (const [, value] of Object.entries(process.env)) {
    if (value && /^rediss?:\/\/.+@/.test(value)) return value;
  }
  return null;
}

/** Names only — safe to show, and enough to see what the deployment is missing. */
export function storageVarNames(): string[] {
  return Object.keys(process.env)
    .filter((key) => /REDIS|^KV_|BLOB/.test(key))
    .sort();
}

async function redis(): Promise<RedisClientType> {
  const url = connectionUrl();
  if (!url) {
    const seen = storageVarNames();
    throw new Error(
      `Missing required environment variable: REDIS_URL. Storage variables this deployment can see: ${
        seen.length ? seen.join(', ') : 'none'
      }`,
    );
  }

  if (!client) {
    // Imported here rather than at module scope: a module-level import that
    // fails takes the whole function down with Vercel's generic "A server
    // error has occurred", while this surfaces as a readable message.
    const { createClient } = await import('redis');
    client = createClient({
      url,
      socket: {
        connectTimeout: 5000,
        // Give up rather than retry forever: in a serverless function an
        // endless reconnect loop burns the whole invocation and the caller
        // waits for a timeout instead of seeing the error.
        reconnectStrategy: (attempts) =>
          attempts > 2 ? new Error('Redis is unreachable') : Math.min((attempts + 1) * 150, 600),
      },
    });
    // Without a listener, a connection error is thrown as an unhandled event
    // and takes the whole function down instead of failing this one request.
    client.on('error', (error) => console.error('[dhara] redis', error?.message ?? error));
  }
  if (!client.isOpen) await client.connect();
  return client;
}

function revive(value: unknown): DharaPost | null {
  if (typeof value !== 'string') return null;
  try {
    const post = JSON.parse(value) as DharaPost;
    return post && typeof post.day === 'number' ? post : null;
  } catch {
    return null;
  }
}

export async function allPosts(): Promise<DharaPost[]> {
  const rows = await (await redis()).hGetAll(POSTS);
  return Object.values(rows ?? {})
    .map(revive)
    .filter((post): post is DharaPost => post !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function postsForDay(day: number): Promise<DharaPost[]> {
  return (await allPosts()).filter((post) => post.day === day);
}

export async function savePost(post: DharaPost): Promise<DharaPost> {
  await (await redis()).hSet(POSTS, post.id, JSON.stringify(post));
  return post;
}

export async function addBlessing(postId: string): Promise<void> {
  await (await redis()).hIncrBy(BLESSINGS, postId, 1);
}

/** Used by /api/health to prove the connection without writing anything. */
export async function pingStore(): Promise<string> {
  return (await redis()).ping();
}
