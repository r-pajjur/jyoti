export interface Profile {
  name: string;
  joinedAt: string;
}

const KEY_PROFILE = 'jyoti.profile';
const KEY_POSTED = 'jyoti.posted';
const KEY_BLESSED = 'jyoti.blessed';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback; 
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode — the app still works, it just forgets */
  }
}

export function getProfile(): Profile | null {
  const profile = read<Profile | null>(KEY_PROFILE, null);
  return profile?.name ? profile : null;
}

export function saveProfile(name: string): Profile {
  const existing = getProfile();
  const profile: Profile = { name: name.trim(), joinedAt: existing?.joinedAt ?? new Date().toISOString() };
  write(KEY_PROFILE, profile);
  return profile;
}

/** Local echo of "I posted today" so Today renders instantly; the server is still
 *  the authority that unlocks the feed. */
export function markPosted(day: number): void {
  const days = read<number[]>(KEY_POSTED, []);
  if (!days.includes(day)) write(KEY_POSTED, [...days, day]);
}

export function hasPostedLocally(day: number): boolean {
  return read<number[]>(KEY_POSTED, []).includes(day);
}

export function isBlessed(postId: string): boolean {
  return read<string[]>(KEY_BLESSED, []).includes(postId);
}

export function markBlessed(postId: string): void {
  const ids = read<string[]>(KEY_BLESSED, []);
  if (!ids.includes(postId)) write(KEY_BLESSED, [...ids, postId]);
}

