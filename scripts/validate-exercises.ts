/** Build gate: fails if any plan references an exercise id that doesn't exist or has no images. */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { validateExercises } from '../src/data/validateExercises';

const ROOT = path.resolve(import.meta.dirname, '..');
const db = JSON.parse(readFileSync(path.join(ROOT, 'src/data/exercise-db.json'), 'utf8')).exercises;
const problems = validateExercises(db, (p) => existsSync(path.join(ROOT, p)));
if (problems.length) {
  console.error('Exercise validation failed:\n - ' + problems.join('\n - '));
  process.exit(1);
}
console.log(`Exercise validation passed (${db.length} free-exercise-db entries).`);
