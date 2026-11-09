import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { Icon } from './Icon';

export function Slider({ label, value, min, max, step = 1, onChange, onReset, hint, unit = '', disabled = false }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void;
  onReset: () => void; hint: string; unit?: string; disabled?: boolean;
}) {
  const id = useId();
  const numeric = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { if (document.activeElement !== numeric.current) setDraft(String(value)); }, [value]);
  const update = (raw: string) => {
    if (raw.trim() === '') return;
    const next = Number(raw);
    if (Number.isFinite(next)) onChange(Number((min + Math.round((Math.max(min, Math.min(max, next)) - min) / step) * step).toFixed(3)));
  };
  return <div className={`slider-control ${disabled ? 'disabled' : ''}`}>
    <div className="control-label"><label htmlFor={id} title={hint}>{label}</label><span className="control-value">
      <input ref={numeric} aria-label={`${label} value`} type="number" value={draft} min={min} max={max} step={step}
        onChange={e => {
          const raw = e.target.value; setDraft(raw);
          const next = Number(raw);
          if (raw.trim() !== '' && Number.isFinite(next) && next >= min && next <= max) update(raw);
        }}
        onBlur={() => {
          if (draft.trim() === '' || !Number.isFinite(Number(draft))) setDraft(String(value));
          else { const next = Math.max(min, Math.min(max, Number(draft))); update(String(next)); setDraft(String(Number((min + Math.round((next - min) / step) * step).toFixed(3)))); }
        }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { e.preventDefault(); setDraft(String(value)); } }}
        disabled={disabled} aria-describedby={`${id}-hint`} />
      {unit && <span>{unit}</span>}
      <button className="mini-reset" onClick={onReset} disabled={disabled} title={`Reset ${label.toLowerCase()}`} aria-label={`Reset ${label.toLowerCase()}`}><Icon name="reset" size={12} /></button>
    </span></div>
    <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={e => update(e.target.value)} disabled={disabled} aria-describedby={`${id}-hint`} style={{ '--range-progress': `${max === min ? 0 : (value - min) / (max - min) * 100}%` } as CSSProperties} />
    <span id={`${id}-hint`} className="sr-only">{hint}</span>
  </div>;
}

export function Toggle({ label, checked, onChange, hint, disabled }: { label: string; checked: boolean; onChange: (value: boolean) => void; hint: string; disabled?: boolean }) {
  const id = useId();
  return <label className={`toggle-row ${disabled ? 'disabled' : ''}`} title={hint}>
    <span>{label}<span id={id} className="sr-only">{hint}</span></span>
    <input type="checkbox" role="switch" checked={checked} onChange={e => onChange(e.target.checked)} aria-describedby={id} disabled={disabled} />
    <span className="toggle-track" aria-hidden="true" />
  </label>;
}
