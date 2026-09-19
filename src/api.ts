import { getProfile } from './state.js';

export interface Prompt {
  day: number;
  type: 'photo' | 'reflection';
  title: string;
  text: string;
}

export interface Post {
  id: string;
  day: number | null;
  author: string | null;
  body: string;
  photoUrl: string | null;
  createdAt: string;
  mine?: boolean;
}

export interface TodayResponse {
  day: number;
  dateKey: string;
  active: boolean;
  phase: 'before' | 'during' | 'after';
  prompt: Prompt | null;
  timezone: string;
  startDate: string;
  totalDays: number;
}

export interface FeedResponse {
  day: number;
  locked: boolean;
  count: number;
  groupSize: number;
  prompt: Prompt | null;
  posts: Post[];
}

export interface ArchiveDay {
  day: number;
  dateKey: string;
  prompt: Prompt | null;
  count: number;
  locked: boolean;
  posts: Post[];
}

export interface ArchiveResponse {
  today: number;
  totalDays: number;
  days: ArchiveDay[];
}

export class ApiError extends Error {
  /** Where it failed and with what status — shown on screen so a screenshot is
   *  enough to diagnose a deployment nobody can reach from a laptop. */
  readonly detail?: string;
  constructor(message: string, detail?: string) {
    super(message);
    this.detail = detail;
  }
}

/**
 * Pull a human message out of whatever came back. Our own handlers send
 * { error: "text" }, but a function that fails to boot never reaches them and
 * Vercel answers with its own { error: { code, message } } instead — which is
 * why this must not assume a string.
 */
function errorMessage(payload: unknown, status: number): string {
  const error = (payload as { error?: unknown } | null)?.error;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object') {
    const nested = error as { message?: unknown; code?: unknown };
    if (typeof nested.message === 'string' && nested.message.trim()) return nested.message;
    if (typeof nested.code === 'string' && nested.code.trim()) return `${nested.code} (${status})`;
  }
  const message = (payload as { message?: unknown } | null)?.message;
  if (typeof message === 'string' && message.trim()) return message;
  return `Something went wrong (${status}).`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
    });
  } catch {
    throw new ApiError('No connection. This will work again once you are back online.', `${path} — unreachable`);
  }

  // A crashed or missing function can answer with an HTML error page, so the
  // body is read as text first and only then tried as JSON.
  const raw = await response.text().catch(() => '');
  let payload: unknown = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new ApiError(errorMessage(payload, response.status), `${path} — HTTP ${response.status}`);
  }
  return payload as T;
}

function requireName(): string {
  const name = getProfile()?.name;
  if (!name) throw new ApiError('We lost your name. Please reopen Jyoti and enter it again.');
  return name;
}

export function fetchToday(): Promise<TodayResponse> {
  return request<TodayResponse>('/api/today');
}

export function fetchFeed(day?: number): Promise<FeedResponse> {
  const params = new URLSearchParams({ name: requireName() });
  if (day !== undefined) params.set('day', String(day));
  return request<FeedResponse>(`/api/feed?${params}`);
}

export function fetchArchive(): Promise<ArchiveResponse> {
  return request<ArchiveResponse>(`/api/archive?${new URLSearchParams({ name: requireName() })}`);
}

export function submitPost(input: { day: number; text: string; photo?: string; photoType?: string }): Promise<{ post: Post }> {
  return request<{ post: Post }>('/api/post', {
    method: 'POST',
    body: JSON.stringify({ ...input, name: requireName() }),
  });
}

export function bless(postId: string): Promise<{ ok: true }> {
  return request<{ ok: true }>('/api/react', { method: 'POST', body: JSON.stringify({ postId }) });
}

