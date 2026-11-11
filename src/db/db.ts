import Dexie, { type EntityTable } from 'dexie';
import type { DayKey } from '../lib/date';
import type { ActivityId, Sex } from '../engine/nutrition';
import type { CheckIn, ExerciseState, LadderState, MissedDay, SessionRecord, WeeklySchedule } from '../engine/types';
import { DEFAULT_SCHEDULE } from '../engine/templates';
import { SEED_LOADS } from '../engine/progression';

export interface Settings {
  id: 'me';
  sex: Sex;
  birthYear: number;
  heightCm: number;
  startWeightKg: number;
  goalWeightKg: number;
  activity: ActivityId;
  /** weight the current calorie target was based on (recalculated every 2 kg) */
  calorieBasisKg: number | null;
  waterTargetMl: number;
  programStart: DayKey;
  schedule: WeeklySchedule;
  disclaimerAcceptedAt: number | null;
  lastBackupAt: number | null;
  /** last day for which missed days were computed */
  missedCheckedThrough: DayKey | null;
  healthConnectEnabled: boolean;
  lastHealthSyncAt: number | null;
}

export interface WeightEntry {
  date: DayKey;
  kg: number;
  source: 'manual' | 'healthconnect';
  at: number;
}
export interface WaistEntry {
  date: DayKey;
  cm: number;
}
export interface StepsEntry {
  date: DayKey;
  count: number;
  source: 'manual' | 'healthconnect' | 'samsung-csv';
}
export type Meal = 'breakfast' | 'lunch' | 'snacks' | 'dinner';
export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number | null;
}
export interface FoodLog extends Nutrients {
  id?: number;
  date: DayKey;
  meal: Meal;
  foodId: string;
  name: string;
  grams: number;
  /** human-readable amount, e.g. "2 × chapati (36 g)" */
  amount: string;
  source: string;
  at: number;
}
export interface CustomFood {
  id: string;
  name: string;
  /** per 100 g */
  per100: Nutrients;
  servingG: number;
  servingLabel: string;
  source: string;
  barcode?: string;
  createdAt: number;
}
export interface SavedMeal {
  id?: number;
  name: string;
  items: Omit<FoodLog, 'id' | 'date' | 'at'>[];
}
export interface ExternalWorkout {
  id: string;
  date: DayKey;
  type: string;
  durationMin: number;
  kcal: number | null;
  sourceName: string | null;
}
export interface ActiveEnergy {
  date: DayKey;
  kcal: number;
}
export interface WaterEntry {
  date: DayKey;
  ml: number;
}

export class FitDB extends Dexie {
  settings!: EntityTable<Settings, 'id'>;
  checkIns!: EntityTable<CheckIn, 'date'>;
  sessions!: EntityTable<SessionRecord, 'id'>;
  missed!: EntityTable<MissedDay, 'date'>;
  exerciseState!: EntityTable<ExerciseState, 'key'>;
  ladderState!: EntityTable<LadderState, 'id'>;
  weights!: EntityTable<WeightEntry, 'date'>;
  waists!: EntityTable<WaistEntry, 'date'>;
  steps!: EntityTable<StepsEntry, 'date'>;
  foodLogs!: EntityTable<FoodLog, 'id'>;
  customFoods!: EntityTable<CustomFood, 'id'>;
  savedMeals!: EntityTable<SavedMeal, 'id'>;
  water!: EntityTable<WaterEntry, 'date'>;
  externalWorkouts!: EntityTable<ExternalWorkout, 'id'>;
  activeEnergy!: EntityTable<ActiveEnergy, 'date'>;

  constructor(name = 'fitos') {
    super(name);
    // Schema history. Never edit an existing version — add a new version() with an upgrade().
    this.version(1).stores({
      settings: 'id',
      checkIns: 'date',
      sessions: '++id, date, kind, [kind+date]',
      missed: 'date',
      exerciseState: 'key',
      ladderState: 'id',
      weights: 'date',
      waists: 'date',
      steps: 'date',
      foodLogs: '++id, date, foodId',
      customFoods: 'id, barcode, name',
      savedMeals: '++id, name',
      water: 'date',
      externalWorkouts: 'id, date',
      activeEnergy: 'date',
    });
  }
}

export const db = new FitDB();

export const SCHEMA_VERSION = 1;
export const TABLES = [
  'settings',
  'checkIns',
  'sessions',
  'missed',
  'exerciseState',
  'ladderState',
  'weights',
  'waists',
  'steps',
  'foodLogs',
  'customFoods',
  'savedMeals',
  'water',
  'externalWorkouts',
  'activeEnergy',
] as const;

export function defaultSettings(today: DayKey): Settings {
  return {
    id: 'me',
    sex: 'male',
    birthYear: 1989, // 37 in 2026
    heightCm: 183,
    startWeightKg: 100,
    goalWeightKg: 85,
    activity: 'light',
    calorieBasisKg: 100,
    waterTargetMl: 3000,
    programStart: today,
    schedule: DEFAULT_SCHEDULE,
    disclaimerAcceptedAt: null,
    lastBackupAt: null,
    missedCheckedThrough: null,
    healthConnectEnabled: false,
    lastHealthSyncAt: null,
  };
}

/** First run: create the seed profile and the starting loads from the reference lifts. */
export async function ensureSeeded(database: FitDB, today: DayKey): Promise<Settings> {
  return database.transaction('rw', database.settings, database.exerciseState, async () => {
    const existing = await database.settings.get('me');
    if (existing) return existing;
    const s = defaultSettings(today);
    await database.settings.put(s);
    for (const [key, load] of Object.entries(SEED_LOADS)) {
      if (!(await database.exerciseState.get(key))) await database.exerciseState.put({ key, load, failStreak: 0, updatedAt: today });
    }
    return s;
  });
}
