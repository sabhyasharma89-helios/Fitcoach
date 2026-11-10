import { useEffect, useState } from 'react';
import { alternativesFor, type Location } from '../data/catalog';
import { resolveExercise } from '../data/exerciseDb';
import type { PlannedExercise } from '../engine/types';
import { Button, Sheet } from './ui';
import { fmtRest } from '../lib/format';

export function targetText(p: Pick<PlannedExercise, 'sets' | 'reps' | 'unit' | 'load' | 'perHand' | 'calibration'>): string {
  const reps =
    p.unit === 'minutes'
      ? `${p.reps[0] === p.reps[1] ? p.reps[1] : `${p.reps[0]}–${p.reps[1]}`} min`
      : p.unit === 'seconds'
        ? `${p.sets} × ${p.reps[0]}–${p.reps[1]} s`
        : `${p.sets} × ${p.reps[0]}–${p.reps[1]}`;
  if (p.unit === 'minutes') return reps;
  const load = p.calibration ? ' · find your 10-rep load' : p.load != null ? ` · ${p.load} kg${p.perHand ? ' per hand' : ''}` : ' · bodyweight';
  return reps + load;
}

/** Two images alternate every 0.8 s so they read as a start/end animation. Tap to pause. */
export function ExerciseAnimation({ urls, alt, compact }: { urls: string[]; alt: string; compact?: boolean }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || urls.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % urls.length), 800);
    return () => clearInterval(t);
  }, [paused, urls.length]);
  return (
    <button
      type="button"
      onClick={() => setPaused((p) => !p)}
      aria-label={paused ? `Play ${alt} animation` : `Pause ${alt} animation`}
      className={`relative block w-full overflow-hidden rounded-xl bg-white ${compact ? 'aspect-[4/3] max-h-40' : 'aspect-[4/3]'}`}
    >
      {urls.map((u, idx) => (
        <img
          key={u}
          src={u}
          alt={idx === 0 ? `${alt} — start position` : `${alt} — end position`}
          loading="lazy"
          className={`absolute inset-0 h-full w-full object-contain ${idx === i ? 'opacity-100' : 'opacity-0'}`}
        />
      ))}
      {paused && <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white">Paused · tap to play</span>}
    </button>
  );
}

export function ExerciseCard({
  exerciseKey,
  planned,
  location,
  onSwap,
  defaultOpen = true,
}: {
  exerciseKey: string;
  planned?: PlannedExercise;
  location?: Location;
  onSwap?: (newKey: string) => void;
  defaultOpen?: boolean;
}) {
  const ex = resolveExercise(exerciseKey);
  const [showSwap, setShowSwap] = useState(false);
  const alts = location ? alternativesFor(exerciseKey, location) : [];
  return (
    <div className="space-y-3">
      <ExerciseAnimation urls={ex.imageUrls} alt={ex.name} />
      {ex.variationNote && <p className="rounded-lg bg-warn/10 p-2 text-sm text-warn">{ex.variationNote}</p>}
      {planned && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Info label="Target" value={targetText(planned)} wide />
          <Info label="Rest" value={fmtRest(planned.restSec)} />
          <Info label="Tempo" value={ex.tempo} />
        </div>
      )}
      {planned?.note && <p className="text-sm text-muted">{planned.note}</p>}
      <div>
        <div className="mb-1 text-xs uppercase tracking-wide text-muted">Form cues</div>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {ex.cues.slice(0, 3).map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
      <details open={defaultOpen}>
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-accent">How to do it</summary>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {ex.instructions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </details>
      <div className="flex flex-wrap gap-1 text-xs">
        {ex.db.primaryMuscles.map((m) => (
          <span key={m} className="rounded-full bg-accent/15 px-2 py-1 text-accent">
            {m}
          </span>
        ))}
        {ex.db.secondaryMuscles.map((m) => (
          <span key={m} className="rounded-full bg-surface-2 px-2 py-1 text-muted">
            {m}
          </span>
        ))}
      </div>
      {onSwap && alts.length > 0 && (
        <>
          <Button onClick={() => setShowSwap(true)} className="w-full">
            Swap exercise
          </Button>
          <Sheet open={showSwap} onClose={() => setShowSwap(false)} title={`Swap ${ex.name}`}>
            <p className="mb-3 text-sm text-muted">Same movement pattern, available at {location === 'gym' ? 'the gym' : 'home'}.</p>
            <div className="space-y-2">
              {alts.map((a) => {
                const r = resolveExercise(a.key);
                return (
                  <button
                    key={a.key}
                    onClick={() => {
                      onSwap(a.key);
                      setShowSwap(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2 p-2 text-left"
                  >
                    <img src={r.imageUrls[0]} alt="" className="h-14 w-20 rounded-lg bg-white object-contain" />
                    <span className="text-sm font-medium">{a.name}</span>
                  </button>
                );
              })}
            </div>
          </Sheet>
        </>
      )}
    </div>
  );
}

function Info({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-lg bg-surface-2 p-2 ${wide ? 'col-span-2' : ''}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className="num font-medium">{value}</div>
    </div>
  );
}
