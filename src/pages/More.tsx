import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Settings } from '../db/db';
import { exportBackup, importBackup, backupDue } from '../db/backup';
import { ACTIVITY_LEVELS, ageFrom, calorieTarget, mifflinStJeor, activityFactor, proteinTarget, FIBRE_TARGET_G, type ActivityId } from '../engine/nutrition';
import type { DayType, SlotMinutes } from '../engine/types';
import { todayKey, WEEKDAYS } from '../lib/date';
import { fmtInt } from '../lib/format';
import { EXERCISE_DB_SOURCE } from '../data/exerciseDb';
import { FOOD_SOURCES } from '../food/foods';
import { Button, Card, Field, H1, H2, Notice, Segmented, inputCls } from '../components/ui';
import { getTheme, setTheme, type Theme } from '../lib/theme';
import { connectHealth, isNative, openHealthSettings } from '../health/health';

export default function More() {
  const s = useLiveQuery(() => db.settings.get('me'), []);
  if (!s) return null;
  return (
    <div className="space-y-4">
      <H1>More</H1>
      <Profile s={s} />
      <Targets s={s} />
      <Schedule s={s} />
      {isNative() ? <HealthConnect s={s} /> : <WebHealthNote />}
      <Appearance />
      <Backup s={s} />
      <About />
    </div>
  );
}

function NumField({ label, value, onSave, step = 1, hint }: { label: string; value: number; onSave: (v: number) => void; step?: number; hint?: string }) {
  const [v, setV] = useState(String(value));
  return (
    <Field label={label} hint={hint}>
      <input
        className={inputCls}
        type="number"
        inputMode="decimal"
        step={step}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const n = Number(v);
          if (Number.isFinite(n) && n > 0) onSave(n);
          else setV(String(value));
        }}
      />
    </Field>
  );
}

const upd = (patch: Partial<Settings>) => db.settings.update('me', patch);

function Profile({ s }: { s: Settings }) {
  return (
    <Card>
      <H2>Profile</H2>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sex (for the calorie formula)">
          <select className={inputCls} value={s.sex} onChange={(e) => upd({ sex: e.target.value as Settings['sex'] })}>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </Field>
        <NumField label="Birth year" value={s.birthYear} onSave={(v) => upd({ birthYear: Math.round(v) })} hint={`Age ${ageFrom(s.birthYear, todayKey())}`} />
        <NumField label="Height (cm)" value={s.heightCm} onSave={(v) => upd({ heightCm: v })} />
        <NumField label="Start weight (kg)" value={s.startWeightKg} step={0.1} onSave={(v) => upd({ startWeightKg: v })} />
        <NumField label="Goal weight (kg)" value={s.goalWeightKg} step={0.1} onSave={(v) => upd({ goalWeightKg: v })} />
        <NumField label="Water target (ml)" value={s.waterTargetMl} step={250} onSave={(v) => upd({ waterTargetMl: v })} />
      </div>
      <Field label="Programme start date" hint="Week numbers and deload weeks (every 6th week) count from here.">
        <input className={inputCls} type="date" value={s.programStart} onChange={(e) => e.target.value && upd({ programStart: e.target.value })} />
      </Field>
    </Card>
  );
}

