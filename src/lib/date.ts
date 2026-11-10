import { TZDate } from '@date-fns/tz';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';

/** All day boundaries in FitOS are Indian Standard Time. */
export const TZ = 'Asia/Kolkata';

/** A calendar day as 'YYYY-MM-DD' in IST. */
export type DayKey = string;

export function nowIST(): TZDate {
  return new TZDate(Date.now(), TZ);
}

export function dayKey(d: Date | number = Date.now()): DayKey {
  return format(new TZDate(typeof d === 'number' ? d : d.getTime(), TZ), 'yyyy-MM-dd');
}

export function todayKey(): DayKey {
  return dayKey(Date.now());
}

/** Noon IST on that day — a safe anchor for arithmetic that avoids DST/offset edge cases. */
export function dayToDate(key: DayKey): TZDate {
  const [y, m, d] = key.split('-').map(Number);
  return new TZDate(y, m - 1, d, 12, 0, 0, TZ);
}

export function addDaysKey(key: DayKey, n: number): DayKey {
  return dayKey(addDays(dayToDate(key), n));
}

export function diffDays(a: DayKey, b: DayKey): number {
  return differenceInCalendarDays(parseISO(a), parseISO(b));
}

/** 0 = Monday … 6 = Sunday */
export function weekdayIndex(key: DayKey): number {
  const js = parseISO(key).getDay(); // 0 = Sunday
  return (js + 6) % 7;
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export function rangeKeys(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  for (let k = from; k <= to; k = addDaysKey(k, 1)) out.push(k);
  return out;
}

/** IST start of day as an ISO instant, e.g. for Health Connect queries. */
export function startOfDayISO(key: DayKey): string {
  const [y, m, d] = key.split('-').map(Number);
  return new TZDate(y, m - 1, d, 0, 0, 0, TZ).toISOString();
}

export function formatDay(key: DayKey, pattern = 'EEE d MMM'): string {
  return format(parseISO(key), pattern);
}
