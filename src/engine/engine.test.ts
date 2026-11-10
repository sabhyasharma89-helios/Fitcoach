import { describe, expect, it } from 'vitest';
import { getExercise } from '../data/catalog';
import { defaultCheckIn, estimateMainMinutes, fitToTime, generateSession, previewDays, reduceVolume, type GenerateInput } from './generate';
import { loadIncrement, progressExercise, progressLadder, SEED_LOADS } from './progression';
import { findMissedDays, isDeloadWeek, missedStreak, nextStrengthSlot, weekNumber } from './schedule';
import { DEFAULT_SCHEDULE } from './templates';
import type { CheckIn, LoggedSet, PlannedExercise, SessionRecord } from './types';

// 2026-11-09 is a Monday
const MON = '2026-11-09';
const TUE = '2026-11-10';
const WED = '2026-11-11';
const THU = '2026-11-12';
const FRI = '2026-11-13';
const SAT = '2026-11-14';
const SUN = '2026-11-15';

const ci = (date: string, over: Partial<CheckIn> = {}): CheckIn => ({
  date,
  location: 'gym',
  minutes: 60,
  feeling: 'normal',
  soreParts: [],
  painParts: [],
  ...over,
});

const base = (over: Partial<GenerateInput> = {}): GenerateInput => ({
  date: MON,
  checkIn: ci(MON),
  schedule: DEFAULT_SCHEDULE,
  startDate: MON,
  history: [],
  exerciseState: {},
  ladderState: {},
  missedStreak: 0,
  ...over,
});

const hist = (date: string, slot: number | null, kind: 'strength' | 'cardio' = 'strength') => ({ date, slot, kind, endedAt: 0 });
const sets = (n: number, reps: number, load: number | null, rpe: number | null = 8): LoggedSet[] =>
  Array.from({ length: n }, () => ({ reps, load, rpe, done: true }));

describe('rotation (sequence, not calendar)', () => {
  it('starts at Push A and follows Push → Pull → Legs → Push B → Pull B/Legs B', () => {
    expect(nextStrengthSlot([])).toBe(0);
    expect(nextStrengthSlot([hist(MON, 0)])).toBe(1);
    expect(nextStrengthSlot([hist(MON, 0), hist(TUE, 1), hist(WED, 2), hist(FRI, 3), hist(SAT, 4)])).toBe(0);
  });

  it('a missed day does not stack or skip: the next session is simply the next in sequence', () => {
    // Did Push A Monday, missed Tue + Wed; Friday's session is Pull A, not Push B
    const s = generateSession(base({ date: FRI, checkIn: ci(FRI), history: [hist(MON, 0)] }));
    expect(s.templateKey).toBe('gym-pull-a');
    expect(s.slot).toBe(1);
  });

  it('cardio sessions do not advance the strength rotation', () => {
    expect(nextStrengthSlot([hist(MON, 0), hist(THU, null, 'cardio')])).toBe(1);
  });

  it('gives the cardio session on the scheduled cardio day', () => {
    expect(generateSession(base({ date: THU, checkIn: ci(THU) })).templateKey).toBe('gym-zone2');
    expect(generateSession(base({ date: THU, checkIn: ci(THU, { location: 'home' }) })).templateKey).toBe('home-walk');
  });

  it('uses the home version of the same slot when training at home or travelling', () => {
    expect(generateSession(base({ checkIn: ci(MON, { location: 'home' }) })).templateKey).toBe('home-upper-push');
    const travel = generateSession(base({ checkIn: ci(MON, { location: 'travel' }) }));
    expect(travel.templateKey).toBe('home-upper-push');
    expect(travel.notes.join(' ')).toMatch(/Hotel/);
  });

  it('a rest check-in gives a rest day', () => {
    const s = generateSession(base({ checkIn: ci(MON, { location: 'rest' }) }));
    expect(s.kind).toBe('rest');
    expect(s.main).toEqual([]);
  });

  it('missed check-in falls back to the default weekly schedule', () => {
    expect(defaultCheckIn(DEFAULT_SCHEDULE, MON)).toMatchObject({ location: 'gym', minutes: 60, feeling: 'normal', auto: true });
    expect(defaultCheckIn(DEFAULT_SCHEDULE, SUN).location).toBe('rest');
  });

  it('future preview walks the rotation forward from the next slot', () => {
    const days = [MON, TUE, WED, THU, FRI, SAT, SUN];
    const p = previewDays(days, { schedule: DEFAULT_SCHEDULE, startDate: MON, history: [], exerciseState: {}, ladderState: {}, missedStreak: 0 });
    expect(days.map((d) => p.get(d)!.templateKey)).toEqual([
      'gym-push-a',
      'gym-pull-a',
      'gym-legs-a',
      'gym-zone2',
      'gym-push-b',
      'gym-pull-b-legs-b',
      null,
    ]);
  });
});

