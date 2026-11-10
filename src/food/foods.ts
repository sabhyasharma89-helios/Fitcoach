import data from '../data/foods.json';
import type { CustomFood, Nutrients } from '../db/db';

export interface Food {
  id: string;
  name: string;
  category: string;
  per100: Nutrients;
  serving: { label: string; grams: number } | null;
  source: string;
  sourceCode?: string;
}

export const FOOD_SOURCES: string[] = data.sources;
export const BUNDLED_FOODS: Food[] = data.foods as Food[];

export function customToFood(c: CustomFood): Food {
  return {
    id: c.id,
    name: c.name,
    category: c.barcode ? 'Packaged' : 'My foods',
    per100: c.per100,
    serving: c.servingG ? { label: c.servingLabel || `${c.servingG} g`, grams: c.servingG } : null,
    source: c.source,
  };
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Simple ranked search: every query word must appear; name-start matches rank first. */
export function searchFoods(q: string, foods: Food[], limit = 40): Food[] {
  const words = norm(q).split(' ').filter(Boolean);
  if (!words.length) return foods.slice(0, limit);
  const scored: { f: Food; s: number; i: number }[] = [];
  for (const [i, f] of foods.entries()) {
    const hay = norm(`${f.name} ${f.category} ${f.source.split(';').slice(-1)[0]}`);
    if (!words.every((w) => hay.includes(w))) continue;
    const name = norm(f.name);
    const nameWords = name.split(' ');
    const s =
      (name.startsWith(words[0]) ? 0 : nameWords.includes(words[0]) ? 1 : name.includes(words[0]) ? 2 : 3) +
      (f.id.startsWith('custom') || f.id.startsWith('off-') ? -0.5 : 0);
    scored.push({ f, s, i });
  }
  // ties keep dataset order (common staples are listed first)
  return scored.sort((a, b) => a.s - b.s || a.i - b.i).slice(0, limit).map((x) => x.f);
}
