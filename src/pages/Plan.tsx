import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { db } from '../db/db';
import { engineContext, planFor, previewFor } from '../db/repo';
import { dayStatus, type DayStatus } from '../engine/adherence';
import type { PlannedSession, SessionRecord } from '../engine/types';
import { addDaysKey, dayKey, formatDay, rangeKeys, todayKey, weekdayIndex, WEEKDAYS } from '../lib/date';
import { Button, Card, H1, Sheet, inputCls } from '../components/ui';
import { targetText } from '../components/ExerciseCard';

const STATUS_STYLE: Record<DayStatus, string> = {
  completed: 'bg-accent text-accent-ink',
  partial: 'bg-partial/80 text-bg',
  missed: 'bg-bad/25 text-bad border border-bad/50',
  rest: 'bg-surface-2 text-muted',
  planned: 'border border-line text-ink',
  today: 'border-2 border-accent text-accent',
};
const STATUS_LABEL: Record<DayStatus, string> = {
  completed: 'Completed',
  partial: 'Partial',
  missed: 'Missed',
  rest: 'Rest',
  planned: 'Planned',
  today: 'Today',
};

export default function Plan() {
  const today = todayKey();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [sel, setSel] = useState<string | null>(null);
  const ctx = useLiveQuery(() => engineContext(), []);
  const extra = useLiveQuery(async () => ({ external: await db.externalWorkouts.toArray(), missed: await db.missed.toArray() }), []);

  const first = `${month}-01`;
  const last = dayKey(endOfMonth(parseISO(first)));
  const days = rangeKeys(first, last);
  const sessionsByDate = useMemo(() => {
    const m = new Map<string, SessionRecord[]>();
    for (const s of ctx?.sessions ?? []) m.set(s.date, [...(m.get(s.date) ?? []), s]);
    return m;
  }, [ctx]);
  const futureDates = useMemo(() => rangeKeys(addDaysKey(today, 1), addDaysKey(last > today ? last : today, 0)), [today, last]);
  const preview = useMemo(() => (ctx ? previewFor(ctx, futureDates.length ? futureDates : [addDaysKey(today, 1)]) : new Map()), [ctx, futureDates, today]);
  if (!ctx || !extra) return null;
  const externalDates = new Set(extra.external.map((w) => w.date));

  const status = (d: string) => dayStatus({ date: d, today, schedule: ctx.settings.schedule, sessions: sessionsByDate, checkIns: ctx.checkIns, externalDates });
  const lead = weekdayIndex(first);
  const shift = (n: number) => setMonth(format(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + n, 1), 'yyyy-MM'));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <H1>Plan</H1>
        <Link to="/library" className="text-sm text-accent">
          Exercise library
        </Link>
      </div>
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <Button variant="ghost" aria-label="Previous month" onClick={() => shift(-1)}>
            ‹
          </Button>
          <h2 className="font-semibold">{format(startOfMonth(parseISO(first)), 'MMMM yyyy')}</h2>
          <Button variant="ghost" aria-label="Next month" onClick={() => shift(1)}>
            ›
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
          {WEEKDAYS.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: lead }).map((_, i) => (
            <div key={`x${i}`} />
          ))}
          {days.map((d) => {
            const st = status(d);
            return (
              <button
                key={d}
                onClick={() => setSel(d)}
                aria-label={`${formatDay(d, 'EEEE d MMMM')}: ${STATUS_LABEL[st]}`}
                className={`num aspect-square rounded-lg text-sm font-medium ${STATUS_STYLE[st]}`}
              >
                {Number(d.slice(8))}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
          {(['completed', 'partial', 'missed', 'rest', 'planned'] as DayStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className={`inline-block h-3 w-3 rounded ${STATUS_STYLE[s]}`} /> {STATUS_LABEL[s]}
            </span>
          ))}
        </div>
      </Card>

      <WeekList ctx={ctx} preview={preview} today={today} />

      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel ? formatDay(sel, 'EEEE d MMMM') : ''}>
        {sel && (
          <DayDetail
            date={sel}
            status={status(sel)}
            sessions={sessionsByDate.get(sel) ?? []}
            planned={sel > today ? preview.get(sel) : sel === today ? planFor(ctx, today) : undefined}
            external={extra.external.filter((w) => w.date === sel)}
            missedReason={extra.missed.find((m) => m.date === sel)}
          />
        )}
      </Sheet>
    </div>
  );
}

