import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { engineContext, planFor, saveWorkout } from '../db/repo';
import { swapPlanned } from '../engine/generate';
import type { LoggedExercise, LoggedSet, PlannedExercise, PlannedSession } from '../engine/types';
import { todayKey } from '../lib/date';
import { fmtClock } from '../lib/format';
import { resolveExercise } from '../data/exerciseDb';
import { ExerciseAnimation, ExerciseCard, targetText } from '../components/ExerciseCard';
import { Button, Card, H1, Sheet } from '../components/ui';
import type { Location } from '../data/catalog';

interface Draft {
  date: string;
  startedAt: number;
  plan: PlannedSession;
  logged: LoggedExercise[];
  warmupDone: string[];
  cooldownDone: string[];
}

const draftKey = (d: string) => `fitos.workout-draft.${d}`;
function loadDraft(date: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(date));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
function storeDraft(d: Draft | null, date: string) {
  try {
    if (d) localStorage.setItem(draftKey(date), JSON.stringify(d));
    else localStorage.removeItem(draftKey(date));
  } catch {
    /* storage unavailable — the workout still works in memory */
  }
}

function initialSets(p: PlannedExercise): LoggedSet[] {
  return Array.from({ length: p.sets }, () => ({
    reps: p.unit === 'minutes' ? p.reps[1] : null,
    load: p.load,
    rpe: null,
    done: false,
  }));
}

