import { describe, expect, it } from 'vitest';
import { adherence28, currentStreak, dayStatus, weeklyVolume } from './adherence';
import { calorieTarget, mifflinStJeor, nextCalorieBasis, proteinTarget, CALORIE_FLOOR } from './nutrition';
import { stepTarget } from './steps';
import { DEFAULT_SCHEDULE } from './templates';
import { movingAverage7, projectGoalDate, rapidLossWarning, weeklyRate } from './weight';
import { addDaysKey } from '../lib/date';
import type { SessionRecord } from './types';

describe('nutrition', () => {
  it('Mifflin-St Jeor for the seed profile (male, 100 kg, 183 cm, 37 y)', () => {
    // 10*100 + 6.25*183 - 5*37 + 5 = 1000 + 1143.75 - 185 + 5 = 1963.75
    expect(mifflinStJeor('male', 100, 183, 37)).toBeCloseTo(1963.75, 2);
  });
  it('target = BMR × activity − 500', () => {
    // 1963.75 × 1.375 = 2700.16 − 500 = 2200.16 → 2200
    expect(calorieTarget({ sex: 'male', weightKg: 100, heightCm: 183, age: 37, activity: 'light' })).toBe(2200);
  });
  it('never below 1,500 kcal', () => {
    expect(calorieTarget({ sex: 'female', weightKg: 45, heightCm: 150, age: 60, activity: 'sedentary' })).toBe(CALORIE_FLOOR);
  });
  it('recalculates only after 2 kg of change', () => {
    expect(nextCalorieBasis(100, 98.5)).toBe(100);
    expect(nextCalorieBasis(100, 98)).toBe(98);
    expect(nextCalorieBasis(null, 99)).toBe(99);
  });
  it('protein 1.6 g/kg of goal weight', () => {
    expect(proteinTarget(85)).toBe(136);
  });
});

describe('weight trend', () => {
  const series = (start: string, kgs: number[]) => kgs.map((v, i) => ({ date: addDaysKey(start, i), value: v }));
  it('7-day moving average', () => {
    const ma = movingAverage7(series('2026-11-01', [100, 100, 100, 100, 100, 100, 93]));
    expect(ma[6].value).toBeCloseTo(99, 5);
    expect(ma[0].value).toBe(100);
  });
  it('weekly rate and projected date', () => {
    const pts = series('2026-11-01', Array.from({ length: 21 }, (_, i) => 100 - i * (0.7 / 7)));
    const today = addDaysKey('2026-11-01', 20);
    expect(weeklyRate(pts, today)).toBeCloseTo(-0.7, 5);
    const d = projectGoalDate(pts, today, 85)!;
    expect(d > today).toBe(true);
  });
  it('no projection when not losing', () => {
    const pts = series('2026-11-01', Array.from({ length: 14 }, () => 100));
    expect(projectGoalDate(pts, '2026-11-14', 85)).toBeNull();
  });
  it('warns when losing > 1 %/week two weeks running, not for one week', () => {
    const fast = series('2026-11-01', Array.from({ length: 22 }, (_, i) => 100 - i * 0.2)); // 1.4 kg/week
    expect(rapidLossWarning(fast, addDaysKey('2026-11-01', 21)).warn).toBe(true);
    const steady = series('2026-11-01', Array.from({ length: 22 }, (_, i) => 100 - i * 0.1)); // 0.7 kg/week
    expect(rapidLossWarning(steady, addDaysKey('2026-11-01', 21)).warn).toBe(false);
    const oneWeek = series('2026-11-01', Array.from({ length: 22 }, (_, i) => (i < 14 ? 100 : 100 - (i - 13) * 0.25)));
    expect(rapidLossWarning(oneWeek, addDaysKey('2026-11-01', 21)).warn).toBe(false);
  });
});

describe('steps', () => {
  it('last week average + 1,000, capped at 10,000, fixed for the week', () => {
    const m = new Map<string, number>();
    for (let i = 0; i < 7; i++) m.set(addDaysKey('2026-11-02', i), 6000); // Mon 2 – Sun 8 Nov
    expect(stepTarget(m, '2026-11-09').target).toBe(7000); // Monday
    expect(stepTarget(m, '2026-11-12').target).toBe(7000); // Thursday — same week, same target
    for (let i = 0; i < 7; i++) m.set(addDaysKey('2026-11-02', i), 9800);
    expect(stepTarget(m, '2026-11-09').target).toBe(10000);
  });
  it('defaults to 5,000 with no history', () => {
    expect(stepTarget(new Map(), '2026-11-09').target).toBe(5000);
  });
});

describe('adherence', () => {
  const rec = (date: string, status: 'completed' | 'partial' = 'completed'): SessionRecord =>
    ({ date, status, kind: 'strength', slot: 0, templateKey: 'gym-push-a', exercises: [{ key: 'machine-chest-press', sets: [{ reps: 10, load: 40, rpe: 8, done: true }, { reps: 10, load: 40, rpe: 8, done: true }] }], plan: {} as never, startedAt: 0, endedAt: 0, durationMin: 50 }) as SessionRecord;
  const byDate = (rs: SessionRecord[]) => {
    const m = new Map<string, SessionRecord[]>();
    for (const r of rs) m.set(r.date, [...(m.get(r.date) ?? []), r]);
    return m;
  };
  const args = (rs: SessionRecord[], today: string) => ({ today, schedule: DEFAULT_SCHEDULE, sessions: byDate(rs), checkIns: new Map() });

  it('day status', () => {
    const a = args([rec('2026-11-09'), rec('2026-11-10', 'partial')], '2026-11-12');
    expect(dayStatus({ ...a, date: '2026-11-09' })).toBe('completed');
    expect(dayStatus({ ...a, date: '2026-11-10' })).toBe('partial');
    expect(dayStatus({ ...a, date: '2026-11-11' })).toBe('missed');
    expect(dayStatus({ ...a, date: '2026-11-12' })).toBe('today');
    expect(dayStatus({ ...a, date: '2026-11-13' })).toBe('planned');
    expect(dayStatus({ ...a, date: '2026-11-15' })).toBe('rest');
  });
  it('streak skips rest days and stops at a miss', () => {
    // Sat 14 done, Sun 15 rest, Mon 16 today (not done yet)
    expect(currentStreak(args([rec('2026-11-13'), rec('2026-11-14')], '2026-11-16'))).toBe(2);
    expect(currentStreak(args([rec('2026-11-12'), rec('2026-11-14')], '2026-11-16'))).toBe(1);
  });
  it('4-week adherence %', () => {
    const r = adherence28(args([rec('2026-11-09'), rec('2026-11-10', 'partial')], '2026-11-12'));
    expect(r.scheduled).toBe(23); // 27 past days excl. today with nothing logged → 4 Sundays rest
    expect(r.done).toBe(1.5);
  });
  it('weekly volume per muscle group', () => {
    const v = weeklyVolume([rec('2026-11-09')], '2026-11-12');
    expect(v.Chest).toBe(2);
    expect(v.Legs).toBe(0);
  });
});
