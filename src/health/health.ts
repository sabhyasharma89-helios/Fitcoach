import { Capacitor } from '@capacitor/core';
import type { HealthDataType } from '@capgo/capacitor-health';
import { db } from '../db/db';
import { addDaysKey, dayKey, startOfDayISO, todayKey } from '../lib/date';

/** Health Connect is only reachable from the Android app; the PWA hides it. */
export const isNative = () => Capacitor.isNativePlatform();

/** Only the Health Connect data FitOS actually reads (matches the permissions in AndroidManifest.xml). */
export const HEALTH_READ: HealthDataType[] = ['steps', 'weight', 'workouts', 'calories'];

async function plugin() {
  const { Health } = await import('@capgo/capacitor-health');
  return Health;
}

export async function healthAvailability(): Promise<{ available: boolean; reason?: string }> {
  if (!isNative()) return { available: false, reason: 'Health Connect needs the Android app.' };
  const H = await plugin();
  return H.isAvailable();
}

export async function requestHealthAccess() {
  const H = await plugin();
  const status = await H.requestAuthorization({ read: HEALTH_READ, write: [] });
  await db.settings.update('me', { healthConnectEnabled: status.readAuthorized.length > 0 });
  return status;
}

export async function openHealthSettings() {
  const H = await plugin();
  await H.openHealthConnectSettings();
}

export interface SyncResult {
  stepsDays: number;
  weights: number;
  workouts: number;
  errors: string[];
}

/** Today plus the last 30 days: daily step totals (aggregated), weights, exercise sessions, active kcal. */
export async function syncHealth(days = 30): Promise<SyncResult> {
  const H = await plugin();
  const today = todayKey();
  const from = addDaysKey(today, -days);
  const startDate = startOfDayISO(from);
  const endDate = new Date().toISOString();
  const res: SyncResult = { stepsDays: 0, weights: 0, workouts: 0, errors: [] };

  try {
    const { samples } = await H.queryAggregated({ dataType: 'steps', startDate, endDate, bucket: 'day', aggregation: 'sum' });
    const rows = samples.map((s) => ({ date: dayKey(new Date(s.startDate)), count: Math.round(s.value), source: 'healthconnect' as const }));
    await db.transaction('rw', db.steps, async () => {
      for (const r of rows) {
        const existing = await db.steps.get(r.date);
        // Health Connect is the source of truth for steps unless you typed a number for that day
        if (!existing || existing.source !== 'manual') await db.steps.put(r);
      }
    });
    res.stepsDays = rows.length;
  } catch (e) {
    res.errors.push(`Steps: ${String((e as Error)?.message ?? e)}`);
  }

  try {
    const { samples } = await H.readSamples({ dataType: 'weight', startDate, endDate, limit: 500, ascending: true });
    await db.transaction('rw', db.weights, async () => {
      for (const s of samples) {
        const date = dayKey(new Date(s.startDate));
        const existing = await db.weights.get(date);
        if (existing?.source === 'manual') continue; // your own weigh-in wins
        await db.weights.put({ date, kg: Math.round(s.value * 10) / 10, source: 'healthconnect', at: new Date(s.startDate).getTime() });
        res.weights++;
      }
    });
  } catch (e) {
    res.errors.push(`Weight: ${String((e as Error)?.message ?? e)}`);
  }

  try {
    const { workouts } = await H.queryWorkouts({ startDate, endDate, limit: 200 });
    await db.externalWorkouts.bulkPut(
      workouts.map((w) => ({
        id: w.platformId ?? `${w.startDate}-${w.workoutType}`,
        date: dayKey(new Date(w.startDate)),
        type: w.workoutType,
        durationMin: Math.round(w.duration / 60),
        kcal: w.totalEnergyBurned != null ? Math.round(w.totalEnergyBurned) : null,
        sourceName: w.sourceName ?? null,
      })),
    );
    res.workouts = workouts.length;
  } catch (e) {
    res.errors.push(`Exercise: ${String((e as Error)?.message ?? e)}`);
  }

  try {
    const { samples } = await H.queryAggregated({ dataType: 'calories', startDate, endDate, bucket: 'day', aggregation: 'sum' });
    await db.activeEnergy.bulkPut(samples.map((s) => ({ date: dayKey(new Date(s.startDate)), kcal: Math.round(s.value) })));
  } catch (e) {
    res.errors.push(`Active calories: ${String((e as Error)?.message ?? e)}`);
  }

  await db.settings.update('me', { lastHealthSyncAt: Date.now() });
  return res;
}

/** Called on app open: sync quietly if the user has connected Health Connect. */
export async function autoSyncHealth() {
  if (!isNative()) return;
  const s = await db.settings.get('me');
  if (!s?.healthConnectEnabled) return;
  try {
    await syncHealth();
  } catch {
    /* shown on the Settings screen when the user syncs manually */
  }
}
