import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { db } from '../db/db';
import { engineContext } from '../db/repo';
import { adherence28, currentStreak, weeklyVolume } from '../engine/adherence';
import { stepTarget } from '../engine/steps';
import { movingAverage7, projectGoalDate, rapidLossWarning, trendAt, WAIST_RISK_CM_INDIAN_MALE, weeklyRate } from '../engine/weight';
import type { SessionRecord } from '../engine/types';
import { addDaysKey, formatDay, todayKey } from '../lib/date';
import { fmtCm, fmtInt, fmtKg } from '../lib/format';
import { Button, Card, H1, H2, Notice, Stat, inputCls } from '../components/ui';

const axis = { stroke: 'var(--color-muted)', fontSize: 11 };
const tip = { contentStyle: { background: 'var(--color-surface-2)', border: '1px solid var(--color-line)', borderRadius: 8 }, labelStyle: { color: 'var(--color-ink)' } };
const shortDate = (d: string) => formatDay(d, 'd MMM');

export default function Progress() {
  const today = todayKey();
  const ctx = useLiveQuery(() => engineContext(), []);
  const d = useLiveQuery(async () => ({
    weights: await db.weights.orderBy('date').toArray(),
    waists: await db.waists.orderBy('date').toArray(),
    steps: await db.steps.where('date').between(addDaysKey(today, -44), today, true, true).toArray(),
    missed: await db.missed.orderBy('date').reverse().limit(30).toArray(),
    external: await db.externalWorkouts.toArray(),
  }), [today]);
  const [range, setRange] = useState<30 | 90 | 365>(90);
  const byDate = useMemo(() => {
    const m = new Map<string, SessionRecord[]>();
    for (const s of ctx?.sessions ?? []) m.set(s.date, [...(m.get(s.date) ?? []), s]);
    return m;
  }, [ctx]);
  if (!ctx || !d) return null;
  const s = ctx.settings;

  const pts = d.weights.map((w) => ({ date: w.date, value: w.kg }));
  const ma = movingAverage7(pts);
  const from = addDaysKey(today, -range);
  const chart = d.weights
    .filter((w) => w.date >= from)
    .map((w) => ({ date: w.date, raw: w.kg, trend: Math.round((ma.find((m) => m.date === w.date)?.value ?? w.kg) * 10) / 10 }));
  const rate = weeklyRate(pts, today);
  const trendNow = trendAt(pts, today);
  const goalDate = projectGoalDate(pts, today, s.goalWeightKg);
  const warn = rapidLossWarning(pts, today);

  const waist = d.waists.map((w) => ({ date: w.date, cm: w.cm }));
  const stepsMap = new Map(d.steps.map((x) => [x.date, x.count]));
  const tgt = stepTarget(stepsMap, today);
  const stepsChart = Array.from({ length: 30 }, (_, i) => addDaysKey(today, i - 29)).map((date) => ({ date, steps: stepsMap.get(date) ?? 0 }));

  const externalDates = new Set(d.external.map((w) => w.date));
  const args = { today, schedule: s.schedule, sessions: byDate, checkIns: ctx.checkIns, externalDates };
  const streak = currentStreak(args);
  const adh = adherence28(args);
  const vol = weeklyVolume(ctx.sessions, today);

  return (
    <div className="space-y-4">
      <H1>Progress</H1>

      <Card>
        <H2
          right={
            <div className="flex gap-1">
              {([30, 90, 365] as const).map((r) => (
                <button key={r} onClick={() => setRange(r)} className={`min-h-9 rounded-lg px-2 text-xs ${range === r ? 'bg-accent/20 text-accent' : 'text-muted'}`}>
                  {r === 365 ? '1 y' : `${r} d`}
                </button>
              ))}
            </div>
          }
        >
          Weight
        </H2>
        <div className="mb-3 grid grid-cols-3 gap-2">
          <Stat label="7-day trend" value={trendNow != null ? `${fmtKg(trendNow)}` : '—'} sub="kg" />
          <Stat label="Per week" value={rate != null ? `${rate > 0 ? '+' : ''}${fmtKg(rate)}` : '—'} sub="kg / week" />
          <Stat label={`Goal ${fmtKg(s.goalWeightKg)} kg`} value={goalDate ? formatDay(goalDate, 'MMM yyyy') : '—'} sub={goalDate ? `≈ ${formatDay(goalDate, 'd MMM')}` : 'needs a downward trend'} />
        </div>
        {warn.warn && <Notice tone="warn">Losing more than 1 % of body weight a week for 2 weeks running ({warn.pcts.map((p) => `${p?.toFixed(1)} %`).join(', ')}). Ease the deficit to protect muscle.</Notice>}
        {chart.length > 0 ? (
          <div className="h-56" role="img" aria-label="Weight chart: daily weigh-ins as dots and the 7-day moving average as a line">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={axis} minTickGap={24} />
                <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={axis} tickFormatter={(v) => Number(v).toFixed(0)} width={44} />
                <Tooltip {...tip} labelFormatter={(l) => formatDay(String(l))} formatter={(v, n) => [`${Number(v).toFixed(1)} kg`, n === 'raw' ? 'Weigh-in' : '7-day average']} />
                <Scatter dataKey="raw" fill="var(--color-muted)" isAnimationActive={false} />
                <Line dataKey="trend" stroke="var(--color-accent)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <ReferenceLine y={s.goalWeightKg} stroke="var(--color-partial)" strokeDasharray="4 4" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted">Log your weight on the Log tab to see the trend.</p>
        )}
      </Card>

      <Card>
        <H2>Waist</H2>
        <p className="mb-2 text-xs text-muted">Waist is the best simple guide to visceral (belly) fat. Dashed line: 90 cm, the higher-risk threshold for Indian men.</p>
        {waist.length ? (
          <>
            <div className="num mb-2 text-sm">
              Latest {fmtCm(waist[waist.length - 1].cm)} cm{waist.length > 1 && ` · change ${fmtCm(waist[waist.length - 1].cm - waist[0].cm)} cm since ${shortDate(waist[0].date)}`}
            </div>
            <div className="h-44" role="img" aria-label="Waist chart with the 90 cm risk line">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={waist} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={axis} minTickGap={24} />
                  <YAxis domain={[(min: number) => Math.min(min, WAIST_RISK_CM_INDIAN_MALE) - 2, 'dataMax + 2']} tick={axis} width={44} />
                  <Tooltip {...tip} labelFormatter={(l) => formatDay(String(l))} formatter={(v) => [`${Number(v).toFixed(1)} cm`, 'Waist']} />
                  <ReferenceLine y={WAIST_RISK_CM_INDIAN_MALE} stroke="var(--color-bad)" strokeDasharray="6 4" label={{ value: '90 cm', fill: 'var(--color-bad)', fontSize: 11, position: 'insideTopRight' }} />
                  <Line dataKey="cm" stroke="var(--color-warn)" strokeWidth={2} dot isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">Measure once a week on the Log tab.</p>
        )}
      </Card>

      <Card>
        <H2>Steps · last 30 days</H2>
        <div className="h-40" role="img" aria-label={`Steps per day with the target line at ${tgt.target}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stepsChart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <XAxis dataKey="date" tickFormatter={shortDate} tick={axis} minTickGap={24} />
              <YAxis tick={axis} width={44} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
              <Tooltip {...tip} labelFormatter={(l) => formatDay(String(l))} formatter={(v) => [fmtInt(Number(v)), 'Steps']} />
              <ReferenceLine y={tgt.target} stroke="var(--color-accent)" strokeDasharray="4 4" />
              <Bar dataKey="steps" fill="var(--color-partial)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <H2>Adherence</H2>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Current streak" value={`${streak}`} sub="training days in a row" />
          <Stat label="Last 4 weeks" value={adh.pct != null ? `${adh.pct} %` : '—'} sub={`${adh.done} of ${adh.scheduled} training days`} />
        </div>
        <h3 className="mb-1 mt-4 text-sm font-medium">Sets this week by muscle group</h3>
        <ul className="space-y-1 text-sm">
          {Object.entries(vol).map(([g, n]) => (
            <li key={g} className="flex items-center gap-2">
              <span className="w-20 text-muted">{g}</span>
              <div className="h-2 flex-1 rounded-full bg-line">
                <div className="h-2 rounded-full bg-accent" style={{ width: `${Math.min(100, (n / 15) * 100)}%` }} />
              </div>
              <span className="num w-6 text-right">{n}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <div id="missed" />
        <H2>Missed days</H2>
        {d.missed.length ? (
          <ul className="divide-y divide-line">
            {d.missed.map((m) => (
              <MissedRow key={m.date} date={m.date} reason={m.reason} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">None — nice.</p>
        )}
      </Card>
    </div>
  );
}

function MissedRow({ date, reason }: { date: string; reason?: string }) {
  const [v, setV] = useState(reason ?? '');
  return (
    <li className="space-y-2 py-2">
      <div className="text-sm">{formatDay(date, 'EEE d MMM yyyy')}</div>
      <div className="flex gap-2">
        <input className={inputCls} placeholder="Reason (optional)" value={v} onChange={(e) => setV(e.target.value)} />
        <Button disabled={v === (reason ?? '')} onClick={() => db.missed.put({ date, reason: v.trim() || undefined })}>
          Save
        </Button>
      </div>
    </li>
  );
}
