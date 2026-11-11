/** Weight and waist: 1 decimal. kcal and steps: whole numbers (Indian digit grouping). */
export const fmtKg = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? '—' : n.toFixed(1));
export const fmtCm = fmtKg;
export const fmtInt = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? '—' : Math.round(n).toLocaleString('en-IN');
export const fmtG = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? '—' : `${Math.round(n)} g`);
export const round1 = (n: number) => Math.round(n * 10) / 10;
export const roundTo = (n: number, step: number) => Math.round(n / step) * step;

export function fmtRest(sec: number): string {
  if (!sec) return '—';
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} min ${s} s` : `${m} min`;
}

export function fmtClock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
