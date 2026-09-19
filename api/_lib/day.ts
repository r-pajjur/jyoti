/** Day-number arithmetic in the group's own timezone, not the server's. */

export const TOTAL_DAYS = Number(process.env.JYOTI_TOTAL_DAYS || 30);
/** How many people are in the group — the denominator in "3/20 drops today". */
export const GROUP_SIZE = Number(process.env.JYOTI_GROUP_SIZE || 20);
const TIMEZONE = process.env.JYOTI_TIMEZONE || 'Asia/Kolkata';
const START_DATE = process.env.JYOTI_START_DATE || '2026-09-22';

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

/** The civil date on which a given day number falls. */
export function dateKeyForDay(day: number): string {
  const ms = toUtcMidnight(START_DATE) + (day - 1) * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

export function isWithinRitual(day: number): boolean {
  return day >= 1 && day <= TOTAL_DAYS;
}

export function ritualConfig() {
  return { timezone: TIMEZONE, startDate: START_DATE, totalDays: TOTAL_DAYS };
}
