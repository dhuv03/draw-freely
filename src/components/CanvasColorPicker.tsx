import { useEffect, useRef, useState } from 'react';

const CANVAS_SWATCHES = ['#ffffff', '#f8fafc', '#f1f5f9', '#fffef0', '#fff8f6', '#fffce8'];

export function CanvasColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value.replace('#', ''));
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const close = (event: PointerEvent) => { if (!wrapRef.current?.contains(event.target as Node)) setOpen(false); }; window.addEventListener('pointerdown', close); return () => window.removeEventListener('pointerdown', close); }, []);
  const commit = (raw: string) => { const clean = raw.replace(/[^0-9a-f]/gi, '').slice(0, 6); setDraft(clean); if (/^[0-9a-f]{6}$/i.test(clean)) onChange(`#${clean}`); };
  return <div className="canvas-color-picker" ref={wrapRef}>
    <div className="canvas-color-swatches">{CANVAS_SWATCHES.map((color) => <button key={color} className={value.toLowerCase() === color ? 'active' : ''} style={{ background:color }} onClick={() => { setDraft(color.replace('#', '')); onChange(color); }} aria-label={`Canvas background ${color}`}>{value.toLowerCase() === color && <span>✓</span>}</button>)}<i/><button className="canvas-color-custom" style={{ background:value }} onClick={() => { setDraft(value.replace('#', '')); setOpen((shown) => !shown); }} aria-label="Custom canvas colour" /></div>
    {open && <div className="canvas-hex-popover"><label>Hex code</label><div><span>#</span><input value={draft} maxLength={6} spellCheck={false} onChange={(event) => commit(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') setOpen(false); }}/><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m19 3 2 2-9.5 9.5-3 1 1-3L19 3ZM14.5 7.5l2 2M5 19h14"/></svg></div></div>}
  </div>;
}
