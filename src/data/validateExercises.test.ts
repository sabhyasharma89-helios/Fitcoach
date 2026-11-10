import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import raw from './exercise-db.json';
import { validateExercises } from './validateExercises';
import { CATALOG } from './catalog';
import { allPlanExerciseKeys } from '../engine/templates';

const ROOT = path.resolve(import.meta.dirname, '../..');
const exists = (p: string) => existsSync(path.join(ROOT, p));

describe('exercise library', () => {
  it('every plan exercise maps to an existing free-exercise-db id with images and instructions', () => {
    expect(validateExercises(raw.exercises, exists)).toEqual([]);
  });

  it('every plan key is in the catalog', () => {
    const keys = new Set(CATALOG.map((c) => c.key));
    for (const k of allPlanExerciseKeys()) expect(keys.has(k), k).toBe(true);
  });

  it('detects a missing id', () => {
    const withoutOne = raw.exercises.filter((e) => e.id !== 'Leg_Press');
    expect(validateExercises(withoutOne, exists).join('\n')).toMatch(/Leg_Press/);
  });

  it('detects missing images', () => {
    const broken = raw.exercises.map((e) => (e.id === 'Plank' ? { ...e, images: [] } : e));
    expect(validateExercises(broken, exists).join('\n')).toMatch(/Plank.*0 image/);
    expect(validateExercises(raw.exercises, () => false).length).toBeGreaterThan(0);
  });

  it('contains no high-impact exercises in the default plans', () => {
    const planKeys = new Set(allPlanExerciseKeys());
    expect(CATALOG.filter((c) => planKeys.has(c.key) && c.highImpact)).toEqual([]);
  });
});