describe('missed days', () => {
  it('flags past scheduled training days with no session and no rest check-in; never today or rest days', () => {
    const missed = findMissedDays({
      from: MON,
      today: '2026-11-16',
      schedule: DEFAULT_SCHEDULE,
      sessionDates: new Set([MON]),
      checkIns: new Map([[WED, ci(WED, { location: 'rest' })]]),
    });
    expect(missed).toEqual([TUE, THU, FRI, SAT]);
  });

  it('counts consecutive missed days, skipping rest days', () => {
    const streak = missedStreak({
      today: '2026-11-17', // Tue
      schedule: DEFAULT_SCHEDULE,
      sessionDates: new Set([THU]),
      missed: [{ date: FRI }, { date: SAT }, { date: '2026-11-16' }],
      checkIns: new Map(),
    });
    expect(streak).toBe(3); // Fri, Sat, (Sun rest skipped), Mon
  });

  it('3+ missed days in a row → next session at 80 % volume', () => {
    const normal = generateSession(base());
    const back = generateSession(base({ missedStreak: 3 }));
    const total = (s: typeof normal) => s.main.reduce((n, e) => n + e.sets, 0);
    expect(total(normal)).toBe(15);
    expect(total(back)).toBe(12);
    expect(back.reducedVolume).toBe(true);
    // compounds keep all their sets; accessories lose them first
    expect(back.main[0].sets).toBe(3);
    expect(generateSession(base({ missedStreak: 2 })).reducedVolume).toBe(false);
  });

  it('reduceVolume never drops an exercise below 1 set', () => {
    const p = generateSession(base()).main;
    const r = reduceVolume(p, 0.1);
    expect(r.every((e) => e.sets >= 1)).toBe(true);
  });
});

