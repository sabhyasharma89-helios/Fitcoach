import { describe, expect, it } from 'vitest';
import { BUNDLED_FOODS, searchFoods } from './foods';
import { offToFood, lookupBarcode } from './off';
import { scale, sumNutrients } from './foodMath';

describe('bundled Indian foods dataset', () => {
  it('has ~150+ items, unique ids, and every item cites a source', () => {
    expect(BUNDLED_FOODS.length).toBeGreaterThanOrEqual(150);
    expect(new Set(BUNDLED_FOODS.map((f) => f.id)).size).toBe(BUNDLED_FOODS.length);
    for (const f of BUNDLED_FOODS) {
      expect(f.source, f.name).toMatch(/IFCT|INDB|CoFID|USDA/);
      for (const k of ['kcal', 'protein', 'carbs', 'fat'] as const) expect(typeof f.per100[k], `${f.name} ${k}`).toBe('number');
    }
  });

  it('energy is consistent with macros (Atwater) for every item', () => {
    for (const f of BUNDLED_FOODS) {
      const p = f.per100;
      const base = 4 * p.carbs + 4 * p.protein + 9 * p.fat;
      const withFibre = base + 2 * (p.fibre ?? 0);
      const ok = [base, withFibre].some((x) => Math.abs(x - p.kcal) <= 0.12 * p.kcal + 10.5);
      expect(ok, `${f.name}: ${p.kcal} vs ${base.toFixed(0)}/${withFibre.toFixed(0)}`).toBe(true);
    }
  });

  it('search finds common foods', () => {
    expect(searchFoods('roti', BUNDLED_FOODS)[0].name).toMatch(/Chapati/);
    expect(searchFoods('dal makh', BUNDLED_FOODS)[0].name).toBe('Dal makhani');
    expect(searchFoods('paneer', BUNDLED_FOODS).length).toBeGreaterThan(5);
  });

  it('scales per-100 g values', () => {
    const roti = BUNDLED_FOODS.find((f) => f.id === 'indb-ASC096')!;
    const n = scale(roti.per100, 72);
    expect(n.kcal).toBeCloseTo(roti.per100.kcal * 0.72, 5);
    expect(sumNutrients([n, n]).kcal).toBeCloseTo(roti.per100.kcal * 1.44, 5);
  });
});

describe('Open Food Facts', () => {
  it('maps a product with full nutrition', () => {
    const f = offToFood('8901058000290', {
      product_name: 'Instant noodles',
      brands: 'Maggi,Nestle',
      serving_quantity: 70,
      serving_size: '70 g',
      nutriments: { 'energy-kcal_100g': 427, proteins_100g: 8.2, carbohydrates_100g: 61.6, fat_100g: 16.1, fiber_100g: 2 },
    })!;
    expect(f).toMatchObject({ id: 'off-8901058000290', name: 'Maggi — Instant noodles', servingG: 70, barcode: '8901058000290' });
    expect(f.per100.kcal).toBe(427);
    expect(f.source).toMatch(/Open Food Facts/);
  });

  it('converts kJ when kcal is missing and refuses incomplete labels', () => {
    expect(offToFood('1', { nutriments: { 'energy-kj_100g': 418.4, proteins_100g: 1, carbohydrates_100g: 20, fat_100g: 1 } })!.per100.kcal).toBeCloseTo(100, 5);
    expect(offToFood('1', { nutriments: { proteins_100g: 1 } })).toBeNull();
  });

  it('returns null for unknown barcodes', async () => {
    const fake = (async () => new Response(JSON.stringify({ status: 0 }), { status: 200 })) as unknown as typeof fetch;
    expect(await lookupBarcode('123', fake)).toBeNull();
  });
});
