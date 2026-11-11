/**
 * Downloads free-exercise-db (github.com/yuhonas/free-exercise-db, Unlicense), keeps only the
 * exercises FitOS uses (every catalog entry = plan exercises + their swap alternatives), writes
 * the subset to src/data/exercise-db.json and copies their images into public/exercises/ so the
 * cards work offline.
 *
 * Usage: npm run sync:exercises
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { CATALOG } from '../src/data/catalog';

const RAW = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main';
const ROOT = path.resolve(import.meta.dirname, '..');

interface DbExercise {
  id: string;
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
}

async function fetchWithRetry(url: string, tries = 4): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      lastErr = new Error(`${res.status} ${res.statusText} for ${url}`);
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
  }
  throw lastErr;
}

async function exists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const res = await fetchWithRetry(`${RAW}/dist/exercises.json`);
  const all = (await res.json()) as DbExercise[];
  const byId = new Map(all.map((e) => [e.id, e]));
  const wanted = [...new Set(CATALOG.map((c) => c.dbId))].sort();

  const missing = wanted.filter((id) => !byId.has(id));
  if (missing.length) throw new Error(`free-exercise-db has no exercise with id(s): ${missing.join(', ')}`);

  const subset = wanted.map((id) => {
    const e = byId.get(id)!;
    return {
      id: e.id,
      name: e.name,
      level: e.level,
      category: e.category,
      equipment: e.equipment,
      primaryMuscles: e.primaryMuscles,
      secondaryMuscles: e.secondaryMuscles,
      instructions: e.instructions,
      images: e.images,
    };
  });

  let downloaded = 0;
  for (const e of subset) {
    for (const img of e.images) {
      const dest = path.join(ROOT, 'public', 'exercises', img);
      if (await exists(dest)) continue;
      await mkdir(path.dirname(dest), { recursive: true });
      const r = await fetchWithRetry(`${RAW}/exercises/${img.split('/').map(encodeURIComponent).join('/')}`);
      await writeFile(dest, Buffer.from(await r.arrayBuffer()));
      downloaded++;
    }
  }

  await writeFile(
    path.join(ROOT, 'src', 'data', 'exercise-db.json'),
    JSON.stringify(
      {
        source: 'https://github.com/yuhonas/free-exercise-db (Unlicense)',
        syncedAt: new Date().toISOString().slice(0, 10),
        exercises: subset,
      },
      null,
      1,
    ) + '\n',
  );
  console.log(`Synced ${subset.length} exercises; downloaded ${downloaded} new images.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