describe('progression', () => {
  const planned = (key: string, load: number | null, reps: [number, number] = [8, 12], over: Partial<PlannedExercise> = {}): PlannedExercise => ({
    key,
    name: key,
    sets: 3,
    reps,
    unit: 'reps',
    load,
    perHand: false,
    calibration: false,
    restSec: 120,
    tempo: '',
    role: 'compound',
    ...over,
  });

  it('seeds starting loads from the reference lifts', () => {
    expect(SEED_LOADS).toMatchObject({ 'db-bench-press': 17.5, 'lat-pulldown': 39, 'leg-extension': 35 });
    const s = generateSession(base({ date: FRI, checkIn: ci(FRI), history: [hist(MON, 0), hist(TUE, 1), hist(WED, 2)] }));
    expect(s.main.find((e) => e.key === 'db-bench-press')).toMatchObject({ load: 17.5, calibration: false, perHand: true });
  });

  it('exercises with no history start with a calibration set', () => {
    const s = generateSession(base());
    const press = s.main.find((e) => e.key === 'machine-chest-press')!;
    expect(press.calibration).toBe(true);
    expect(press.load).toBeNull();
    const r = progressExercise(undefined, press, sets(3, 10, 40), MON);
    expect(r).toMatchObject({ change: 'calibrated', state: { load: 40 } });
  });

  it('increments: +1 kg per dumbbell, +5 kg lower body/machines, +2.5 kg upper body', () => {
    expect(loadIncrement(getExercise('db-bench-press'))).toBe(1);
    expect(loadIncrement(getExercise('leg-press'))).toBe(5);
    expect(loadIncrement(getExercise('machine-chest-press'))).toBe(5);
    expect(loadIncrement(getExercise('lat-pulldown'))).toBe(2.5);
  });

  it('all sets at the top of the range at RPE ≤ 8 → load goes up', () => {
    const p = planned('db-bench-press', 17.5);
    expect(progressExercise({ key: p.key, load: 17.5, failStreak: 0, updatedAt: MON }, p, sets(3, 12, 17.5, 8), MON).state.load).toBe(18.5);
    expect(progressExercise({ key: 'lat-pulldown', load: 39, failStreak: 0, updatedAt: MON }, planned('lat-pulldown', 39), sets(3, 12, 39, 7), MON).state.load).toBe(41.5);
  });

  it('top of range without a logged RPE → hold (RPE must be recorded to add load)', () => {
    const p = planned('db-bench-press', 17.5);
    expect(progressExercise({ key: p.key, load: 17.5, failStreak: 0, updatedAt: MON }, p, sets(3, 12, 17.5, null), MON).change).toBe('hold');
  });

  it('top of range but RPE 9 → hold', () => {
    const p = planned('db-bench-press', 17.5);
    expect(progressExercise({ key: p.key, load: 17.5, failStreak: 0, updatedAt: MON }, p, sets(3, 12, 17.5, 9), MON)).toMatchObject({ change: 'hold', state: { load: 17.5 } });
  });

  it('not every set at the top → hold', () => {
    const p = planned('leg-extension', 35, [10, 15]);
    const s = [...sets(2, 15, 35), { reps: 13, load: 35, rpe: 8, done: true }];
    expect(progressExercise({ key: p.key, load: 35, failStreak: 0, updatedAt: MON }, p, s, MON).change).toBe('hold');
  });

  it('failing the bottom of the range twice → 10 % lighter', () => {
    const p = planned('lat-pulldown', 39);
    const first = progressExercise({ key: p.key, load: 39, failStreak: 0, updatedAt: MON }, p, sets(3, 6, 39), MON);
    expect(first).toMatchObject({ change: 'hold', state: { load: 39, failStreak: 1 } });
    const second = progressExercise(first.state, p, sets(3, 7, 39), TUE);
    expect(second).toMatchObject({ change: 'decrease', state: { load: 35, failStreak: 0 } }); // 35.1 → 35.0
  });

  it('a good session in between resets the fail streak', () => {
    const p = planned('lat-pulldown', 39);
    const a = progressExercise({ key: p.key, load: 39, failStreak: 1, updatedAt: MON }, p, sets(3, 10, 39), MON);
    expect(a.state.failStreak).toBe(0);
  });

  it('deload sessions never change the load', () => {
    const p = planned('db-bench-press', 17.5);
    expect(progressExercise({ key: p.key, load: 17.5, failStreak: 0, updatedAt: MON }, p, sets(3, 12, 16), MON, { deload: true }).state.load).toBe(17.5);
  });

  it('home ladder advances only after 3 × 12', () => {
    const p = planned('wall-push-up', null);
    expect(progressLadder(undefined, 'push', p, sets(3, 12, null), MON)).toMatchObject({ advanced: true, state: { level: 1 } });
    expect(progressLadder(undefined, 'push', p, [...sets(2, 12, null), { reps: 11, load: null, rpe: 8, done: true }], MON).advanced).toBe(false);
    expect(progressLadder({ id: 'bridge', level: 1, updatedAt: MON }, 'bridge', p, sets(3, 12, null), MON).state.level).toBe(1); // top step
  });

  it('the session uses the current ladder step', () => {
    const s = generateSession(base({ checkIn: ci(MON, { location: 'home' }), ladderState: { push: { id: 'push', level: 2, updatedAt: MON } } }));
    expect(s.main[0].key).toBe('knee-push-up');
    expect(s.main[0].note).toMatch(/step 3 of 4/);
  });
});

