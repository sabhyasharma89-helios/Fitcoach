export type Sex = 'male' | 'female';

export const ACTIVITY_LEVELS = [
  { id: 'sedentary', factor: 1.2, label: 'Sedentary (desk job, little exercise)' },
  { id: 'light', factor: 1.375, label: 'Lightly active (exercise 1–3 days/week)' },
  { id: 'moderate', factor: 1.55, label: 'Moderately active (exercise 3–5 days/week)' },
  { id: 'very', factor: 1.725, label: 'Very active (hard exercise 6–7 days/week)' },
  { id: 'extra', factor: 1.9, label: 'Extra active (physical job + training)' },
] as const;
export type ActivityId = (typeof ACTIVITY_LEVELS)[number]['id'];

export const CALORIE_FLOOR = 1500;
export const DEFICIT = 500;
export const RECALC_EVERY_KG = 2;
export const PROTEIN_G_PER_KG_GOAL = 1.6;
export const FIBRE_TARGET_G = 30;

/** Mifflin-St Jeor resting energy (kcal/day). */
export function mifflinStJeor(sex: Sex, weightKg: number, heightCm: number, ageYears: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + (sex === 'male' ? 5 : -161);
}

export function activityFactor(id: ActivityId): number {
  return ACTIVITY_LEVELS.find((a) => a.id === id)!.factor;
}

/** BMR × activity − 500 kcal, never below 1,500 kcal. */
export function calorieTarget(p: { sex: Sex; weightKg: number; heightCm: number; age: number; activity: ActivityId }): number {
  const tdee = mifflinStJeor(p.sex, p.weightKg, p.heightCm, p.age) * activityFactor(p.activity);
  return Math.max(CALORIE_FLOOR, Math.round(tdee - DEFICIT));
}

/** The calorie target is recalculated each time your weight moves 2 kg from the weight it was based on. */
export function nextCalorieBasis(basisKg: number | null, currentKg: number | null): number | null {
  if (currentKg == null) return basisKg;
  if (basisKg == null) return currentKg;
  return Math.abs(currentKg - basisKg) >= RECALC_EVERY_KG ? currentKg : basisKg;
}

export function proteinTarget(goalWeightKg: number): number {
  return Math.round(PROTEIN_G_PER_KG_GOAL * goalWeightKg);
}

export function ageFrom(birthYear: number, today: string): number {
  return Number(today.slice(0, 4)) - birthYear;
}
