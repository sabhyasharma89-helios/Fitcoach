import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import { BODY_PARTS, BODY_PART_LABEL, type BodyPart } from '../data/catalog';
import { db } from '../db/db';
import { engineContext, planFor, previewFor, saveCheckIn } from '../db/repo';
import { backupDue } from '../db/backup';
import { defaultCheckIn } from '../engine/generate';
import { currentStreak } from '../engine/adherence';
import { calorieTarget, ageFrom, proteinTarget } from '../engine/nutrition';
import { stepTarget } from '../engine/steps';
import { movingAverage7, rapidLossWarning } from '../engine/weight';
import type { CheckIn, CheckInLocation, Feeling, PlannedSession, SessionRecord, SlotMinutes } from '../engine/types';
import { addDaysKey, formatDay, todayKey } from '../lib/date';
import { fmtInt, fmtKg } from '../lib/format';
import { Button, Card, H1, H2, Notice, Ring, Segmented } from '../components/ui';
import { targetText } from '../components/ExerciseCard';
import { sumNutrients } from '../food/foodMath';

export default function Today() {
  const today = todayKey();
  const ctx = useLiveQuery(() => engineContext(), []);
  const [editing, setEditing] = useState(false);
  if (!ctx) return null;
  const checkIn = ctx.checkIns.get(today);
  const doneToday = ctx.sessions.filter((s) => s.date === today);

  if ((!checkIn && !doneToday.length) || editing) {
    return <CheckInForm initial={checkIn ?? defaultCheckIn(ctx.settings.schedule, today)} onDone={() => setEditing(false)} />;
  }
  return <Dashboard ctx={ctx} onEditCheckIn={() => setEditing(true)} doneToday={doneToday} />;
}

const LOCATIONS: { value: CheckInLocation; label: string }[] = [
  { value: 'gym', label: 'Gym' },
  { value: 'home', label: 'Home' },
  { value: 'travel', label: 'Travelling' },
  { value: 'rest', label: 'Rest day' },
];
const MINUTES: { value: SlotMinutes; label: string }[] = [
  { value: 20, label: '20' },
  { value: 30, label: '30' },
  { value: 45, label: '45' },
  { value: 60, label: '60+' },
];
const FEELINGS: { value: Feeling; label: string }[] = [
  { value: 'fresh', label: 'Fresh' },
  { value: 'normal', label: 'Normal' },
  { value: 'tired', label: 'Tired' },
  { value: 'sore', label: 'Sore' },
  { value: 'pain', label: 'Pain' },
];

export function CheckInForm({ initial, onDone }: { initial: CheckIn; onDone?: () => void }) {
  const [ci, setCi] = useState<CheckIn>({ ...initial, auto: false });
  const parts = ci.feeling === 'pain' ? ci.painParts : ci.soreParts;
  const toggle = (p: BodyPart) => {
    const key = ci.feeling === 'pain' ? 'painParts' : 'soreParts';
    const cur = ci[key];
    setCi({ ...ci, [key]: cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p] });
  };
  const invalid = ci.feeling === 'pain' && ci.painParts.length === 0;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted">{formatDay(ci.date, 'EEEE d MMMM')}</p>
        <H1>Daily check-in</H1>
      </div>
      <section aria-labelledby="q-where" className="space-y-2">
        <h2 id="q-where" className="font-medium">
          Where are you training today?
        </h2>
        <Segmented name="Location" options={LOCATIONS} value={ci.location} onChange={(v) => setCi({ ...ci, location: v })} cols={2} />
      </section>
      {ci.location !== 'rest' && (
        <>
          <section className="space-y-2">
            <h2 className="font-medium">Time available (minutes)</h2>
            <Segmented name="Time available" options={MINUTES} value={ci.minutes} onChange={(v) => setCi({ ...ci, minutes: v })} />
          </section>
          <section className="space-y-2">
            <h2 className="font-medium">How do you feel?</h2>
            <Segmented name="Feeling" options={FEELINGS} value={ci.feeling} onChange={(v) => setCi({ ...ci, feeling: v })} cols={5} />
          </section>
          {(ci.feeling === 'sore' || ci.feeling === 'pain') && (
            <section className="space-y-2">
              <h2 className="font-medium">{ci.feeling === 'pain' ? 'Where is the pain?' : 'Where are you sore? (optional)'}</h2>
              <div className="flex flex-wrap gap-2">
                {BODY_PARTS.map((p) => (
                  <button
                    key={p}
                    aria-pressed={parts.includes(p)}
                    onClick={() => toggle(p)}
                    className={`min-h-11 rounded-full border px-3 text-sm ${parts.includes(p) ? 'border-accent bg-accent/15 text-accent' : 'border-line bg-surface-2'}`}
                  >
                    {BODY_PART_LABEL[p]}
                  </button>
                ))}
              </div>
              {ci.feeling === 'pain' && (
                <p className="text-xs text-muted">Exercises that load this area are removed and replaced with safe alternatives.</p>
              )}
            </section>
          )}
        </>
      )}
      <Button
        variant="primary"
        big
        className="w-full"
        disabled={invalid}
        onClick={async () => {
          await saveCheckIn(ci);
          onDone?.();
        }}
      >
        {ci.location === 'rest' ? 'Log rest day' : 'Build today’s session'}
      </Button>
    </div>
  );
}