function Targets({ s }: { s: Settings }) {
  const today = todayKey();
  const basis = s.calorieBasisKg ?? s.startWeightKg;
  const bmr = mifflinStJeor(s.sex, basis, s.heightCm, ageFrom(s.birthYear, today));
  const target = calorieTarget({ sex: s.sex, weightKg: basis, heightCm: s.heightCm, age: ageFrom(s.birthYear, today), activity: s.activity });
  return (
    <Card>
      <H2>Food targets</H2>
      <Field label="Activity level">
        <select className={inputCls} value={s.activity} onChange={(e) => upd({ activity: e.target.value as ActivityId })}>
          {ACTIVITY_LEVELS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label} ×{a.factor}
            </option>
          ))}
        </select>
      </Field>
      <ul className="mt-3 space-y-1 text-sm">
        <li>
          Calories: <b className="num">{fmtInt(target)} kcal</b>{' '}
          <span className="text-muted">
            = BMR {fmtInt(bmr)} × {activityFactor(s.activity)} − 500 (never below 1,500). Based on {basis.toFixed(1)} kg; recalculated each 2 kg change.
          </span>
        </li>
        <li>
          Protein: <b className="num">{proteinTarget(s.goalWeightKg)} g</b> <span className="text-muted">= 1.6 g × goal weight {s.goalWeightKg} kg</span>
        </li>
        <li>
          Fibre: <b className="num">{FIBRE_TARGET_G} g</b>
        </li>
      </ul>
      <Button className="mt-3" onClick={() => upd({ calorieBasisKg: null })}>
        Recalculate from my latest weight trend
      </Button>
    </Card>
  );
}

const TYPE_LABEL: Record<DayType, string> = { strength: 'Strength', cardio: 'Cardio', rest: 'Rest' };

function Schedule({ s }: { s: Settings }) {
  const sch = s.schedule;
  const set = (patch: Partial<Settings['schedule']>) => upd({ schedule: { ...sch, ...patch } });
  return (
    <Card>
      <H2>Weekly schedule</H2>
      <p className="mb-2 text-xs text-muted">Used when you skip the check-in. Strength days take the next session in the rotation (Push A → Pull A → Legs A → Push B → Pull B + Legs B).</p>
      <div className="space-y-2">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className="grid grid-cols-[3rem_1fr_1fr] items-center gap-2">
            <span className="text-sm">{w}</span>
            <select
              aria-label={`${w} type`}
              className={inputCls}
              value={sch.dayTypes[i]}
              onChange={(e) => set({ dayTypes: sch.dayTypes.map((t, j) => (j === i ? (e.target.value as DayType) : t)) })}
            >
              {(['strength', 'cardio', 'rest'] as DayType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <select
              aria-label={`${w} usual place`}
              className={inputCls}
              value={sch.defaultLocation[i]}
              onChange={(e) => set({ defaultLocation: sch.defaultLocation.map((t, j) => (j === i ? (e.target.value as 'gym' | 'home') : t)) })}
            >
              <option value="gym">Gym</option>
              <option value="home">Home</option>
            </select>
          </div>
        ))}
      </div>
      <Field label="Usual time available">
        <select className={inputCls} value={sch.defaultMinutes} onChange={(e) => set({ defaultMinutes: Number(e.target.value) as SlotMinutes })}>
          {[20, 30, 45, 60].map((m) => (
            <option key={m} value={m}>
              {m === 60 ? '60+ min' : `${m} min`}
            </option>
          ))}
        </select>
      </Field>
    </Card>
  );
}

function HealthConnect({ s }: { s: Settings }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setMsg(null);
    try {
      setMsg(await fn());
    } catch (e) {
      setMsg(`Something went wrong: ${String((e as Error)?.message ?? e)} Try "Open Health Connect permissions" below.`);
    } finally {
      setBusy(false);
      setStep(null);
    }
  };
  return (
    <Card>
      <H2>Samsung Health · Health Connect</H2>
      <p className="mb-3 text-sm text-muted">
        FitOS reads steps, weight, exercise sessions and active calories from Health Connect (where Samsung Health shares them). It never writes anything.
        {s.lastHealthSyncAt && ` Last sync: ${new Date(s.lastHealthSyncAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.`}
      </p>
      <div className="grid gap-2">
        <Button variant="primary" disabled={busy} onClick={() => run(() => connectHealth(setStep))}>
          {busy ? 'Working…' : s.healthConnectEnabled ? 'Sync now' : 'Connect Health Connect'}
        </Button>
        <Button onClick={() => run(async () => (await openHealthSettings(), 'In Health Connect: App permissions › FitOS › allow everything, then come back here.'))}>
          Open Health Connect permissions
        </Button>
      </div>
      {step && <p className="mt-2 text-sm text-muted">{step}</p>}
      {msg && (
        <div className="mt-2">
          <Notice>{msg}</Notice>
        </div>
      )}
    </Card>
  );
}