function WeekList({ ctx, preview, today }: { ctx: Awaited<ReturnType<typeof engineContext>>; preview: Map<string, PlannedSession>; today: string }) {
  const next7 = Array.from({ length: 7 }, (_, i) => addDaysKey(today, i));
  return (
    <Card>
      <h2 className="mb-2 font-semibold">Next 7 days</h2>
      <ul className="divide-y divide-line">
        {next7.map((d) => {
          const p = d === today ? planFor(ctx, today) : preview.get(d);
          return (
            <li key={d} className="flex justify-between gap-2 py-2 text-sm">
              <span className="w-20 shrink-0 text-muted">{d === today ? 'Today' : formatDay(d, 'EEE d')}</span>
              <span className="flex-1">{p ? (p.kind === 'rest' ? 'Rest / easy walk' : p.title) : '—'}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted">Strength sessions follow a rotation: a missed day never stacks up — you simply do the next one.</p>
    </Card>
  );
}

function PlanList({ plan }: { plan: PlannedSession }) {
  if (plan.kind === 'rest') return <p className="text-sm">Rest / easy walk.</p>;
  return (
    <div className="space-y-2">
      <div className="font-semibold">{plan.title}</div>
      <div className="text-xs text-muted">
        {plan.location === 'gym' ? 'Gym' : plan.location === 'travel' ? 'Hotel room' : 'Home'} · ~{plan.estimatedMin} min{plan.deload ? ' · deload week' : ''}
      </div>
      <ul className="space-y-1 text-sm">
        {plan.main.map((e) => (
          <li key={e.key} className="flex justify-between gap-2">
            <Link to={`/exercise/${e.key}`} className="text-accent">
              {e.name}
            </Link>
            <span className="num shrink-0 text-muted">{targetText(e)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DayDetail({
  date,
  status,
  sessions,
  planned,
  external,
  missedReason,
}: {
  date: string;
  status: DayStatus;
  sessions: SessionRecord[];
  planned?: PlannedSession;
  external: { id: string; type: string; durationMin: number; kcal: number | null }[];
  missedReason?: { date: string; reason?: string };
}) {
  const [reason, setReason] = useState(missedReason?.reason ?? '');
  return (
    <div className="space-y-4">
      <div className="text-sm text-muted">Status: {STATUS_LABEL[status]}</div>
      {sessions.map((s) => (
        <div key={s.id} className="space-y-3">
          <div>
            <h3 className="mb-1 text-sm uppercase text-muted">Planned</h3>
            <PlanList plan={s.plan} />
          </div>
          <div>
            <h3 className="mb-1 text-sm uppercase text-muted">Done · {s.durationMin} min</h3>
            <ul className="space-y-2 text-sm">
              {s.exercises.map((e) => {
                const p = s.plan.main.find((m) => m.key === e.key);
                return (
                  <li key={e.key}>
                    <div className="font-medium">{p?.name ?? e.key}</div>
                    {e.skipped ? (
                      <div className="text-muted">Skipped — {e.skipped.reason}</div>
                    ) : (
                      <div className="num text-muted">
                        {e.sets
                          .filter((x) => x.done)
                          .map((x) => `${x.load != null ? `${x.load} kg × ` : ''}${x.reps ?? '?'}${p?.unit === 'seconds' ? ' s' : p?.unit === 'minutes' ? ' min' : ''}${x.rpe ? ` @${x.rpe}` : ''}`)
                          .join(' · ') || 'No sets done'}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ))}
      {external.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm uppercase text-muted">Health Connect</h3>
          {external.map((w) => (
            <p key={w.id} className="text-sm">
              {w.type} · {w.durationMin} min{w.kcal ? ` · ${w.kcal} kcal` : ''}
            </p>
          ))}
        </div>
      )}
      {!sessions.length && planned && (
        <div>
          <h3 className="mb-1 text-sm uppercase text-muted">{date === todayKey() ? 'Today’s plan' : 'Planned (if you train as scheduled)'}</h3>
          <PlanList plan={planned} />
        </div>
      )}
      {status === 'missed' && (
        <div className="space-y-2">
          <h3 className="text-sm uppercase text-muted">Missed — reason (optional)</h3>
          <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. work travel, unwell" />
          <Button onClick={() => db.missed.put({ date, reason: reason.trim() || undefined })}>Save reason</Button>
        </div>
      )}
    </div>
  );
}
