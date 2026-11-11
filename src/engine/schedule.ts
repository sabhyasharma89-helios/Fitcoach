import { addDaysKey, diffDays, weekdayIndex, type DayKey } from '../lib/date';
import { STRENGTH_ROTATION } from './templates';
import type { CheckIn, DayType, MissedDay, SessionRecord, WeeklySchedule } from './types';

export const ROTATION_LENGTH = STRENGTH_ROTATION.length;

/** 1-based training week counted from the programme start date. */
export function weekNumber(startDate: DayKey, date: DayKey): number {
  return Math.max(1, Math.floor(diffDays(date, startDate) / 7) + 1);
}

/** Every 6th week is a deload. */
export function isDeloadWeek(startDate: DayKey, date: DayKey): boolean {
  return weekNumber(startDate, date) % 6 === 0;
}

/** No jumping/plyometrics for the first 8 weeks. */
export function highImpactAllowed(startDate: DayKey, date: DayKey): boolean {
  return weekNumber(startDate, date) > 8;
}

export function scheduledDayType(schedule: WeeklySchedule, date: DayKey): DayType {
  return schedule.dayTypes[weekdayIndex(date)];
}

/**
 * The strength sessions are a sequence, not a calendar lock: the next session is simply the
 * slot after the last strength session you actually did (completed or partial).
 * Missed days never advance or double up the rotation.
 */
export function nextStrengthSlot(history: Pick<SessionRecord, 'date' | 'slot' | 'kind' | 'endedAt'>[], before?: DayKey): number {
  const strength = history
    .filter((s) => s.kind === 'strength' && s.slot != null && (before == null || s.date < before))
    .sort((a, b) => (a.date === b.date ? a.endedAt - b.endedAt : a.date < b.date ? -1 : 1));
  const last = strength[strength.length - 1];
  return last ? ((last.slot as number) + 1) % ROTATION_LENGTH : 0;
}

/**
 * A scheduled training day (strength/cardio) in the past is "missed" when no session was
 * logged and you did not check in as a rest day. Today is never missed (the day isn't over).
 */
export function findMissedDays(args: {
  from: DayKey;
  today: DayKey;
  schedule: WeeklySchedule;
  sessionDates: Set<DayKey>;
  checkIns: Map<DayKey, CheckIn>;
}): DayKey[] {
  const out: DayKey[] = [];
  for (let d = args.from; d < args.today; d = addDaysKey(d, 1)) {
    if (scheduledDayType(args.schedule, d) === 'rest') continue;
    if (args.sessionDates.has(d)) continue;
    if (args.checkIns.get(d)?.location === 'rest') continue;
    out.push(d);
  }
  return out;
}

/**
 * Number of consecutive missed training days immediately before `today`.
 * Scheduled rest days and deliberate rest check-ins are skipped over (they neither count nor break
 * the streak); a day with a logged session ends it.
 */
export function missedStreak(args: {
  today: DayKey;
  schedule: WeeklySchedule;
  sessionDates: Set<DayKey>;
  missed: MissedDay[];
  checkIns: Map<DayKey, CheckIn>;
  lookbackDays?: number;
}): number {
  const missedSet = new Set(args.missed.map((m) => m.date));
  let streak = 0;
  const limit = args.lookbackDays ?? 60;
  for (let i = 1; i <= limit; i++) {
    const d = addDaysKey(args.today, -i);
    if (args.sessionDates.has(d)) break;
    if (missedSet.has(d)) {
      streak++;
      continue;
    }
    if (scheduledDayType(args.schedule, d) === 'rest' || args.checkIns.get(d)?.location === 'rest') continue;
    // a training day that is neither logged nor recorded as missed (e.g. before the app was installed)
    break;
  }
  return streak;
}
