import { describe, expect, it, vi } from 'vitest';

/**
 * Regression test: Capacitor plugin proxies answer *any* property, including `then`.
 * If FitOS ever resolves a promise with the plugin object, the promise calls `plugin.then(...)`,
 * which goes to native code that never replies, and the app hangs (the "Connect Health Connect"
 * button stayed grey forever). This fake behaves the same way: unknown methods never settle.
 */
const calls: string[] = [];
const fakePlugin = new Proxy(
  {},
  {
    get(_t, prop: string) {
      if (prop === '$$typeof') return undefined;
      return (..._args: unknown[]) => {
        calls.push(prop);
        if (prop === 'isAvailable') return Promise.resolve({ available: true, platform: 'android' });
        if (prop === 'checkAuthorization' || prop === 'requestAuthorization')
          return Promise.resolve({ readAuthorized: ['steps', 'weight'], readDenied: ['workouts', 'calories'], writeAuthorized: [], writeDenied: [] });
        if (prop === 'queryAggregated' || prop === 'readSamples') return Promise.resolve({ samples: [] });
        if (prop === 'queryWorkouts') return Promise.resolve({ workouts: [] });
        if (prop === 'openHealthConnectSettings') return Promise.resolve();
        return new Promise(() => {}); // like a native method that never answers (e.g. "then")
      };
    },
  },
);

vi.mock('@capgo/capacitor-health', () => ({ Health: fakePlugin }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));

describe('Health Connect bridge', () => {
  it('connects without ever treating the plugin as a promise', async () => {
    const { db, ensureSeeded } = await import('../db/db');
    await ensureSeeded(db, '2026-11-11');
    const { connectHealth } = await import('./health');
    const steps: string[] = [];
    const msg = await connectHealth((s) => steps.push(s));
    expect(msg).toMatch(/^Connected\./);
    expect(msg).toMatch(/Not allowed yet: workouts, calories/);
    expect(steps.length).toBeGreaterThanOrEqual(2);
    expect(calls).not.toContain('then');
    expect((await db.settings.get('me'))?.healthConnectEnabled).toBe(true);
  });

  it('autoSync picks up access granted directly in Health Connect', async () => {
    const { db } = await import('../db/db');
    await db.settings.update('me', { healthConnectEnabled: false });
    const { autoSyncHealth } = await import('./health');
    await autoSyncHealth();
    expect((await db.settings.get('me'))?.healthConnectEnabled).toBe(true);
    expect(calls).not.toContain('then');
  });

  it('times out instead of waiting forever', async () => {
    const { withTimeout } = await import('./health');
    await expect(withTimeout(new Promise(() => {}), 20, 'Test')).rejects.toThrow(/did not respond/);
  });
});
