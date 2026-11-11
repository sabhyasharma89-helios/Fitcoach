import { getExercise, type CatalogExercise } from '../data/catalog';
import type { DayKey } from '../lib/date';
import { LADDER_BY_ID } from './templates';
import type { ExerciseState, LadderState, LoggedSet, PlannedExercise } from './types';

/** Starting loads from the reference lifts (kg; dumbbells per hand). */
export const SEED_LOADS: Record<string, number> = {
  'db-bench-press': 17.5,
  'lat-pulldown': 39,
  'leg-extension': 35,
};

export const MAX_PROGRESS_RPE = 8;

/** Loads are rounded to the nearest 0.5 kg. */
export const roundLoad = (kg: number) => Math.round(kg * 2) / 2;

export function isLoadBearing(ex: CatalogExercise): boolean {
  return ex.equipment !== 'bodyweight' && ex.equipment !== 'cardio-machine';
}

/** +1 kg per dumbbell; +5 kg lower body or machines; +2.5 kg other upper-body lifts. */
export function loadIncrement(ex: CatalogExercise): number {
  if (ex.equipment === 'dumbbell') return 1;
  if (ex.equipment === 'machine' || ex.region === 'lower') return 5;
  return 2.5;
}

export interface ProgressionResult {
  state: ExerciseState;
  change: 'increase' | 'decrease' | 'hold' | 'calibrated';
}

/**
 * Double progression.
 * - Every planned set at the top of the rep range at RPE ≤ 8 → add load next time.
 * - Falling below the bottom of the range in two consecutive sessions → reduce load 10 %.
 * - Calibration sessions store the load you used. Deload sessions never change the load.
 */
export function progressExercise(
  prev: ExerciseState | undefined,
  planned: PlannedExercise,
  sets: LoggedSet[],
  date: DayKey,
  opts: { deload?: boolean } = {},
): ProgressionResult {
  const ex = getExercise(planned.key);
  const done = sets.filter((s) => s.done && s.reps != null);
  const usedLoad = done.reduce<number | null>((m, s) => (s.load != null && (m == null || s.load > m) ? s.load : m), null);
  const base: ExerciseState = prev ?? { key: planned.key, load: null, failStreak: 0, updatedAt: date };

  if (!isLoadBearing(ex) || done.length === 0) return { state: { ...base, updatedAt: date }, change: 'hold' };

  if (planned.calibration || base.load == null) {
    return { state: { key: planned.key, load: usedLoad, failStreak: 0, updatedAt: date }, change: 'calibrated' };
  }
  if (opts.deload) return { state: { ...base, updatedAt: date }, change: 'hold' };

  const working = usedLoad ?? base.load;
  const [min, max] = planned.reps;
  const allSetsDone = done.length >= planned.sets;
  const hitTop = allSetsDone && done.every((s) => (s.reps ?? 0) >= max && s.rpe != null && s.rpe <= MAX_PROGRESS_RPE);
  const failedBottom = done.some((s) => (s.reps ?? 0) < min);

  if (hitTop) {
    return {
      state: { key: planned.key, load: roundLoad(working + loadIncrement(ex)), failStreak: 0, updatedAt: date },
      change: 'increase',
    };
  }
  if (failedBottom) {
    const streak = base.failStreak + 1;
    if (streak >= 2) {
      return { state: { key: planned.key, load: roundLoad(working * 0.9), failStreak: 0, updatedAt: date }, change: 'decrease' };
    }
    return { state: { key: planned.key, load: working, failStreak: streak, updatedAt: date }, change: 'hold' };
  }
  return { state: { key: planned.key, load: working, failStreak: 0, updatedAt: date }, change: 'hold' };
}

/** Home ladders: move to the next step once every set reaches the top of the range (3 × 12). */
export function progressLadder(
  prev: LadderState | undefined,
  ladderId: string,
  planned: PlannedExercise,
  sets: LoggedSet[],
  date: DayKey,
): { state: LadderState; advanced: boolean } {
  const ladder = LADDER_BY_ID[ladderId];
  const level = prev?.level ?? 0;
  const done = sets.filter((s) => s.done && s.reps != null);
  const hitTop = done.length >= Math.max(3, planned.sets) && done.every((s) => (s.reps ?? 0) >= planned.reps[1]);
  // A ladder step only advances from a full 3-set session (not deload/short 2-set days).
  if (hitTop && level < ladder.steps.length - 1) return { state: { id: ladderId, level: level + 1, updatedAt: date }, advanced: true };
  return { state: { id: ladderId, level, updatedAt: date }, advanced: false };
}
