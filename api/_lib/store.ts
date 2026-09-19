/**
 * The whole database: two Redis hashes.
 *
 *   jyoti:posts      postId → the post
 *   jyoti:blessings  postId → how many hearts it has
 *
 * At ~25 people over 30 days this tops out around 750 small rows, so the
 * archive reads every post in one round trip and filters in memory. No schema,
 * no migrations, no query language.
 *
 * Speaks plain Redis over TCP, so any provider works — Redis Cloud, Upstash,
 * or a local server — from one REDIS_URL.
 */

import { createClient, type RedisClientType } from 'redis';

const POSTS = 'jyoti:posts';
const BLESSINGS = 'jyoti:blessings';

export interface JyotiPost {
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
async function redis(): Promise<RedisClientType> {
  const url = process.env.REDIS_URL || process.env.KV_URL;
  if (!url) throw new Error('Missing required environment variable: REDIS_URL');

  if (!client) {
    client = createClient({ url, socket: { connectTimeout: 8000, reconnectStrategy: (n) => Math.min(n * 100, 2000) } });
    // Without a listener, a connection error is thrown as an unhandled event
    // and takes the whole function down instead of failing this one request.
    client.on('error', (error) => console.error('[jyoti] redis', error?.message ?? error));
  }
  if (!client.isOpen) await client.connect();
  return client;
}

function revive(value: unknown): JyotiPost | null {
  if (typeof value !== 'string') return null;
  try {
    const post = JSON.parse(value) as JyotiPost;
    return post && typeof post.day === 'number' ? post : null;
  } catch {
    return null;
  }
}

export async function allPosts(): Promise<JyotiPost[]> {
  const rows = await (await redis()).hGetAll(POSTS);
  return Object.values(rows ?? {})
    .map(revive)
    .filter((post): post is JyotiPost => post !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function postsForDay(day: number): Promise<JyotiPost[]> {
  return (await allPosts()).filter((post) => post.day === day);
}

export async function savePost(post: JyotiPost): Promise<JyotiPost> {
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
