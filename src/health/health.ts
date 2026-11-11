import { Capacitor } from '@capacitor/core';
// Imported directly. Never return this object from an async function or resolve a promise with it:
// Capacitor plugin proxies answer *any* property (including `then`), so a promise treats the plugin
// as a thenable, calls a native "then" method that never replies, and hangs forever.
import { Health, type AuthorizationStatus, type HealthDataType } from '@capgo/capacitor-health';
import { db } from '../db/db';
import { addDaysKey, dayKey, startOfDayISO, todayKey } from '../lib/date';

/** Health Connect is only reachable from the Android app; the PWA hides it. */
export const isNative = () => Capacitor.isNativePlatform();

/** Only the Health Connect data FitOS actually reads (matches the permissions in AndroidManifest.xml). */
export const HEALTH_READ: HealthDataType[] = ['steps', 'weight', 'workouts', 'calories'];

/** Reject if a native call doesn't answer in time, so the UI never waits forever. */
export function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${what} did not respond within ${Math.round(ms / 1000)} s.`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export async function healthAvailability(): Promise<{ available: boolean; reason?: string }> {
  if (!isNative()) return { available: false, reason: 'Health Connect needs the Android app.' };
  return withTimeout(Health.isAvailable(), 10_000, 'Health Connect');
}

/** What FitOS is currently allowed to read (no dialog). */
export async function checkHealthAccess(): Promise<AuthorizationStatus> {
  return withTimeout(Health.checkAuthorization({ read: HEALTH_READ, write: [] }), 15_000, 'Health Connect');
}

/** Opens the Health Connect permission screen if anything is still missing. */
export async function requestHealthAccess(): Promise<AuthorizationStatus> {
  // generous: this waits while you tap through the permission screen
  const status = await withTimeout(Health.requestAuthorization({ read: HEALTH_READ, write: [] }), 180_000, 'The Health Connect permission screen');
  await db.settings.update('me', { healthConnectEnabled: status.readAuthorized.length > 0 });
  return status;
}

export async function openHealthSettings() {
  await withTimeout(Health.openHealthConnectSettings(), 10_000, 'Health Connect settings');
}

/** Connect flow with a visible step-by-step status. */
export async function connectHealth(onStep: (msg: string) => void): Promise<string> {
  onStep('Checking Health Connect is available…');
  const a = await healthAvailability();
  if (!a.available) return `Health Connect is not available: ${a.reason ?? 'unknown reason'}.`;
  onStep('Opening the Health Connect permission screen…');
  const st = await requestHealthAccess();
  if (!st.readAuthorized.length) {
    return 'No access was granted. Tap "Open Health Connect permissions", choose FitOS, and turn on Steps, Weight, Exercise and Active calories burned. Then come back and tap Sync now.';
  }
  onStep('Syncing the last 30 days…');
  const r = await syncHealth();
  const denied = st.readDenied.length ? ` Not allowed yet: ${st.readDenied.join(', ')}.` : '';
  return `Connected. Synced ${r.stepsDays} days of steps, ${r.weights} weights, ${r.workouts} exercise sessions.${denied}${r.errors.length ? ' ' + r.errors.join(' ') : ''}`;
}

export interface SyncResult {
  stepsDays: number;
  weights: number;
  workouts: number;
  errors: string[];
}

/** Today plus the last 30 days: daily step totals (aggregated), weights, exercise sessions, active kcal. */
export async function syncHealth(days = 30): Promise<SyncResult> {
  const H = Health;
  const today = todayKey();
  const from = addDaysKey(today, -days);
  const startDate = startOfDayISO(from);
  const endDate = new Date().toISOString();
  const res: SyncResult = { stepsDays: 0, weights: 0, workouts: 0, errors: [] };

  try {
    const { samples } = await withTimeout(H.queryAggregated({ dataType: 'steps', startDate, endDate, bucket: 'day', aggregation: 'sum' }), 30_000, 'Health Connect');
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
    const { samples } = await withTimeout(H.readSamples({ dataType: 'weight', startDate, endDate, limit: 500, ascending: true }), 30_000, 'Health Connect');
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
    const { workouts } = await withTimeout(H.queryWorkouts({ startDate, endDate, limit: 200 }), 30_000, 'Health Connect');
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
    const { samples } = await withTimeout(H.queryAggregated({ dataType: 'calories', startDate, endDate, bucket: 'day', aggregation: 'sum' }), 30_000, 'Health Connect');
    await db.activeEnergy.bulkPut(samples.map((s) => ({ date: dayKey(new Date(s.startDate)), kcal: Math.round(s.value) })));
  } catch (e) {
    res.errors.push(`Active calories: ${String((e as Error)?.message ?? e)}`);
  }

  await db.settings.update('me', { lastHealthSyncAt: Date.now() });
  return res;
}

/**
 * Called on app open / return to the app: sync quietly if FitOS has access — including access
 * you granted directly in Health Connect's own settings.
 */
export async function autoSyncHealth() {
  if (!isNative()) return;
  try {
    const st = await checkHealthAccess();
    const enabled = st.readAuthorized.length > 0;
    const s = await db.settings.get('me');
    if (s && s.healthConnectEnabled !== enabled) await db.settings.update('me', { healthConnectEnabled: enabled });
    if (enabled) await syncHealth();
  } catch {
    /* shown on the Settings screen when the user syncs manually */
  }
}
