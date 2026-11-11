import { addDaysKey, weekdayIndex, type DayKey } from '../lib/date';

export const STEP_TARGET_CAP = 10000;
export const STEP_TARGET_BUMP = 1000;
export const STEP_TARGET_DEFAULT = 5000;

/**
 * Daily step target: last week's daily average + 1,000, capped at 10,000.
 * It is recalculated once a week (each Monday, IST) from the 7 days Mon–Sun before it.
 */
export function stepTarget(stepsByDay: Map<DayKey, number>, today: DayKey): { target: number; basisAvg: number | null; weekStart: DayKey } {
  const weekStart = addDaysKey(today, -weekdayIndex(today));
  const vals: number[] = [];
  for (let i = 1; i <= 7; i++) {
    const v = stepsByDay.get(addDaysKey(weekStart, -i));
    if (v != null && v > 0) vals.push(v);
  }
  if (!vals.length) return { target: STEP_TARGET_DEFAULT, basisAvg: null, weekStart };
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return { target: Math.min(STEP_TARGET_CAP, Math.round(avg + STEP_TARGET_BUMP)), basisAvg: avg, weekStart };
}