export default function Workout() {
  const today = todayKey();
  const ctx = useLiveQuery(() => engineContext(), []);
  const [draft, setDraft] = useState<Draft | null>(() => loadDraft(today));
  const [summary, setSummary] = useState<{ status: string | null; changes: string[] } | null>(null);
  const nav = useNavigate();

  useEffect(() => storeDraft(draft, today), [draft, today]);

  const plan = useMemo(() => (ctx ? planFor(ctx, today) : null), [ctx, today]);
  if (!ctx || !plan) return null;

  if (summary) {
    return (
      <div className="space-y-4">
        <H1>{summary.status === 'completed' ? 'Session complete' : summary.status === 'partial' ? 'Session saved (partial)' : 'Nothing logged'}</H1>
        {summary.changes.length > 0 && (
          <Card>
            <h2 className="mb-2 font-semibold">Next time</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {summary.changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </Card>
        )}
        <Button variant="primary" big className="w-full" onClick={() => nav('/')}>
          Back to Today
        </Button>
      </div>
    );
  }

  if (plan.kind === 'rest') {
    return (
      <div className="space-y-4">
        <H1>Rest day</H1>
        <p className="text-muted">Nothing to log today. Change your check-in on the Today screen if you want to train.</p>
        <Link to="/" className="text-accent">
          Back
        </Link>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="space-y-4">
        <H1>{plan.title}</H1>
        <p className="text-sm text-muted">~{plan.estimatedMin} min · {plan.main.length} exercises</p>
        <Button
          variant="primary"
          big
          className="w-full"
          onClick={() =>
            setDraft({ date: today, startedAt: Date.now(), plan, logged: plan.main.map((p) => ({ key: p.key, sets: initialSets(p) })), warmupDone: [], cooldownDone: [] })
          }
        >
          Start — timer begins now
        </Button>
        <Link to="/" className="block text-center text-accent">
          Back
        </Link>
      </div>
    );
  }

  return <Logger draft={draft} setDraft={setDraft} exerciseState={ctx.exerciseState} onFinish={setSummary} />;
}

function Logger({
  draft,
  setDraft,
  exerciseState,
  onFinish,
}: {
  draft: Draft;
  setDraft: (d: Draft | null) => void;
  exerciseState: Parameters<typeof swapPlanned>[2];
  onFinish: (s: { status: string | null; changes: string[] }) => void;
}) {
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState<string | null>(draft.plan.main[0]?.key ?? null);
  const [skipFor, setSkipFor] = useState<string | null>(null);
  const [cardFor, setCardFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const firedRef = useRef(false);
  const plan = draft.plan;
  const location: Location = plan.location === 'gym' ? 'gym' : 'home';

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const remaining = rest ? Math.ceil((rest.endsAt - now) / 1000) : 0;
  useEffect(() => {
    if (rest && remaining <= 0 && !firedRef.current) {
      firedRef.current = true;
      restDone();
      setRest(null);
    }
  }, [rest, remaining]);

  const update = useCallback(
    (key: string, fn: (l: LoggedExercise) => LoggedExercise) => setDraft({ ...draft, logged: draft.logged.map((l) => (l.key === key ? fn(l) : l)) }),
    [draft, setDraft],
  );

  const tick = (p: PlannedExercise, i: number) => {
    const l = draft.logged.find((x) => x.key === p.key)!;
    const s = l.sets[i];
    const done = !s.done;
    const filled: LoggedSet = { ...s, done, reps: s.reps ?? (done ? (p.unit === 'minutes' ? p.reps[1] : p.reps[0]) : s.reps) };
    update(p.key, (x) => ({ ...x, sets: x.sets.map((y, j) => (j === i ? filled : y)) }));
    if (done && p.restSec > 0) {
      const lastOfGroup = !p.group || plan.main.filter((m) => m.group === p.group).slice(-1)[0]?.key === p.key;
      if (lastOfGroup || plan.format === 'straight') {
        firedRef.current = false;
        setRest({ endsAt: Date.now() + p.restSec * 1000, total: p.restSec });
      }
    }
  };

  const swap = (idx: number, newKey: string) => {
    const old = plan.main[idx];
    const np = swapPlanned(old, newKey, exerciseState);
    const main = plan.main.map((m, i) => (i === idx ? np : m));
    setDraft({
      ...draft,
      plan: { ...plan, main },
      logged: draft.logged.map((l) => (l.key === old.key ? { key: np.key, sets: initialSets(np) } : l)),
    });
    setOpen(np.key);
  };

  const finish = async () => {
    setSaving(true);
    const r = await saveWorkout(plan, draft.logged, draft.startedAt, Date.now());
    setDraft(null);
    onFinish(r);
  };

  const elapsed = Math.floor((now - draft.startedAt) / 1000);
  const doneSets = draft.logged.reduce((n, l) => n + l.sets.filter((s) => s.done).length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <H1>{plan.title}</H1>
          <p className="text-sm text-muted">
            {doneSets} sets done · {plan.format === 'superset' ? 'supersets' : plan.format === 'circuit' ? 'circuit' : 'straight sets'}
          </p>
        </div>
        <div className="num text-2xl font-semibold" aria-label="Session time">
          {fmtClock(elapsed)}
        </div>
      </div>

      {plan.notes.map((n) => (
        <p key={n} className="text-xs text-muted">
          • {n}
        </p>
      ))}

      <Card>
        <h2 className="mb-2 font-semibold">Warm-up · {plan.warmup.length} moves</h2>
        <ChecklistItems
          items={plan.warmup}
          done={draft.warmupDone}
          onToggle={(k) => setDraft({ ...draft, warmupDone: draft.warmupDone.includes(k) ? draft.warmupDone.filter((x) => x !== k) : [...draft.warmupDone, k] })}
          onInfo={setCardFor}
        />
      </Card>

      {plan.main.map((p, idx) => {
        const l = draft.logged.find((x) => x.key === p.key)!;
        const isOpen = open === p.key;
        const ex = resolveExercise(p.key);
        const allDone = l.sets.every((s) => s.done);
        return (
          <Card key={p.key} className={allDone ? 'border-accent/50' : l.skipped ? 'opacity-60' : ''}>
            <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpen(isOpen ? null : p.key)} aria-expanded={isOpen}>
              <img src={ex.imageUrls[0]} alt="" className="h-12 w-16 shrink-0 rounded-lg bg-white object-contain" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">
                  {p.group && plan.format === 'superset' ? `${p.group}${plan.main.filter((m) => m.group === p.group).indexOf(p) + 1} · ` : ''}
                  {p.name}
                </div>
                <div className="num text-sm text-muted">{l.skipped ? `Skipped — ${l.skipped.reason}` : targetText(p)}</div>
              </div>
              <span className="text-muted">{allDone ? '✓' : isOpen ? '▴' : '▾'}</span>
            </button>
            {isOpen && !l.skipped && (
              <div className="mt-3 space-y-3">
                <ExerciseAnimation urls={ex.imageUrls} alt={ex.name} compact />
                {p.note && <p className="text-xs text-muted">{p.note}</p>}
                <div className="grid grid-cols-[2rem_1fr_1fr_1fr_3.5rem] items-center gap-2 text-xs text-muted">
                  <span>Set</span>
                  <span>{p.unit === 'reps' ? 'kg' + (p.perHand ? '/hand' : '') : ''}</span>
                  <span>{p.unit === 'reps' ? 'Reps' : p.unit === 'seconds' ? 'Seconds' : 'Minutes'}</span>
                  <span>RPE</span>
                  <span />
                </div>
                {l.sets.map((s, i) => (
                  <div key={i} className="grid grid-cols-[2rem_1fr_1fr_1fr_3.5rem] items-center gap-2">
                    <span className="num text-center text-muted">{i + 1}</span>
                    {p.unit === 'reps' && (p.load !== null || p.calibration) ? (
                      <NumInput
                        label={`Set ${i + 1} load`}
                        value={s.load}
                        step={0.5}
                        placeholder={p.calibration ? '10RM?' : 'kg'}
                        onChange={(v) => update(p.key, (x) => ({ ...x, sets: x.sets.map((y, j) => (j === i ? { ...y, load: v } : y)) }))}
                      />
                    ) : (
                      <span className="text-center text-xs text-muted">{p.unit === 'reps' ? 'BW' : ''}</span>
                    )}
                    <NumInput
                      label={`Set ${i + 1} ${p.unit}`}
                      value={s.reps}
                      step={1}
                      placeholder={`${p.reps[0]}–${p.reps[1]}`}
                      onChange={(v) => update(p.key, (x) => ({ ...x, sets: x.sets.map((y, j) => (j === i ? { ...y, reps: v } : y)) }))}
                    />
                    <select
                      aria-label={`Set ${i + 1} RPE`}
                      value={s.rpe ?? ''}
                      onChange={(e) =>
                        update(p.key, (x) => ({ ...x, sets: x.sets.map((y, j) => (j === i ? { ...y, rpe: e.target.value ? Number(e.target.value) : null } : y)) }))
                      }
                      className="min-h-12 rounded-xl border border-line bg-surface-2 px-1 text-center"
                    >
                      <option value="">–</option>
                      {[6, 7, 8, 9, 10].map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <button
                      aria-label={`Set ${i + 1} done`}
                      aria-pressed={s.done}
                      onClick={() => tick(p, i)}
                      className={`min-h-12 rounded-xl text-xl font-bold ${s.done ? 'bg-accent text-accent-ink' : 'border border-line bg-surface-2 text-muted'}`}
                    >
                      ✓
                    </button>
                  </div>
                ))}
                <p className="text-xs text-muted">RPE = how hard: 8 means 2 reps left in the tank. Log it — load only goes up when every set hits the top of the range at RPE 8 or below.</p>
                <div className="grid grid-cols-3 gap-2">
                  <Button onClick={() => update(p.key, (x) => ({ ...x, sets: [...x.sets, { ...x.sets[x.sets.length - 1], done: false, rpe: null }] }))}>+ Set</Button>
                  <Button onClick={() => setCardFor(p.key)}>How to</Button>
                  <Button variant="danger" onClick={() => setSkipFor(p.key)}>
                    Skip
                  </Button>
                </div>
                <SwapRow idx={idx} p={p} location={location} onSwap={swap} />
              </div>
            )}
            {l.skipped && (
              <Button variant="ghost" onClick={() => update(p.key, (x) => ({ ...x, skipped: undefined }))}>
                Undo skip
              </Button>
            )}
          </Card>
        );
      })}

      <Card>
        <h2 className="mb-2 font-semibold">Cool-down stretches</h2>
        <ChecklistItems
          items={plan.cooldown}
          done={draft.cooldownDone}
          onToggle={(k) => setDraft({ ...draft, cooldownDone: draft.cooldownDone.includes(k) ? draft.cooldownDone.filter((x) => x !== k) : [...draft.cooldownDone, k] })}
          onInfo={setCardFor}
        />
      </Card>

      <Button variant="primary" big className="w-full" disabled={saving} onClick={finish}>
        Finish & save
      </Button>
      <Button
        variant="ghost"
        className="w-full"
        onClick={() => {
          if (confirm('Discard this workout? Nothing will be saved.')) setDraft(null);
        }}
      >
        Discard workout
      </Button>

      {rest && remaining > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-40 mx-auto max-w-lg px-4 pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center justify-between rounded-2xl border border-accent/50 bg-surface-2 p-3 shadow-xl" role="timer" aria-live="polite">
            <div>
              <div className="text-xs uppercase text-muted">Rest</div>
              <div className="num text-3xl font-bold">{fmtClock(remaining)}</div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setRest({ ...rest, endsAt: rest.endsAt + 30000 })}>+30 s</Button>
              <Button variant="primary" onClick={() => setRest(null)}>
                Skip
              </Button>
            </div>
          </div>
        </div>
      )}

      <Sheet open={!!skipFor} onClose={() => setSkipFor(null)} title="Skip exercise — why?">
        <div className="grid grid-cols-2 gap-2">
          {['Equipment busy', 'Pain / discomfort', 'Out of time', 'Too tired', 'Other'].map((r) => (
            <Button
              key={r}
              onClick={() => {
                const reason = r === 'Other' ? prompt('Reason') || 'Other' : r;
                update(skipFor!, (x) => ({ ...x, skipped: { reason } }));
                setSkipFor(null);
              }}
            >
              {r}
            </Button>
          ))}
        </div>
      </Sheet>
      <Sheet open={!!cardFor} onClose={() => setCardFor(null)} title={cardFor ? resolveExercise(cardFor).name : ''}>
        {cardFor && <ExerciseCard exerciseKey={cardFor} planned={plan.main.find((m) => m.key === cardFor)} />}
      </Sheet>
    </div>
  );
}

