import { lazy, Suspense, useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/db';
import { boot } from './db/repo';
import { todayKey } from './lib/date';
import { Button } from './components/ui';
import { UpdatePrompt } from './components/UpdatePrompt';
import Today from './pages/Today';
const Workout = lazy(() => import('./pages/Workout'));
const Plan = lazy(() => import('./pages/Plan'));
const Log = lazy(() => import('./pages/Log'));
const Progress = lazy(() => import('./pages/Progress'));
const More = lazy(() => import('./pages/More'));
const ExercisePage = lazy(() => import('./pages/ExercisePage'));
const Library = lazy(() => import('./pages/Library'));
import { autoSyncHealth, isNative } from './health/health';
import { PullToRefresh } from './components/PullToRefresh';

const NAV = [
  { to: '/', label: 'Today', icon: 'M3 12l9-8 9 8M5 10v10h14V10' },
  { to: '/plan', label: 'Plan', icon: 'M4 5h16v15H4zM4 9h16M9 3v4M15 3v4' },
  { to: '/log', label: 'Log', icon: 'M12 5v14M5 12h14' },
  { to: '/progress', label: 'Progress', icon: 'M4 19l5-6 4 3 7-9' },
  { to: '/more', label: 'More', icon: 'M5 12h.01M12 12h.01M19 12h.01' },
];

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settings = useLiveQuery(() => db.settings.get('me'), []);

  useEffect(() => {
    boot(todayKey())
      .then(() => setReady(true))
      .then(() => autoSyncHealth())
      .catch((e) => setError(String(e?.message ?? e)));
  }, []);

  useEffect(() => {
    // re-sync when the app comes back to the foreground
    const onVis = () => document.visibilityState === 'visible' && autoSyncHealth();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  if (error) return <div className="p-6 text-bad">Could not open the local database: {error}</div>;
  if (!ready || !settings) return <div className="p-6 text-muted">Loading…</div>;

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col">
      <main className="flex-1 px-4 pb-28 pt-[calc(1rem+env(safe-area-inset-top))]">
        <PullToRefresh enabled={isNative() && settings.healthConnectEnabled} onRefresh={autoSyncHealth}>
        <Suspense fallback={<div className="p-6 text-muted">Loading…</div>}>
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/log" element={<Log />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/more" element={<More />} />
          <Route path="/library" element={<Library />} />
          <Route path="/exercise/:key" element={<ExercisePage />} />
          <Route path="*" element={<Today />} />
        </Routes>
        </Suspense>
        </PullToRefresh>
      </main>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex min-h-16 flex-col items-center justify-center gap-1 text-xs ${isActive ? 'text-accent' : 'text-muted'}`
              }
            >
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={n.icon} />
              </svg>
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>
      {!settings.disclaimerAcceptedAt && <Disclaimer />}
      <UpdatePrompt />
    </div>
  );
}

function Disclaimer() {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
      <div role="dialog" aria-modal="true" aria-label="Before you start" className="max-w-md space-y-3 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-xl font-semibold">Before you start</h2>
        <p className="text-sm">
          FitOS gives general fitness and nutrition guidance. It is not medical advice. Please get a check-up from your doctor before
          starting a new exercise or diet programme — especially at a higher body weight, or if you have a heart condition, high blood
          pressure, diabetes, joint problems, or take regular medication.
        </p>
        <p className="text-sm">Stop exercising and seek help if you feel chest pain, dizziness, unusual breathlessness, or sharp joint pain.</p>
        <Button variant="primary" big className="w-full" onClick={() => db.settings.update('me', { disclaimerAcceptedAt: Date.now() })}>
          I understand
        </Button>
      </div>
    </div>
  );
}
