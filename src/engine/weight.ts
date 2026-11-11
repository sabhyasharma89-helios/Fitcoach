import { addDaysKey, diffDays, type DayKey } from '../lib/date';

export interface DayValue {
  date: DayKey;
  value: number;
}

/** Trailing 7-day mean (that day and the 6 before it, using the days that have a reading). */
export function movingAverage7(points: DayValue[]): DayValue[] {
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : 1));
  return sorted.map((p) => {
    const from = addDaysKey(p.date, -6);
    const win = sorted.filter((q) => q.date >= from && q.date <= p.date);
    return { date: p.date, value: win.reduce((s, q) => s + q.value, 0) / win.length };
  });
}

/** Moving-average value on or before a date (null if there is no reading in the 7 days up to it). */
export function trendAt(points: DayValue[], date: DayKey): number | null {
  const from = addDaysKey(date, -6);
  const win = points.filter((q) => q.date >= from && q.date <= date);
  if (!win.length) return null;
  return win.reduce((s, q) => s + q.value, 0) / win.length;
}

/** kg per week, from the change in the 7-day average over the last 7 days. Negative = losing. */
export function weeklyRate(points: DayValue[], today: DayKey): number | null {
  const now = trendAt(points, today);
  const prev = trendAt(points, addDaysKey(today, -7));
  if (now == null || prev == null) return null;
  return now - prev;
}

export function projectGoalDate(points: DayValue[], today: DayKey, goalKg: number): DayKey | null {
  const rate = weeklyRate(points, today);
  const now = trendAt(points, today);
  if (rate == null || now == null) return null;
  if (now <= goalKg) return today;
  if (rate >= 0) return null; // not losing — no projection
  const weeks = (now - goalKg) / -rate;
  if (weeks > 520) return null;
  return addDaysKey(today, Math.ceil(weeks * 7));
}

/** Warn when weight is falling faster than 1 % of body weight per week for 2 weeks running. */
export function rapidLossWarning(points: DayValue[], today: DayKey): { warn: boolean; pcts: (number | null)[] } {
  const pct = (end: DayKey) => {
    const a = trendAt(points, addDaysKey(end, -7));
    const b = trendAt(points, end);
    if (a == null || b == null) return null;
    return ((a - b) / a) * 100;
  };
  const w1 = pct(today);
  const w2 = pct(addDaysKey(today, -7));
  return { warn: w1 != null && w2 != null && w1 > 1 && w2 > 1, pcts: [w1, w2] };
}

export const WAIST_RISK_CM_INDIAN_MALE = 90;

export function daysBetween(a: DayKey, b: DayKey) {
  return diffDays(b, a);
}
