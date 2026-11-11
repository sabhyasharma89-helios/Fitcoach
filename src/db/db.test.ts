import { beforeEach, describe, expect, it } from 'vitest';
import { FitDB, ensureSeeded } from './db';
import { backupDue, exportBackup, importBackup } from './backup';
import { engineContext, planFor, recordMissedDays, saveWorkout, sessionStatus } from './repo';
import type { LoggedExercise } from '../engine/types';

let db: FitDB;
beforeEach(async () => {
  db = new FitDB(`test-${Math.random()}`);
  await ensureSeeded(db, '2026-11-09');
});

describe('database', () => {
  it('seeds the profile and reference loads once', async () => {
    const s = await db.settings.get('me');
    expect(s).toMatchObject({ heightCm: 183, startWeightKg: 100, goalWeightKg: 85, sex: 'male' });
    expect((await db.exerciseState.get('lat-pulldown'))?.load).toBe(39);
    await ensureSeeded(db, '2026-11-20');
    expect((await db.settings.get('me'))?.programStart).toBe('2026-11-09');
  });

  it('saving a workout advances the rotation and applies progression', async () => {
    const ctx = await engineContext(db);
    const plan = planFor(ctx, '2026-11-13', { date: '2026-11-13', location: 'gym', minutes: 60, feeling: 'normal', soreParts: [], painParts: [] });
    expect(plan.templateKey).toBe('gym-push-a');
    const logged: LoggedExercise[] = plan.main.map((p) => ({
      key: p.key,
      sets: Array.from({ length: p.sets }, () => ({ reps: p.reps[1], load: p.load ?? 30, rpe: 8, done: true })),
    }));
    expect(sessionStatus(plan, logged)).toBe('completed');
    const r = await saveWorkout(plan, logged, 0, 3_000_000, db);
    expect(r.status).toBe('completed');
    expect((await db.exerciseState.get('machine-chest-press'))?.load).toBe(30); // calibrated
    const ctx2 = await engineContext(db);
    expect(planFor(ctx2, '2026-11-14').templateKey).toBe('gym-pull-a');
  });

  it('records missed training days once', async () => {
    const n = await recordMissedDays('2026-11-12', db);
    expect(n).toBe(3); // Mon, Tue, Wed
    expect(await recordMissedDays('2026-11-12', db)).toBe(0);
  });

  it('backup round-trips all data', async () => {
    await db.weights.put({ date: '2026-11-10', kg: 99.4, source: 'manual', at: 1 });
    const file = await exportBackup(db);
    const other = new FitDB(`restore-${Math.random()}`);
    await importBackup(other, JSON.parse(JSON.stringify(file)));
    expect(await other.weights.get('2026-11-10')).toMatchObject({ kg: 99.4 });
    expect(await other.settings.get('me')).toMatchObject({ heightCm: 183 });
    await expect(importBackup(other, { app: 'Other' })).rejects.toThrow(/not a FitOS backup/);
    expect(await other.weights.count()).toBe(1); // failed import changed nothing
  });

  it('backup reminder every 14 days', () => {
    expect(backupDue(null)).toBe(true);
    expect(backupDue(Date.now() - 13 * 86400_000)).toBe(false);
    expect(backupDue(Date.now() - 14 * 86400_000)).toBe(true);
  });
});