function Dashboard({
  ctx,
  onEditCheckIn,
  doneToday,
}: {
  ctx: Awaited<ReturnType<typeof engineContext>>;
  onEditCheckIn: () => void;
  doneToday: SessionRecord[];
}) {
  const today = todayKey();
  const nav = useNavigate();
  const plan = useMemo(() => planFor(ctx, today), [ctx, today]);
  const data = useLiveQuery(async () => {
    const [weights, steps, food, missedNoReason, external, active] = await Promise.all([
      db.weights.orderBy('date').toArray(),
      db.steps.where('date').between(addDaysKey(today, -21), today, true, true).toArray(),
      db.foodLogs.where('date').equals(today).toArray(),
      db.missed.filter((m) => !m.reason).count(),
      db.externalWorkouts.where('date').equals(today).toArray(),
      db.activeEnergy.get(today),
    ]);
    return { weights, steps, food, missedNoReason, external, active };
  }, [today]);
  if (!data) return null;
  const s = ctx.settings;
  const pts = data.weights.map((w) => ({ date: w.date, value: w.kg }));
  const ma = movingAverage7(pts).slice(-30);
  const latest = data.weights[data.weights.length - 1];
  const kcalTarget = calorieTarget({ sex: s.sex, weightKg: s.calorieBasisKg ?? s.startWeightKg, heightCm: s.heightCm, age: ageFrom(s.birthYear, today), activity: s.activity });
  const protein = proteinTarget(s.goalWeightKg);
  const eaten = sumNutrients(data.food);
  const stepsMap = new Map(data.steps.map((x) => [x.date, x.count]));
  const st = stepTarget(stepsMap, today);
  const todaySteps = stepsMap.get(today) ?? 0;
  const sessionsByDate = new Map<string, SessionRecord[]>();
  for (const r of ctx.sessions) sessionsByDate.set(r.date, [...(sessionsByDate.get(r.date) ?? []), r]);
  const streak = currentStreak({ today, schedule: s.schedule, sessions: sessionsByDate, checkIns: ctx.checkIns });
  const warn = rapidLossWarning(pts, today);
  const next = nextSession(ctx, today);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-muted">{formatDay(today, 'EEEE d MMMM')}</p>
          <H1>Today</H1>
        </div>
        <Button variant="ghost" onClick={onEditCheckIn}>
          Change check-in
        </Button>
      </div>

      {backupDue(s.lastBackupAt) && (
        <Notice>
          It’s been a while since your last backup. <Link className="text-accent underline" to="/more">Back up now</Link> — your data lives only on this
          device.
        </Notice>
      )}
      {warn.warn && (
        <Notice tone="warn">
          You’ve lost more than 1 % of body weight per week for 2 weeks running. Faster isn’t better — eat a little more (aim for your calorie target) to
          protect muscle.
        </Notice>
      )}
      {data.missedNoReason > 0 && (
        <Notice>
          {data.missedNoReason} missed day{data.missedNoReason > 1 ? 's' : ''} without a reason. <Link className="text-accent underline" to="/progress#missed">Add a reason</Link> (optional).
        </Notice>
      )}

      <SessionCard plan={plan} done={doneToday} onStart={() => nav('/workout')} />
      {data.external.length > 0 && (
        <Card>
          <H2>From Health Connect</H2>
          {data.external.map((w) => (
            <p key={w.id} className="text-sm">
              {w.type} · {w.durationMin} min{w.kcal ? ` · ${fmtInt(w.kcal)} kcal` : ''}
            </p>
          ))}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card className="flex flex-col items-center gap-2">
          <Ring value={todaySteps} max={st.target} label={fmtInt(todaySteps)} sub={`of ${fmtInt(st.target)}`} />
          <span className="text-xs text-muted">Steps{data.active ? ` · ${fmtInt(data.active.kcal)} active kcal` : ''}</span>
        </Card>
        <Card className="space-y-2">
          <div>
            <div className="text-xs uppercase text-muted">Calories left</div>
            <div className="num text-2xl font-semibold">{fmtInt(kcalTarget - eaten.kcal)}</div>
            <div className="text-xs text-muted">
              {fmtInt(eaten.kcal)} / {fmtInt(kcalTarget)} kcal
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted">Protein left</div>
            <div className="num text-xl font-semibold">{fmtInt(Math.max(0, protein - eaten.protein))} g</div>
            <div className="text-xs text-muted">
              {fmtInt(eaten.protein)} / {protein} g
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <div className="text-xs uppercase text-muted">Weight trend</div>
          <div className="num text-xl font-semibold">{ma.length ? `${fmtKg(ma[ma.length - 1].value)} kg` : '—'}</div>
          <div className="text-xs text-muted">{latest ? `Last: ${fmtKg(latest.kg)} kg on ${formatDay(latest.date, 'd MMM')}` : 'No weigh-ins yet'}</div>
          {ma.length > 1 && (
            <div className="mt-2 h-12" aria-hidden>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ma}>
                  <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} hide />
                  <Line type="monotone" dataKey="value" stroke="var(--color-accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card>
          <div className="text-xs uppercase text-muted">Streak</div>
          <div className="num text-xl font-semibold">
            {streak} training day{streak === 1 ? '' : 's'}
          </div>
          <div className="mt-3 text-xs uppercase text-muted">Next session</div>
          <div className="text-sm">{next ? `${formatDay(next.date, 'EEE')}: ${next.title}` : '—'}</div>
        </Card>
      </div>
    </div>
  );
}

function nextSession(ctx: Awaited<ReturnType<typeof engineContext>>, today: string): PlannedSession | null {
  const dates = Array.from({ length: 7 }, (_, i) => addDaysKey(today, i + 1));
  const prev = previewFor(ctx, dates);
  for (const d of dates) {
    const p = prev.get(d);
    if (p && p.kind !== 'rest') return p;
  }
  return null;
}

function SessionCard({ plan, done, onStart }: { plan: PlannedSession; done: SessionRecord[]; onStart: () => void }) {
  if (done.length) {
    const last = done[done.length - 1];
    return (
      <Card className="border-accent/50">
        <div className="text-xs uppercase text-accent">{last.status === 'completed' ? 'Done ✓' : 'Partly done'}</div>
        <h2 className="text-lg font-semibold">{last.plan.title}</h2>
        <p className="text-sm text-muted">
          {last.durationMin} min · {last.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0)} sets logged
        </p>
      </Card>
    );
  }
  if (plan.kind === 'rest') {
    return (
      <Card>
        <div className="text-xs uppercase text-muted">Rest day</div>
        <p className="mt-1 text-sm">{plan.notes[0]}</p>
      </Card>
    );
  }
  return (
    <Card>
      <div className="text-xs uppercase text-muted">
        Today · {plan.location === 'travel' ? 'Hotel room' : plan.location === 'gym' ? 'Gym' : 'Home'} · ~{plan.estimatedMin} min
        {plan.deload ? ' · Deload' : ''}
      </div>
      <h2 className="text-lg font-semibold">{plan.title}</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {plan.main.map((e) => (
          <li key={e.key} className="flex justify-between gap-2">
            <span>{e.group && plan.format !== 'straight' ? `${e.group === 'circuit' ? '•' : e.group} ` : ''}{e.name}</span>
            <span className="num shrink-0 text-muted">{targetText(e)}</span>
          </li>
        ))}
      </ul>
      {plan.notes.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-muted">
          {plan.notes.map((n) => (
            <li key={n}>• {n}</li>
          ))}
        </ul>
      )}
      <Button variant="primary" big className="mt-3 w-full" onClick={onStart}>
        Start workout
      </Button>
    </Card>
  );
}
