/**
 * The whole database: two Redis hashes.
 *
 *   jyoti:posts      postId → the post
 *   jyoti:blessings  postId → how many hearts it has
 *
 * At ~25 people over 30 days this tops out around 750 small rows, so the
 * archive reads every post in one round trip and filters in memory. No schema,
 * no migrations, no query language.
 */

import { Redis } from '@upstash/redis';

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

let client: Redis | null = null;

/** Vercel's KV integration sets KV_REST_API_*; a direct Upstash store sets
 *  UPSTASH_REDIS_REST_*. Accept either so the setup step cannot be got wrong. */
function redis(): Redis {
  if (client) return client;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('Missing required environment variable: KV_REST_API_URL / KV_REST_API_TOKEN');
  }
  client = new Redis({ url, token });
  return client;
}

/** Upstash parses JSON on the way out, but a raw string can still come back. */
function revive(value: unknown): JyotiPost | null {
  if (!value) return null;
  const post = typeof value === 'string' ? (JSON.parse(value) as JyotiPost) : (value as JyotiPost);
  return post && typeof post.day === 'number' ? post : null;
}

export async function allPosts(): Promise<JyotiPost[]> {
  const rows = (await redis().hgetall(POSTS)) ?? {};
  return Object.values(rows)
    .map(revive)
    .filter((post): post is JyotiPost => post !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function postsForDay(day: number): Promise<JyotiPost[]> {
  return (await allPosts()).filter((post) => post.day === day);
}

export async function savePost(post: JyotiPost): Promise<JyotiPost> {
  await redis().hset(POSTS, { [post.id]: JSON.stringify(post) });
  return post;
}

export async function addBlessing(postId: string): Promise<void> {
  await redis().hincrby(BLESSINGS, postId, 1);
}