function WebHealthNote() {
  return (
    <Card>
      <H2>Steps from Samsung Health</H2>
      <p className="text-sm text-muted">
        A website can’t read Health Connect. In this web version, type steps in or import the Samsung Health CSV on the Log › Steps tab. Install the Android app
        (see README) for automatic syncing.
      </p>
    </Card>
  );
}

function Appearance() {
  const [t, setT] = useState<Theme>(getTheme());
  return (
    <Card>
      <H2>Appearance</H2>
      <Segmented
        name="Theme"
        options={[
          { value: 'dark', label: 'Dark' },
          { value: 'light', label: 'Light' },
        ]}
        value={t}
        onChange={(v) => {
          setT(v);
          setTheme(v);
        }}
      />
    </Card>
  );
}

function Backup({ s }: { s: Settings }) {
  const [msg, setMsg] = useState<string | null>(null);
  const doExport = async () => {
    const data = await exportBackup(db);
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const name = `fitos-backup-${todayKey()}.json`;
    const file = new File([blob], name, { type: 'application/json' });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'FitOS backup' });
      } catch {
        return; // cancelled
      }
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
    await upd({ lastBackupAt: Date.now() });
    setMsg(`Backup saved (${name}). Keep it somewhere safe, e.g. Google Drive.`);
  };
  return (
    <Card>
      <H2>Backup</H2>
      <p className="mb-2 text-sm text-muted">
        All your data lives only on this device. {s.lastBackupAt ? `Last backup: ${new Date(s.lastBackupAt).toLocaleDateString('en-IN')}.` : 'No backup yet.'}
      </p>
      {backupDue(s.lastBackupAt) && <Notice tone="warn">Time for a backup (every 14 days).</Notice>}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button variant="primary" onClick={doExport}>
          Export backup
        </Button>
        <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface-2 px-4">
          Restore…
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (!confirm('Restoring replaces ALL data in FitOS with the backup. Continue?')) return;
              try {
                await importBackup(db, JSON.parse(await f.text()));
                setMsg('Backup restored.');
              } catch (err) {
                setMsg(`Restore failed — nothing was changed. ${(err as Error).message}`);
              }
            }}
          />
        </label>
      </div>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
      <Button
        variant="danger"
        className="mt-4 w-full"
        onClick={async () => {
          if (!confirm('Delete ALL FitOS data on this device? Export a backup first if you might want it.')) return;
          await db.delete();
          location.reload();
        }}
      >
        Delete all data
      </Button>
    </Card>
  );
}

function About() {
  return (
    <Card>
      <H2>About</H2>
      <ul className="space-y-2 text-sm text-muted">
        <li>
          Exercise pictures and instructions:{' '}
          <a className="text-accent underline" href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noreferrer">
            free-exercise-db
          </a>{' '}
          by yuhonas, released under the Unlicense ({EXERCISE_DB_SOURCE}).
        </li>
        <li>
          Food values: {FOOD_SOURCES.join(' · ')}. Every food shows its exact source when you add it. Packaged foods:{' '}
          <a className="text-accent underline" href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">
            Open Food Facts
          </a>{' '}
          (ODbL).
        </li>
        <li>
          Calorie target: Mifflin-St Jeor equation. Waist threshold 90 cm for Indian men: Indian consensus guidelines for abdominal obesity (Misra et al., JAPI 2009).
        </li>
        <li>
          <Link to="/library" className="text-accent underline">
            Exercise library
          </Link>{' '}
          ·{' '}
          <a className="text-accent underline" href={`${import.meta.env.BASE_URL}privacy.html`}>
            Privacy policy
          </a>
        </li>
        <li>FitOS is general guidance, not medical advice. Check with your doctor before starting.</li>
      </ul>
    </Card>
  );
}