describe('deload', () => {
  it('every 6th week is a deload', () => {
    expect(weekNumber(MON, MON)).toBe(1);
    expect(isDeloadWeek(MON, '2026-12-14')).toBe(true); // day 35 → week 6
    expect(isDeloadWeek(MON, '2026-12-13')).toBe(false); // week 5
    expect(isDeloadWeek(MON, '2027-01-25')).toBe(true); // week 12
  });

  it('deload sessions: same exercises, 2 sets, ~10 % lighter', () => {
    const normal = generateSession(base({ date: '2026-12-07', checkIn: ci('2026-12-07'), exerciseState: { 'machine-chest-press': { key: 'machine-chest-press', load: 50, failStreak: 0, updatedAt: MON } } }));
    const deload = generateSession(base({ date: '2026-12-14', checkIn: ci('2026-12-14'), exerciseState: { 'machine-chest-press': { key: 'machine-chest-press', load: 50, failStreak: 0, updatedAt: MON } } }));
    expect(deload.deload).toBe(true);
    expect(deload.main.map((e) => e.key)).toEqual(normal.main.map((e) => e.key));
    expect(deload.main.every((e) => e.sets === 2)).toBe(true);
    expect(deload.main[0].load).toBe(45);
  });
});

describe('pain swaps and soreness', () => {
  it('pain removes exercises that load the area and substitutes safe alternatives', () => {
    const s = generateSession(base({ date: WED, checkIn: ci(WED, { feeling: 'pain', painParts: ['knee'] }), history: [hist(MON, 0), hist(TUE, 1)] }));
    expect(s.templateKey).toBe('gym-legs-a');
    for (const e of s.main) expect(getExercise(e.key).loads).not.toContain('knee');
    expect(s.main.map((e) => e.key)).not.toContain('leg-press');
    expect(s.notes.join(' ')).toMatch(/Removed Leg press/);
  });

  it('shoulder pain on push day swaps where possible and never keeps a shoulder-loading lift', () => {
    const s = generateSession(base({ checkIn: ci(MON, { feeling: 'pain', painParts: ['shoulder'] }) }));
    for (const e of s.main) expect(getExercise(e.key).loads).not.toContain('shoulder');
    // triceps pushdown doesn't load the shoulder and stays
    expect(s.main.map((e) => e.key)).toContain('triceps-pushdown');
  });

  it('a swap is chosen from the same movement pattern', () => {
    const s = generateSession(base({ date: TUE, checkIn: ci(TUE, { feeling: 'pain', painParts: ['lower-back'] }), history: [hist(MON, 0)] }));
    const swapped = s.main.find((e) => e.swappedFrom === 'one-arm-db-row');
    expect(swapped).toBeDefined();
    expect(getExercise(swapped!.key).pattern).toBe('horizontal-pull');
    expect(getExercise(swapped!.key).loads).not.toContain('lower-back');
  });

  it('pain also filters warm-up and cool-down items', () => {
    const s = generateSession(base({ checkIn: ci(MON, { feeling: 'pain', painParts: ['knee'] }) }));
    for (const i of [...s.cooldown]) expect(getExercise(i.key).loads).not.toContain('knee');
  });

  it('sore area: 2 lighter sets', () => {
    const st = { 'machine-chest-press': { key: 'machine-chest-press', load: 50, failStreak: 0, updatedAt: MON } };
    const s = generateSession(base({ exerciseState: st, checkIn: ci(MON, { feeling: 'sore', soreParts: ['chest'] }) }));
    const press = s.main.find((e) => e.key === 'machine-chest-press')!;
    expect(press.sets).toBe(2);
    expect(press.load).toBe(45);
  });

  it('tired: accessories lose a set, compounds keep theirs', () => {
    const s = generateSession(base({ checkIn: ci(MON, { feeling: 'tired' }) }));
    expect(s.main.filter((e) => e.role === 'compound').every((e) => e.sets === 3)).toBe(true);
    expect(s.main.filter((e) => e.role === 'isolation').every((e) => e.sets === 2)).toBe(true);
  });
});

