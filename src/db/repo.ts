import { addDaysKey, type DayKey } from '../lib/date';
import { defaultCheckIn, generateSession, previewDays } from '../engine/generate';
import { progressExercise, progressLadder } from '../engine/progression';
import { findMissedDays, isDeloadWeek, missedStreak } from '../engine/schedule';
import { nextCalorieBasis } from '../engine/nutrition';
import { trendAt } from '../engine/weight';
import type { CheckIn, LoggedExercise, PlannedSession, SessionRecord, SessionStatus } from '../engine/types';
import { db, ensureSeeded, type FitDB, type Settings } from './db';

export async function engineContext(database: FitDB = db) {
  const [settings, sessions, exStates, ladStates, missed, checkIns] = await Promise.all([
    database.settings.get('me'),
    database.sessions.toArray(),
    database.exerciseState.toArray(),
    database.ladderState.toArray(),
    database.missed.toArray(),
    database.checkIns.toArray(),
  ]);
  if (!settings) throw new Error('FitOS is not set up yet');
  return {
    settings,
    sessions,
    exerciseState: Object.fromEntries(exStates.map((e) => [e.key, e])),
    ladderState: Object.fromEntries(ladStates.map((l) => [l.id, l])),
    missed,
    checkIns: new Map(checkIns.map((c) => [c.date, c])),
  };
}
export type EngineContext = Awaited<ReturnType<typeof engineContext>>;

const sessionDates = (sessions: SessionRecord[]) => new Set(sessions.map((s) => s.date));

export function planFor(ctx: EngineContext, date: DayKey, checkIn?: CheckIn): PlannedSession {
  const ci = checkIn ?? ctx.checkIns.get(date) ?? defaultCheckIn(ctx.settings.schedule, date);
  return generateSession({
    date,
    checkIn: ci,
    schedule: ctx.settings.schedule,
    startDate: ctx.settings.programStart,
    history: ctx.sessions.filter((s) => s.date < date),
    exerciseState: ctx.exerciseState,
    ladderState: ctx.ladderState,
    missedStreak: missedStreak({
      today: date,
      schedule: ctx.settings.schedule,
      sessionDates: sessionDates(ctx.sessions),
      missed: ctx.missed,
      checkIns: ctx.checkIns,
    }),
  });
}

/** Planned sessions for future dates (rotation walked forward from today's next slot). */
export function previewFor(ctx: EngineContext, dates: DayKey[]) {
  return previewDays(
    dates,
    {
      schedule: ctx.settings.schedule,
      startDate: ctx.settings.programStart,
      history: ctx.sessions,
      exerciseState: ctx.exerciseState,
      ladderState: ctx.ladderState,
      missedStreak: 0,
    },
    ctx.checkIns,
  );
}

/** Record past scheduled training days with no session as missed (reason can be added later). */
export async function recordMissedDays(today: DayKey, database: FitDB = db): Promise<number> {
  const settings = await database.settings.get('me');
  if (!settings) return 0;
  const from = settings.missedCheckedThrough ? addDaysKey(settings.missedCheckedThrough, 1) : settings.programStart;
  if (from >= today) return 0;
  const [sessions, checkIns] = await Promise.all([database.sessions.toArray(), database.checkIns.toArray()]);
  const days = findMissedDays({
    from,
    today,
    schedule: settings.schedule,
    sessionDates: sessionDates(sessions),
    checkIns: new Map(checkIns.map((c) => [c.date, c])),
  });
  await database.transaction('rw', database.missed, database.settings, async () => {
    for (const d of days) if (!(await database.missed.get(d))) await database.missed.put({ date: d });
    await database.settings.update('me', { missedCheckedThrough: addDaysKey(today, -1) });
  });
  return days.length;
}

export function sessionStatus(plan: PlannedSession, logged: LoggedExercise[]): SessionStatus | null {
  const anyDone = logged.some((e) => e.sets.some((s) => s.done));
  if (!anyDone) return null;
  const all = plan.main.every((p) => {
    const l = logged.find((x) => x.key === p.key);
    return l && !l.skipped && l.sets.filter((s) => s.done).length >= p.sets;
  });
  return all ? 'completed' : 'partial';
}

/** Save a finished workout and update loads / ladder steps. */
export async function saveWorkout(
  plan: PlannedSession,
  logged: LoggedExercise[],
  startedAt: number,
  endedAt: number,
  database: FitDB = db,
): Promise<{ status: SessionStatus | null; changes: string[] }> {
  const status = sessionStatus(plan, logged);
  if (!status || plan.kind === 'rest') return { status: null, changes: [] };
  const changes: string[] = [];
  const settings = (await database.settings.get('me'))!;
  const deload = isDeloadWeek(settings.programStart, plan.date);
  await database.transaction('rw', [database.sessions, database.exerciseState, database.ladderState, database.missed], async () => {
    await database.sessions.add({
      date: plan.date,
      slot: plan.slot,
      templateKey: plan.templateKey,
      kind: plan.kind as 'strength' | 'cardio',
      status,
      plan,
      exercises: logged,
      startedAt,
      endedAt,
      durationMin: Math.max(1, Math.round((endedAt - startedAt) / 60000)),
      source: 'fitos',
    });
    await database.missed.delete(plan.date);
    for (const p of plan.main) {
      const l = logged.find((x) => x.key === p.key);
      if (!l || l.skipped) continue;
      if (p.ladder) {
        const prev = await database.ladderState.get(p.ladder);
        const r = progressLadder(prev, p.ladder, p, l.sets, plan.date);
        await database.ladderState.put(r.state);
        if (r.advanced) changes.push(`${p.name}: 3 × ${p.reps[1]} done — next time you move up a step.`);
      }
      const prevEx = await database.exerciseState.get(p.key);
      const r = progressExercise(prevEx, p, l.sets, plan.date, { deload });
      if (r.state.load !== prevEx?.load || r.state.failStreak !== prevEx?.failStreak) await database.exerciseState.put(r.state);
      if (r.change === 'increase') changes.push(`${p.name}: next time ${r.state.load} kg${p.perHand ? ' per hand' : ''}.`);
      if (r.change === 'decrease') changes.push(`${p.name}: missed the bottom of the range twice — next time ${r.state.load} kg.`);
      if (r.change === 'calibrated' && r.state.load != null) changes.push(`${p.name}: starting load set to ${r.state.load} kg.`);
    }
  });
  return { status, changes };
}

export async function saveCheckIn(ci: CheckIn, database: FitDB = db) {
  await database.checkIns.put(ci);
  if (ci.location === 'rest') await database.missed.delete(ci.date);
}

/** Keep the calorie target's basis weight in step with the trend (moves in 2 kg steps). */
export async function refreshCalorieBasis(today: DayKey, database: FitDB = db): Promise<Settings | undefined> {
  const s = await database.settings.get('me');
  if (!s) return s;
  const pts = (await database.weights.toArray()).map((w) => ({ date: w.date, value: w.kg }));
  const trend = trendAt(pts, today);
  const basis = nextCalorieBasis(s.calorieBasisKg, trend);
  if (basis !== s.calorieBasisKg) await database.settings.update('me', { calorieBasisKg: basis });
  return { ...s, calorieBasisKg: basis };
}

export async function boot(today: DayKey, database: FitDB = db) {
  const settings = await ensureSeeded(database, today);
  await recordMissedDays(today, database);
  await refreshCalorieBasis(today, database);
  return settings;
}
