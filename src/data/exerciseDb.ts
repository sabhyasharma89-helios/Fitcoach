import raw from './exercise-db.json';
import { CATALOG_BY_KEY, type CatalogExercise } from './catalog';

export interface DbExercise {
  id: string;
  name: string;
  level: string;
  category: string;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images: string[];
}

export const EXERCISE_DB_SOURCE = raw.source;
export const EXERCISE_DB: Record<string, DbExercise> = Object.fromEntries(
  (raw.exercises as DbExercise[]).map((e) => [e.id, e]),
);

export interface ResolvedExercise extends CatalogExercise {
  db: DbExercise;
  instructions: string[];
  imageUrls: string[];
}

/** Catalog entry + its free-exercise-db data, with image URLs relative to the app base. */
export function resolveExercise(key: string): ResolvedExercise {
  const c = CATALOG_BY_KEY[key];
  if (!c) throw new Error(`Unknown exercise key ${key}`);
  const db = EXERCISE_DB[c.dbId];
  if (!db) throw new Error(`Exercise ${key} maps to missing free-exercise-db id ${c.dbId}`);
  return {
    ...c,
    db,
    instructions: c.instructionsOverride ?? db.instructions,
    imageUrls: db.images.map((p) => `${import.meta.env.BASE_URL}exercises/${p}`),
  };
}
