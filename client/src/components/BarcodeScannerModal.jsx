import { useEffect, useRef, useState } from 'react';

/**
 * Camera-based barcode scanner modal — opens the device camera via getUserMedia
 * (through @zxing/browser's BrowserMultiFormatReader) and calls onDetected(code)
 * the moment a barcode decodes successfully, then closes itself.
 *
 * Callers treat a decoded code exactly like a keyboard-wedge scan or a typed
 * barcode already does — this component only produces the string, it never
 * touches product lookup itself, so there's one lookup path either way.
 *
 * Gracefully handles no-camera/permission-denied: shows a message directing
 * the cashier back to the keyboard-wedge scanner or manual entry, rather than
 * a blank or broken modal.
 */
export function BarcodeScannerModal({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const controlsRef = useRef(null);
  const [status, setStatus] = useState('starting'); // starting | scanning | error
  const [errorMessage, setErrorMessage] = useState('');
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (cancelled) return;
        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;

        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          videoRef.current,
          (result, err) => {
            if (cancelled) return;
            if (result) {
              const text = result.getText();
              setFlash(true);
              beep();
              // Small delay so the cashier sees the green "found it" flash before the modal closes.
              setTimeout(() => { if (!cancelled) onDetected(text); }, 150);
            }
            // NotFoundException fires continuously between frames while nothing is decoded yet — not a real error, ignore it.
          }
        );
        controlsRef.current = controls;
        if (!cancelled) setStatus('scanning');
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setErrorMessage(
          err?.name === 'NotAllowedError'
            ? 'Camera access was denied. Allow camera access, or use the keyboard-wedge scanner / type the barcode manually instead.'
            : err?.name === 'NotFoundError'
            ? 'No camera was found on this device. Use the keyboard-wedge scanner or type the barcode manually instead.'
            : `Could not start the camera (${err?.message || 'unknown error'}). Use the keyboard-wedge scanner or type the barcode manually instead.`
        );
      }
    }

    start();
    return () => {
      cancelled = true;
      try { controlsRef.current?.stop(); } catch { /* ignore */ }
    };
  }, [onDetected]);

  function beep() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 1200;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
      osc.onended = () => ctx.close();
    } catch { /* audio isn't essential — the visual flash + toast still confirm the scan */ }
  }

  return (
    <div className="fixed inset-0 bg-ink/60 flex items-center justify-center z-50 px-4">
      <div className="card p-4 w-full max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="font-display text-lg font-semibold text-ink">Scan barcode</p>
          <button className="btn-ghost !p-1.5" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {status !== 'error' ? (
          <div className={`relative rounded-lg overflow-hidden bg-ink aspect-square transition-shadow ${flash ? 'ring-4 ring-accent' : ''}`}>
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            {status === 'starting' && (
              <div className="absolute inset-0 flex items-center justify-center text-white text-sm">Starting camera…</div>
            )}
            {status === 'scanning' && (
              <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-0.5 bg-accent/80" />
            )}
            {flash && (
              <div className="absolute inset-0 bg-accent/30 flex items-center justify-center">
                <span className="chip-accent !text-sm">Found it!</span>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-danger-soft/30 border border-danger/30 p-4 text-sm text-ink">
            {errorMessage}
          </div>
        )}

        <p className="text-xs text-ink-muted mt-3 text-center">Point the camera at a barcode — it's added automatically the moment it's recognized.</p>
      </div>
    </div>
  );
}
