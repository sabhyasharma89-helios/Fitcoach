import type { SessionTemplate, WeeklySchedule } from './types';

/** Rest (seconds) between sets. */
const R = { gymCompound: 120, gymIso: 75, homeCompound: 75, homeIso: 60 } as const;

/**
 * Home bodyweight progression ladders.
 * Advance to the next step when every set reaches the top of the range (3 × 12 for reps,
 * 3 × top-of-range seconds for holds).
 */
export interface Ladder {
  id: string;
  name: string;
  steps: { exercise: string; reps: [number, number] }[];
}

export const LADDER_DEFS: Ladder[] = [
  {
    id: 'push',
    name: 'Push-up ladder',
    steps: [
      { exercise: 'wall-push-up', reps: [8, 12] },
      { exercise: 'incline-push-up', reps: [8, 12] },
      { exercise: 'knee-push-up', reps: [8, 12] },
      { exercise: 'push-up', reps: [8, 12] },
    ],
  },
  {
    id: 'squat',
    name: 'Squat ladder',
    steps: [
      { exercise: 'chair-squat', reps: [8, 12] },
      { exercise: 'bodyweight-squat', reps: [8, 12] },
      { exercise: 'tempo-squat', reps: [8, 12] },
      { exercise: 'split-squat', reps: [8, 12] },
    ],
  },
  {
    id: 'bridge',
    name: 'Glute-bridge ladder',
    steps: [
      { exercise: 'glute-bridge', reps: [8, 12] },
      { exercise: 'single-leg-glute-bridge', reps: [8, 12] },
    ],
  },
  {
    id: 'core',
    name: 'Core ladder',
    steps: [
      { exercise: 'dead-bug', reps: [8, 12] },
      { exercise: 'plank', reps: [20, 45] },
      { exercise: 'side-plank', reps: [15, 30] },
    ],
  },
];

export const LADDER_BY_ID: Record<string, Ladder> = Object.fromEntries(LADDER_DEFS.map((l) => [l.id, l]));

/**
 * Strength rotation: 5 slots, each with a gym and a home version.
 * Slot order follows the default week (Mon, Tue, Wed, Fri, Sat).
 */
export const STRENGTH_ROTATION: { gym: string; home: string }[] = [
  { gym: 'gym-push-a', home: 'home-upper-push' },
  { gym: 'gym-pull-a', home: 'home-lower-core' },
  { gym: 'gym-legs-a', home: 'home-full-body' },
  { gym: 'gym-push-b', home: 'home-upper-pull' },
  { gym: 'gym-pull-b-legs-b', home: 'home-lower-core' },
];

