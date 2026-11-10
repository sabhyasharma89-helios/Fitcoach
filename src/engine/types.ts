import type { BodyPart, Unit } from '../data/catalog';
import type { DayKey } from '../lib/date';

export type CheckInLocation = 'gym' | 'home' | 'travel' | 'rest';
export type SlotMinutes = 20 | 30 | 45 | 60;
export type Feeling = 'fresh' | 'normal' | 'tired' | 'sore' | 'pain';
export type DayType = 'strength' | 'cardio' | 'rest';

export interface CheckIn {
  date: DayKey;
  location: CheckInLocation;
  minutes: SlotMinutes;
  feeling: Feeling;
  soreParts: BodyPart[];
  painParts: BodyPart[];
  /** true when the app filled it in because the check-in was skipped */
  auto?: boolean;
}

export interface WeeklySchedule {
  /** index 0 = Monday … 6 = Sunday */
  dayTypes: DayType[];
  /** where you normally train on that weekday (used when the check-in is missed) */
  defaultLocation: ('gym' | 'home')[];
  defaultMinutes: SlotMinutes;
}

export interface SlotDef {
  /** catalog key, or omitted when `ladder` is set */
  exercise?: string;
  ladder?: string;
  sets: number;
  reps: [number, number];
  restSec: number;
}

export interface SessionTemplate {
  key: string;
  name: string;
  location: 'gym' | 'home';
  kind: 'strength' | 'cardio';
  focus: string;
  /** 'circuit' sessions are always run as a circuit */
  format?: 'straight' | 'circuit';
  slots: SlotDef[];
}

export interface PlannedExercise {
  key: string;
  name: string;
  sets: number;
  reps: [number, number];
  unit: Unit;
  /** kg (per hand for dumbbells). null = bodyweight, cardio, or needs calibration */
  load: number | null;
  perHand: boolean;
  calibration: boolean;
  restSec: number;
  tempo: string;
  role: 'compound' | 'isolation' | 'cardio';
  ladder?: string;
  /** e.g. "A" — exercises sharing a group are done back-to-back */
  group?: string;
  swappedFrom?: string;
  note?: string;
}

export interface PlannedItem {
  key: string;
  name: string;
  /** e.g. "60 s", "2 min", "30 s per side" */
  dose: string;
}

export interface PlannedSession {
  date: DayKey;
  kind: 'strength' | 'cardio' | 'rest';
  templateKey: string | null;
  title: string;
  location: CheckInLocation;
  minutes: SlotMinutes;
  /** position in the strength rotation (0…4); null for cardio/rest */
  slot: number | null;
  format: 'straight' | 'superset' | 'circuit';
  warmup: PlannedItem[];
  main: PlannedExercise[];
  cooldown: PlannedItem[];
  notes: string[];
  estimatedMin: number;
  deload: boolean;
  reducedVolume: boolean;
  week: number;
}

export interface LoggedSet {
  reps: number | null;
  load: number | null;
  rpe: number | null;
  done: boolean;
}

export interface LoggedExercise {
  key: string;
  sets: LoggedSet[];
  skipped?: { reason: string };
}

export type SessionStatus = 'completed' | 'partial';

export interface SessionRecord {
  id?: number;
  date: DayKey;
  slot: number | null;
  templateKey: string | null;
  kind: 'strength' | 'cardio';
  status: SessionStatus;
  plan: PlannedSession;
  exercises: LoggedExercise[];
  startedAt: number;
  endedAt: number;
  durationMin: number;
  source?: 'fitos' | 'healthconnect';
}

export interface ExerciseState {
  key: string;
  /** current working load (kg; per hand for dumbbells) */
  load: number | null;
  /** consecutive sessions failing the bottom of the rep range */
  failStreak: number;
  updatedAt: DayKey;
}

export interface LadderState {
  id: string;
  level: number;
  updatedAt: DayKey;
}

export interface MissedDay {
  date: DayKey;
  reason?: string;
}
