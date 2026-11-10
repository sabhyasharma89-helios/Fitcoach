import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Pull down from the top of the page to refresh (used for Health Connect sync in the Android app). */
export function PullToRefresh({ onRefresh, enabled, children }: { onRefresh: () => Promise<unknown>; enabled: boolean; children: ReactNode }) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);
  const THRESHOLD = 80;

  useEffect(() => {
    if (!enabled) return;
    const down = (e: TouchEvent) => {
      start.current = window.scrollY <= 0 && !busy ? e.touches[0].clientY : null;
    };
    const move = (e: TouchEvent) => {
      if (start.current == null) return;
      const dy = e.touches[0].clientY - start.current;
      setPull(dy > 0 ? Math.min(120, dy * 0.6) : 0);
    };
    const up = async () => {
      if (start.current == null) return;
      start.current = null;
      if (pull >= THRESHOLD) {
        setBusy(true);
        try {
          await onRefresh();
        } finally {
          setBusy(false);
        }
      }
      setPull(0);
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('touchstart', down);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
  }, [enabled, onRefresh, pull, busy]);

  return (
    <>
      {(pull > 0 || busy) && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center pt-[env(safe-area-inset-top)]" style={{ transform: `translateY(${busy ? 24 : pull / 2}px)` }}>
          <span className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs text-muted">
            {busy ? 'Syncing Health Connect…' : pull >= THRESHOLD ? 'Release to sync' : 'Pull to sync'}
          </span>
        </div>
      )}
      {children}
    </>
  );
}