export const TEMPLATES: SessionTemplate[] = [
  {
    key: 'gym-push-a',
    name: 'Push A (machines)',
    location: 'gym',
    kind: 'strength',
    focus: 'Chest, shoulders, triceps',
    slots: [
      { exercise: 'machine-chest-press', sets: 3, reps: [8, 12], restSec: R.gymCompound },
      { exercise: 'machine-shoulder-press', sets: 3, reps: [8, 12], restSec: R.gymCompound },
      { exercise: 'pec-deck', sets: 3, reps: [10, 15], restSec: R.gymIso },
      { exercise: 'cable-lateral-raise', sets: 3, reps: [10, 15], restSec: R.gymIso },
      { exercise: 'triceps-pushdown', sets: 3, reps: [10, 15], restSec: R.gymIso },
    ],
  },
  {
    key: 'gym-pull-a',
    name: 'Pull A (free weights)',
    location: 'gym',
    kind: 'strength',
    focus: 'Back, rear shoulders, biceps',
    slots: [
      { exercise: 'one-arm-db-row', sets: 3, reps: [8, 12], restSec: R.gymCompound },
      { exercise: 'db-incline-row', sets: 3, reps: [8, 12], restSec: R.gymCompound },
      { exercise: 'db-pullover', sets: 3, reps: [10, 15], restSec: R.gymIso },
      { exercise: 'db-rear-delt-raise', sets: 3, reps: [10, 15], restSec: R.gymIso },
      { exercise: 'db-curl', sets: 3, reps: [10, 15], restSec: R.gymIso },
    ],
  },
  {
    key: 'gym-legs-a',
    name: 'Legs A (machines) + core',
    location: 'gym',
    kind: 'strength',
    focus: 'Quads, hamstrings, calves, core',
    slots: [
      { exercise: 'leg-press', sets: 3, reps: [8, 12], restSec: R.gymCompound },
      { exercise: 'leg-extension', sets: 3, reps: [10, 15], restSec: R.gymIso },
      { exercise: 'lying-leg-curl', sets: 3, reps: [10, 15], restSec: R.gymIso },
      { exercise: 'seated-calf-raise', sets: 3, reps: [10, 15], restSec: R.gymIso },
      { exercise: 'cable-crunch', sets: 3, reps: [10, 15], restSec: R.gymIso },
      { exercise: 'plank', sets: 2, reps: [20, 45], restSec: 60 },
    ],
  },
  {
    key: 'gym-push-b',
    name: 'Push B (free weights)',
    location: 'gym',
    kind: 'strength',
    focus: 'Chest, shoulders, triceps',
    slots: [
      { exercise: 'db-bench-press', sets: 3, reps: [8, 12], restSec: R.gymCompound },
      { exercise: 'db-shoulder-press', sets: 3, reps: [8, 12], restSec: R.gymCompound },
      { exercise: 'db-incline-press', sets: 3, reps: [8, 12], restSec: R.gymCompound },
      { exercise: 'db-lateral-raise', sets: 3, reps: [10, 15], restSec: R.gymIso },
      { exercise: 'db-overhead-triceps', sets: 3, reps: [10, 15], restSec: R.gymIso },
    ],
  },
  {
    key: 'gym-pull-b-legs-b',
    name: 'Pull B (machines) + Legs B (free weights)',
    location: 'gym',
    kind: 'strength',
    focus: 'Back and legs — shorter session',
    slots: [
      { exercise: 'lat-pulldown', sets: 3, reps: [8, 12], restSec: R.gymCompound },
      { exercise: 'goblet-squat', sets: 3, reps: [8, 12], restSec: R.gymCompound },
      { exercise: 'seated-cable-row', sets: 3, reps: [8, 12], restSec: R.gymCompound },
      { exercise: 'db-rdl', sets: 3, reps: [8, 12], restSec: R.gymCompound },
      { exercise: 'face-pull', sets: 2, reps: [10, 15], restSec: R.gymIso },
    ],
  },
  {
    key: 'gym-zone2',
    name: 'Zone-2 cardio + mobility',
    location: 'gym',
    kind: 'cardio',
    focus: 'Heart and fat loss — easy, steady effort',
    slots: [{ exercise: 'incline-treadmill-walk', sets: 1, reps: [35, 45], restSec: 0 }],
  },
  {
    key: 'home-upper-push',
    name: 'Home Upper (push focus)',
    location: 'home',
    kind: 'strength',
    focus: 'Chest, shoulders, triceps, core',
    slots: [
      { ladder: 'push', sets: 3, reps: [8, 12], restSec: R.homeCompound },
      { exercise: 'towel-triceps', sets: 3, reps: [10, 15], restSec: R.homeIso },
      { exercise: 'reverse-snow-angel', sets: 3, reps: [10, 15], restSec: R.homeIso },
      { ladder: 'core', sets: 3, reps: [8, 12], restSec: R.homeIso },
      { exercise: 'superman', sets: 2, reps: [10, 15], restSec: R.homeIso },
    ],
  },
  {
    key: 'home-lower-core',
    name: 'Home Lower + Core',
    location: 'home',
    kind: 'strength',
    focus: 'Legs, glutes, core',
    slots: [
      { ladder: 'squat', sets: 3, reps: [8, 12], restSec: R.homeCompound },
      { ladder: 'bridge', sets: 3, reps: [8, 12], restSec: R.homeCompound },
      { exercise: 'step-up', sets: 3, reps: [8, 12], restSec: R.homeCompound },
      { exercise: 'standing-calf-raise-home', sets: 3, reps: [10, 15], restSec: R.homeIso },
      { ladder: 'core', sets: 3, reps: [8, 12], restSec: R.homeIso },
      { exercise: 'reverse-crunch', sets: 2, reps: [10, 15], restSec: R.homeIso },
    ],
  },
  {
    key: 'home-full-body',
    name: 'Home Full-body circuit',
    location: 'home',
    kind: 'strength',
    focus: 'Whole body, low impact — done as a circuit',
    format: 'circuit',
    slots: [
      { ladder: 'squat', sets: 3, reps: [8, 12], restSec: 30 },
      { ladder: 'push', sets: 3, reps: [8, 12], restSec: 30 },
      { exercise: 'towel-row', sets: 3, reps: [8, 12], restSec: 30 },
      { ladder: 'bridge', sets: 3, reps: [8, 12], restSec: 30 },
      { exercise: 'step-up', sets: 3, reps: [8, 12], restSec: 30 },
      { ladder: 'core', sets: 3, reps: [8, 12], restSec: 90 },
    ],
  },
  {
    key: 'home-upper-pull',
    name: 'Home Upper (pull / back focus)',
    location: 'home',
    kind: 'strength',
    focus: 'Upper back, rear shoulders, posture',
    slots: [
      { exercise: 'towel-row', sets: 3, reps: [8, 12], restSec: R.homeCompound },
      { exercise: 'reverse-snow-angel', sets: 3, reps: [10, 15], restSec: R.homeIso },
      { exercise: 'superman', sets: 3, reps: [10, 15], restSec: R.homeIso },
      { ladder: 'push', sets: 2, reps: [8, 12], restSec: R.homeCompound },
      { exercise: 'dead-bug', sets: 3, reps: [8, 12], restSec: R.homeIso },
    ],
  },
  {
    key: 'home-walk',
    name: 'Brisk walk + mobility',
    location: 'home',
    kind: 'cardio',
    focus: 'Easy steady walking',
    slots: [{ exercise: 'brisk-walk', sets: 1, reps: [40, 40], restSec: 0 }],
  },
];

