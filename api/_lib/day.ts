/** Day-number arithmetic in the group's own timezone, not the server's. */

/**
 * Settings are read under DHARA_* and, failing that, JYOTI_* — the name the
 * app shipped under. Keeping both means a rename never silently unconfigures
 * a deployment whose variables were set before it.
 */
function setting(name: string): string {
  return (process.env[`DHARA_${name}`] ?? process.env[`JYOTI_${name}`] ?? '').trim();
}


export const TOTAL_DAYS = Number(setting('TOTAL_DAYS') || 30);
/** How many people are in the group — the denominator in "3/20 drops today". */
export const GROUP_SIZE = Number(setting('GROUP_SIZE') || 20);
const TIMEZONE = setting('TIMEZONE') || 'Asia/Kolkata';

/** A variable set to an empty string is the same as unset, which is how an
 *  env var typed into a dashboard with no value arrives. */
const CONFIGURED_START = setting('START_DATE');
const START_DATE = /^\d{4}-\d{2}-\d{2}$/.test(CONFIGURED_START) ? CONFIGURED_START : '';

/** True only when a usable start date was supplied. */
export function isConfigured(): boolean {
  return START_DATE !== '';
}

/** Civil date in the ritual timezone, as YYYY-MM-DD. */
export function todayKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return parts;
}

/** Hour of the day (0-23) in the ritual timezone. */
export function localHour(now: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    hour12: false,
  }).format(now);
  return Number(hour) % 24;
}

function toUtcMidnight(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** 1 on the start date. Can be <1 (not begun) or >TOTAL_DAYS (wound down). */
export function dayNumberFor(dateKey: string): number {
  const diff = toUtcMidnight(dateKey) - toUtcMidnight(START_DATE);
  return Math.floor(diff / 86_400_000) + 1;
}

export function currentDay(now: Date = new Date()): number {
  return dayNumberFor(todayKey(now));
}

/** Local hour (0-23) the morning push goes out. Read per call, so changing it
 *  in Vercel takes effect on the next tick rather than the next cold start. */
export function sendHour(): number {
  const raw = Number(setting('SEND_HOUR') || 8);
  return Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 0), 23) : 8;
}

/** The civil date on which a given day number falls. */
export function dateKeyForDay(day: number): string {
  const ms = toUtcMidnight(START_DATE) + (day - 1) * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

export function startDateKey(): string {
  return START_DATE;
}

/** Unconfigured means there is no Day 1 to count from, so there is no day. */


export function isWithinRitual(day: number): boolean {
  return day >= 1 && day <= TOTAL_DAYS;
}

export function ritualConfig() {
  return { timezone: TIMEZONE, startDate: START_DATE || null, totalDays: TOTAL_DAYS, configured: isConfigured() };
}
