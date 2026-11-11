import type { CustomFood } from '../db/db';

/** Open Food Facts product lookup (only the barcode number is sent). */
export async function lookupBarcode(barcode: string, fetchImpl: typeof fetch = fetch): Promise<CustomFood | null> {
  const code = barcode.replace(/\D/g, '');
  if (!code) return null;
  const url = `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=code,product_name,product_name_en,brands,nutriments,serving_size,serving_quantity`;
  const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts returned ${res.status}`);
  const j = await res.json();
  if (j.status !== 1 || !j.product) return null;
  return offToFood(code, j.product);
}

interface OffProduct {
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
}

export function offToFood(code: string, p: OffProduct): CustomFood | null {
  const n = p.nutriments ?? {};
  const g = (k: string) => {
    const v = n[k];
    const x = typeof v === 'string' ? Number(v) : v;
    return typeof x === 'number' && Number.isFinite(x) ? x : null;
  };
  let kcal = g('energy-kcal_100g');
  const kj = g('energy-kj_100g') ?? g('energy_100g');
  if (kcal == null && kj != null) kcal = kj / 4.184;
  const protein = g('proteins_100g');
  const carbs = g('carbohydrates_100g');
  const fat = g('fat_100g');
  // Without per-100 g energy and macros the label data is incomplete — don't guess.
  if (kcal == null || protein == null || carbs == null || fat == null) return null;
  const name = [p.brands?.split(',')[0]?.trim(), p.product_name_en || p.product_name].filter(Boolean).join(' — ') || `Product ${code}`;
  const sq = Number(p.serving_quantity);
  return {
    id: `off-${code}`,
    name,
    per100: { kcal, protein, carbs, fat, fibre: g('fiber_100g') },
    servingG: Number.isFinite(sq) && sq > 0 ? sq : 0,
    servingLabel: p.serving_size ?? '',
    source: `Open Food Facts, barcode ${code} (label data, crowd-sourced)`,
    barcode: code,
    createdAt: Date.now(),
  };
}