function SwapRow({ idx, p, location, onSwap }: { idx: number; p: PlannedExercise; location: Location; onSwap: (i: number, k: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <Button className="w-full" onClick={() => setShow(true)}>
        Swap exercise
      </Button>
      <Sheet open={show} onClose={() => setShow(false)} title={`Swap ${p.name}`}>
        <ExerciseCard
          exerciseKey={p.key}
          planned={p}
          location={location}
          defaultOpen={false}
          onSwap={(k) => {
            onSwap(idx, k);
            setShow(false);
          }}
        />
      </Sheet>
    </>
  );
}

function ChecklistItems({
  items,
  done,
  onToggle,
  onInfo,
}: {
  items: { key: string; name: string; dose: string }[];
  done: string[];
  onToggle: (k: string) => void;
  onInfo: (k: string) => void;
}) {
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.key} className="flex items-center gap-2">
          <button
            aria-pressed={done.includes(i.key)}
            aria-label={`${i.name} done`}
            onClick={() => onToggle(i.key)}
            className={`min-h-11 min-w-11 rounded-xl text-lg ${done.includes(i.key) ? 'bg-accent text-accent-ink' : 'border border-line bg-surface-2 text-muted'}`}
          >
            ✓
          </button>
          <button className="flex-1 text-left text-sm" onClick={() => onInfo(i.key)}>
            {i.name} <span className="text-muted">· {i.dose}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function NumInput({
  value,
  onChange,
  step,
  placeholder,
  label,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  step: number;
  placeholder?: string;
  label: string;
}) {
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      type="number"
      step={step}
      min={0}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className="num min-h-12 w-full rounded-xl border border-line bg-surface-2 px-2 text-center text-lg"
    />
  );
}

/** End of rest: vibrate (Android) and a short beep. */
function restDone() {
  try {
    navigator.vibrate?.([400, 150, 400]);
  } catch {
    /* ignore */
  }
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new AC();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.value = 880;
    g.gain.value = 0.15;
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + 0.35);
  } catch {
    /* audio not available */
  }
}

