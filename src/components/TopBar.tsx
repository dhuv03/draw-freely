import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../AppContext';
import { exportJSON, exportPNG, exportSVG, importJSON } from '../storage/persistence';
import type { ExcalidrawElement } from '../types';

export function TopBar({ onImport }: { onImport: (elements: ExcalidrawElement[]) => void }) {
  const { state, dispatch } = useAppContext();
  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showExport) return;
    const close = (event: MouseEvent) => { if (exportRef.current && !exportRef.current.contains(event.target as Node)) setShowExport(false); };
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close);
  }, [showExport]);
  const importDrawing = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.drawfreely,.json';
    input.onchange = async (event) => { const file = (event.target as HTMLInputElement).files?.[0]; if (file) onImport(await importJSON(file)); };
    input.click(); setShowExport(false);
  };
  return <div className="top-bar glass-panel" role="toolbar" aria-label="Actions">
    <span className="app-logo">DrawFreely</span><div className="top-bar-divider"/>
    <button className="top-bar-btn" onClick={() => dispatch({ type:'UNDO' })} disabled={!state.history.past.length} aria-label="Undo (Ctrl+Z)"><svg viewBox="0 0 24 24"><path d="M3 7v6h6"/><path d="M5.5 17a9 9 0 1 0 .5-10L3 10"/></svg></button>
    <button className="top-bar-btn" onClick={() => dispatch({ type:'REDO' })} disabled={!state.history.future.length} aria-label="Redo (Ctrl+Shift+Z)"><svg viewBox="0 0 24 24"><path d="M21 7v6h-6"/><path d="M18.5 17a9 9 0 1 1-.5-10l3 3"/></svg></button>
    <div className="top-bar-divider"/>
    <div ref={exportRef} className="top-export-wrap"><button className="top-bar-btn" onClick={() => setShowExport((open) => !open)} aria-label="Export / Save"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg></button>{showExport && <div className="export-dropdown glass-panel"><button onClick={() => exportPNG(state.elements,state.theme)}>Export PNG</button><button onClick={() => exportSVG(state.elements,state.theme)}>Export SVG</button><button onClick={() => exportJSON(state.elements)}>Save .drawfreely</button><button onClick={importDrawing}>Open drawing</button></div>}</div>
  </div>;
}
