import { CATALOG } from './catalog';
import { allPlanExerciseKeys } from '../engine/templates';
import { CATALOG_BY_KEY } from './catalog';

export interface DbLike {
  id: string;
  images: string[];
  instructions: string[];
}

/**
 * Returns a list of problems; empty means valid.
 * - every plan exercise key exists in the catalog
 * - every catalog dbId exists in the synced free-exercise-db subset
 * - every one has ≥ 2 images (start/end), every image file exists, and instructions are non-empty
 */
export function validateExercises(db: DbLike[], fileExists: (relPath: string) => boolean): string[] {
  const problems: string[] = [];
  const byId = new Map(db.map((e) => [e.id, e]));
  for (const key of allPlanExerciseKeys()) {
    if (!CATALOG_BY_KEY[key]) problems.push(`Plan references unknown exercise key "${key}"`);
  }
  const keys = new Set<string>();
  for (const c of CATALOG) {
    if (keys.has(c.key)) problems.push(`Duplicate catalog key "${c.key}"`);
    keys.add(c.key);
    const e = byId.get(c.dbId);
    if (!e) {
      problems.push(`"${c.key}" maps to free-exercise-db id "${c.dbId}", which does not exist`);
      continue;
    }
    if (e.images.length < 2) problems.push(`"${c.dbId}" has ${e.images.length} image(s); 2 needed`);
    for (const img of e.images) if (!fileExists(`public/exercises/${img}`)) problems.push(`Missing image file public/exercises/${img}`);
    const instr = c.instructionsOverride ?? e.instructions;
    if (!instr.length || instr.every((s) => !s.trim())) problems.push(`"${c.key}" (${c.dbId}) has no instructions`);
    if (c.cues.length < 2) problems.push(`"${c.key}" needs at least 2 form cues`);
  }
  return problems;
}
