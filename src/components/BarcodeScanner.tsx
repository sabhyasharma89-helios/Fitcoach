import { useEffect, useRef, useState } from 'react';
import { Button, inputCls } from './ui';

interface DetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

/**
 * Camera barcode scanner: uses the native BarcodeDetector API when the browser has it (Chrome on
 * Android), otherwise falls back to ZXing. Manual entry is always available.
 */
export function BarcodeScanner({ onCode }: { onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [engine, setEngine] = useState<'native' | 'zxing' | null>(null);

  useEffect(() => {
    let stop = false;
    let stream: MediaStream | null = null;
    let zxingControls: { stop: () => void } | null = null;
    const done = (code: string) => {
      if (stop) return;
      stop = true;
      try {
        navigator.vibrate?.(80);
      } catch {
        /* ignore */
      }
      onCode(code);
    };

    (async () => {
      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => DetectorLike }).BarcodeDetector;
      try {
        if (BD) {
          setEngine('native');
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          const v = videoRef.current!;
          v.srcObject = stream;
          await v.play();
          const det = new BD({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
          const loop = async () => {
            if (stop) return;
            try {
              const found = await det.detect(v);
              if (found[0]?.rawValue) return done(found[0].rawValue);
            } catch {
              /* frame not ready */
            }
            setTimeout(loop, 250);
          };
          loop();
        } else {
          setEngine('zxing');
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const reader = new BrowserMultiFormatReader();
          zxingControls = await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, videoRef.current!, (result) => {
            if (result) done(result.getText());
          });
        }
      } catch (e) {
        setError(`Camera not available (${(e as Error).message ?? e}). Type the barcode number instead.`);
      }
    })();

    return () => {
      stop = true;
      zxingControls?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  return (
    <div className="space-y-3">
      {!error && (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-accent/80" />
          {engine && <span className="absolute bottom-1 right-2 text-[10px] text-white/60">{engine === 'native' ? 'BarcodeDetector' : 'ZXing'}</span>}
        </div>
      )}
      {error && <p className="text-sm text-warn">{error}</p>}
      <div className="flex gap-2">
        <input className={inputCls} inputMode="numeric" placeholder="Barcode number" value={manual} onChange={(e) => setManual(e.target.value)} />
        <Button variant="primary" disabled={manual.replace(/\D/g, '').length < 6} onClick={() => onCode(manual)}>
          Look up
        </Button>
      </div>
    </div>
  );
}
