import { useRef, useState } from 'react';

/** Read-only value with a Copy button. Falls back to selecting the text when the clipboard is unavailable. */
export function CopyField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      input.current?.select();
      setState('manual');
    }
    setTimeout(() => setState('idle'), 2500);
  };

  return (
    <label className="field">
      <span>{label}</span>
      <div className="copy-row">
        <input ref={input} className={mono ? 'input mono' : 'input'} value={value} readOnly onFocus={(e) => e.target.select()} />
        <button type="button" className="btn btn-quiet" onClick={copy}>
          {state === 'copied' ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
      {state === 'manual' && <small className="muted">Copying is blocked here; it’s selected, press Ctrl+C / ⌘C.</small>}
    </label>
  );
}
