import { CATALOG_BY_KEY } from '../data/catalog';
import { EXERCISE_DB } from '../data/exerciseDb';
import { addDaysKey, weekdayIndex, type DayKey } from '../lib/date';
import { scheduledDayType } from './schedule';
import type { CheckIn, SessionRecord, WeeklySchedule } from './types';

export type DayStatus = 'completed' | 'partial' | 'missed' | 'rest' | 'planned' | 'today';

export function dayStatus(args: {
  date: DayKey;
  today: DayKey;
  schedule: WeeklySchedule;
  sessions: Map<DayKey, SessionRecord[]>;
  checkIns: Map<DayKey, CheckIn>;
  /** days with an exercise session recorded in Health Connect (e.g. a Samsung Health walk) */
  externalDates?: Set<DayKey>;
}): DayStatus {
  const s = args.sessions.get(args.date) ?? [];
  if (s.some((x) => x.status === 'completed')) return 'completed';
  if (s.length) return 'partial';
  const restDay = scheduledDayType(args.schedule, args.date) === 'rest' || args.checkIns.get(args.date)?.location === 'rest';
  if (!restDay && args.date <= args.today && args.externalDates?.has(args.date)) return 'completed';
  if (args.date > args.today) return restDay ? 'rest' : 'planned';
  if (args.date === args.today) return restDay ? 'rest' : 'today';
  return restDay ? 'rest' : 'missed';
}

/** Consecutive scheduled training days done (rest days are skipped, today counts once done). */
export function currentStreak(args: {
  today: DayKey;
  schedule: WeeklySchedule;
  sessions: Map<DayKey, SessionRecord[]>;
  checkIns: Map<DayKey, CheckIn>;
  externalDates?: Set<DayKey>;
}): number {
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const d = addDaysKey(args.today, -i);
    const st = dayStatus({ ...args, date: d });
    if (st === 'completed' || st === 'partial') streak++;
    else if (st === 'rest' || st === 'today') continue;
    else break;
  }
  return streak;
}

/**
 * Adherence over the last 28 days: training days done ÷ scheduled training days.
 * Partial sessions count half. Today only counts once something is logged.
 */
export function adherence28(args: {
  today: DayKey;
  schedule: WeeklySchedule;
  sessions: Map<DayKey, SessionRecord[]>;
  checkIns: Map<DayKey, CheckIn>;
}): { pct: number | null; done: number; scheduled: number } {
  let done = 0;
  let scheduled = 0;
  for (let i = 0; i < 28; i++) {
    const d = addDaysKey(args.today, -i);
    const s = args.sessions.get(d) ?? [];
    const isTraining = scheduledDayType(args.schedule, d) !== 'rest';
    if (i === 0 && !s.length) continue;
    if (isTraining) scheduled++;
    if (s.some((x) => x.status === 'completed')) done += 1;
    else if (s.length) done += 0.5;
  }
  done = Math.min(done, scheduled);
  return { pct: scheduled ? Math.round((done / scheduled) * 100) : null, done, scheduled };
}

export const MUSCLE_GROUPS: Record<string, string> = {
  chest: 'Chest',
  lats: 'Back',
  'middle back': 'Back',
  'lower back': 'Back',
  traps: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Arms',
  triceps: 'Arms',
  forearms: 'Arms',
  quadriceps: 'Legs',
  hamstrings: 'Legs',
  glutes: 'Legs',
  calves: 'Legs',
  adductors: 'Legs',
  abductors: 'Legs',
  abdominals: 'Core',
  neck: 'Shoulders',
};

/** Working sets done per muscle group (primary muscles) in the Mon–Sun week containing `today`. */
export function weeklyVolume(sessions: SessionRecord[], today: DayKey): Record<string, number> {
  const start = addDaysKey(today, -weekdayIndex(today));
  const end = addDaysKey(start, 6);
  const out: Record<string, number> = { Chest: 0, Back: 0, Shoulders: 0, Arms: 0, Legs: 0, Core: 0 };
  for (const s of sessions) {
    if (s.date < start || s.date > end || s.kind !== 'strength') continue;
    for (const ex of s.exercises) {
      const c = CATALOG_BY_KEY[ex.key];
      if (!c) continue;
      const doneSets = ex.sets.filter((x) => x.done).length;
      const groups = new Set((EXERCISE_DB[c.dbId]?.primaryMuscles ?? []).map((m) => MUSCLE_GROUPS[m]).filter(Boolean));
      for (const g of groups) out[g] += doneSets;
    }
  }
  return out;
}
