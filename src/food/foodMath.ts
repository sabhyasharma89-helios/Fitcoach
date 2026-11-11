import type { Nutrients } from '../db/db';

export function sumNutrients(items: Nutrients[]): Nutrients {
  return items.reduce<Nutrients>(
    (a, x) => ({
      kcal: a.kcal + x.kcal,
      protein: a.protein + x.protein,
      carbs: a.carbs + x.carbs,
      fat: a.fat + x.fat,
      fibre: (a.fibre ?? 0) + (x.fibre ?? 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 },
  );
}

/** Scale per-100 g values to a portion in grams. */
export function scale(per100: Nutrients, grams: number): Nutrients {
  const f = grams / 100;
  return {
    kcal: per100.kcal * f,
    protein: per100.protein * f,
    carbs: per100.carbs * f,
    fat: per100.fat * f,
    fibre: per100.fibre == null ? null : per100.fibre * f,
  };
}
