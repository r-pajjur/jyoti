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

export class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
    });
  } catch {
    throw new ApiError('No connection. This will work again once you are back online.');
  }
  const payload = await response.json().catch(() => ({}) as Record<string, unknown>);
  if (!response.ok) {
    throw new ApiError((payload as { error?: string }).error || `Something went wrong (${response.status}).`);
  }
  return payload as T;
}

function requireName(): string {
  const name = getProfile()?.name;
  if (!name) throw new ApiError('We lost your name — please add it again in Settings.');
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

export function sendSubscription(subscription: PushSubscription): Promise<{ ok: true; id: string }> {
  return request<{ ok: true; id: string }>('/api/subscribe', {
    method: 'POST',
    body: JSON.stringify({ name: requireName(), subscription: subscription.toJSON() }),
  });
}

export function dropSubscription(endpoint: string): Promise<{ ok: true }> {
  return request<{ ok: true }>('/api/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) });
}
