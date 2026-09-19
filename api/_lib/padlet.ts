/**
 * Minimal Padlet JSON:API client.
 *
 * Docs: https://docs.padlet.dev/reference/introduction
 * NOTE: Padlet has NO file-upload endpoint. `content.attachment.url` accepts a
 * URL only, so photos must already be hosted (we use Vercel Blob) before the
 * post is created. See api/_lib/photos.ts.
 */

const BASE = (process.env.PADLET_API_BASE || 'https://api.padlet.dev/v1').replace(/\/+$/, '');
const JSON_API = 'application/vnd.api+json';

export class PadletError extends Error {
  constructor(readonly status: number, readonly body: string, message: string) {
    super(message);
    this.name = 'PadletError';
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'X-API-KEY': requireEnv('PADLET_API_KEY'),
      Accept: JSON_API,
      ...(init.body ? { 'Content-Type': JSON_API } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new PadletError(res.status, text, `Padlet ${init.method || 'GET'} ${path} → ${res.status}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/** A Padlet post, flattened into the shape the PWA consumes. */
export interface JyotiPost {
  id: string;
  /** Day number parsed out of the subject line, or null for anything off-convention. */
  day: number | null;
  /** Display name parsed out of the subject line. */
  author: string | null;
  /** True for the prompt post the cron job writes each morning. */
  isPrompt: boolean;
  subject: string;
  body: string;
  photoUrl: string | null;
  createdAt: string;
  webUrl: string | null;
}

const PROMPT_MARK = '💧';

/** Subject conventions — the only way to attribute posts, since the API key owner
 *  is the author of every API-created post. */
export function userSubject(name: string, day: number): string {
  return `${name} · Day ${day}`;
}

export function promptSubject(day: number): string {
  return `${PROMPT_MARK} Day ${day} · Prompt`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseSubject(subject: string): { day: number | null; author: string | null; isPrompt: boolean } {
  const isPrompt = subject.trimStart().startsWith(PROMPT_MARK);
  if (isPrompt) {
    const m = /Day\s+(\d+)/i.exec(subject);
    return { day: m?.[1] ? Number(m[1]) : null, author: null, isPrompt: true };
  }
  // Parse from the right so names containing " · " survive.
  const m = /^(.*)\s+·\s+Day\s+(\d+)\s*$/i.exec(subject.trim());
  if (!m || !m[1] || !m[2]) return { day: null, author: null, isPrompt: false };
  return { day: Number(m[2]), author: m[1].trim(), isPrompt: false };
}

/** Padlet's response nests differently across attachment types; probe the likely spots. */
function extractPhotoUrl(attachment: Record<string, any> | null | undefined): string | null {
  if (!attachment) return null;
  const candidates = [attachment.previewImageUrl, attachment.url];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && /^https?:\/\//.test(candidate)) return candidate;
  }
  return null;
}

function normalizePost(raw: any): JyotiPost {
  const attrs = raw?.attributes ?? {};
  const content = attrs.content ?? {};
  const subject: string = content.subject ?? '';
  const { day, author, isPrompt } = parseSubject(subject);
  return {
    id: String(raw?.id ?? ''),
    day,
    author,
    isPrompt,
    subject,
    body: stripHtml(String(content.body ?? content.bodyHtml ?? '')),
    photoUrl: extractPhotoUrl(content.attachment),
    createdAt: String(attrs.createdAt ?? attrs.created_at ?? new Date(0).toISOString()),
    webUrl: attrs.webUrl ?? null,
  };
}

/** GET /boards/{id}?include=posts — every post on the board in one call. */
export async function fetchBoardPosts(): Promise<JyotiPost[]> {
  const boardId = requireEnv('PADLET_BOARD_ID');
  const payload = await request<{ included?: any[] }>(`/boards/${boardId}?include=posts`);
  return (payload.included ?? [])
    .filter((entry) => entry?.type === 'post')
    .map(normalizePost)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export interface CreatePostInput {
  subject: string;
  body?: string;
  /** Publicly reachable https URL — Padlet fetches it, so it cannot be a data: URI. */
  photoUrl?: string | null;
  color?: 'red' | 'orange' | 'green' | 'blue' | 'purple';
}

/** POST /boards/{id}/posts */
export async function createPost(input: CreatePostInput): Promise<JyotiPost> {
  const boardId = requireEnv('PADLET_BOARD_ID');
  const attributes: Record<string, unknown> = {
    content: {
      subject: input.subject.slice(0, 500),
      body: (input.body ?? '').slice(0, 10000),
      ...(input.photoUrl
        ? { attachment: { url: input.photoUrl, previewImageUrl: input.photoUrl } }
        : {}),
    },
  };
  if (input.color) attributes.color = input.color;
  const payload = await request<{ data: any }>(`/boards/${boardId}/posts`, {
    method: 'POST',
    body: JSON.stringify({ data: { type: 'post', attributes } }),
  });
  return normalizePost(payload.data);
}

/** POST /posts/{id}/reactions — the board must have Reactions enabled. */
export async function createReaction(postId: string): Promise<void> {
  await request(`/posts/${postId}/reactions`, {
    method: 'POST',
    body: JSON.stringify({ data: { type: 'reaction', attributes: { reactionType: 'like', value: 1 } } }),
  });
}