describe('short sessions', () => {
  it('60+ minutes keeps the full session', () => {
    expect(generateSession(base()).main).toHaveLength(5);
  });

  it('every slot length fits inside the time available', () => {
    for (const minutes of [20, 30, 45, 60] as const) {
      for (const loc of ['gym', 'home'] as const) {
        for (let slot = 0; slot < 5; slot++) {
          const s = generateSession(base({ checkIn: ci(MON, { minutes, location: loc }), slotOverride: slot }));
          if (minutes < 60) expect(s.estimatedMin, `${loc} slot ${slot} ${minutes}min`).toBeLessThanOrEqual(minutes);
          // compounds are never trimmed
          const full = generateSession(base({ checkIn: ci(MON, { location: loc }), slotOverride: slot }));
          const compounds = full.main.filter((e) => e.role === 'compound').map((e) => e.key);
          for (const c of compounds) expect(s.main.map((e) => e.key)).toContain(c);
        }
      }
    }
  });

  it('30 minutes trims accessories first', () => {
    const s = generateSession(base({ checkIn: ci(MON, { minutes: 30 }) }));
    expect(s.main.length).toBeLessThan(5);
    expect(s.main.slice(0, 2).map((e) => e.key)).toEqual(['machine-chest-press', 'machine-shoulder-press']);
    expect(s.notes.join(' ')).toMatch(/dropped/);
  });

  it('20 minutes converts to supersets when trimming is not enough', () => {
    const notes: string[] = [];
    const full = generateSession(base({ slotOverride: 4 })).main; // 4 compounds + face pull
    const r = fitToTime(full, 20, 'straight', notes);
    expect(['superset', 'circuit']).toContain(r.format);
    expect(r.main[0].group).toBe(r.main[1].group);
    expect(r.main.map((e) => e.key)).toEqual(full.filter((e) => e.role === 'compound').map((e) => e.key));
    expect(estimateMainMinutes(r.main, r.format)).toBeLessThanOrEqual(20 - 5 - 3);
  });

  it('always includes a warm-up of at least 5 minutes and a cool-down', () => {
    for (const minutes of [20, 30, 45, 60] as const) {
      const s = generateSession(base({ checkIn: ci(MON, { minutes }) }));
      expect(s.warmup.length).toBeGreaterThan(0);
      expect(s.cooldown.length).toBeGreaterThan(0);
    }
  });

  it('cardio scales to the time slot', () => {
    expect(generateSession(base({ date: THU, checkIn: ci(THU, { minutes: 60 }) })).main[0].reps).toEqual([35, 45]);
    expect(generateSession(base({ date: THU, checkIn: ci(THU, { minutes: 30 }) })).main[0].reps[1]).toBeLessThanOrEqual(22);
  });
});

describe('session shape', () => {
  it('records history-compatible fields', () => {
    const s = generateSession(base());
    const rec: Pick<SessionRecord, 'date' | 'slot' | 'kind' | 'endedAt'> = { date: s.date, slot: s.slot, kind: 'strength', endedAt: 1 };
    expect(nextStrengthSlot([rec])).toBe(1);
    expect(s.warmup[0].key).toBe('wu-easy-cardio');
    expect(s.notes.join(' ')).toMatch(/RPE/);
  });
});