export const TEMPLATE_BY_KEY: Record<string, SessionTemplate> = Object.fromEntries(TEMPLATES.map((t) => [t.key, t]));

export const DEFAULT_SCHEDULE: WeeklySchedule = {
  //          Mon         Tue         Wed         Thu       Fri         Sat         Sun
  dayTypes: ['strength', 'strength', 'strength', 'cardio', 'strength', 'strength', 'rest'],
  defaultLocation: ['gym', 'gym', 'gym', 'gym', 'gym', 'gym', 'home'],
  defaultMinutes: 60,
};

export const WARMUP_KEYS = ['wu-easy-cardio', 'wu-arm-circles', 'wu-hip-circles', 'wu-cat-stretch', 'wu-worlds-greatest'];
export const COOLDOWN_KEYS = ['cd-hamstring', 'cd-quad', 'cd-hip-flexor', 'cd-chest', 'cd-calf', 'cd-childs-pose'];

/** Every catalog key a template, ladder, warm-up or cool-down can produce. */
export function allPlanExerciseKeys(): string[] {
  const keys = new Set<string>([...WARMUP_KEYS, ...COOLDOWN_KEYS]);
  for (const t of TEMPLATES) for (const s of t.slots) if (s.exercise) keys.add(s.exercise);
  for (const l of LADDER_DEFS) for (const s of l.steps) keys.add(s.exercise);
  return [...keys];
}
