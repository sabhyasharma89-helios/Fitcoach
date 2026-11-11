import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './ui';

/** Shows when a new version of the app has been downloaded. Data is never touched by updates. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2 p-3 shadow-lg">
      <span className="text-sm">A new version of FitOS is ready.</span>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => setNeedRefresh(false)}>
          Later
        </Button>
        <Button variant="primary" onClick={() => updateServiceWorker(true)}>
          Update
        </Button>
      </div>
    </div>
  );
}
