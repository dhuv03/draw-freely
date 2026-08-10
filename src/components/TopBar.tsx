// ──────────────────────────────────────────────
// DrawFreely — Top Bar
// Logo, Undo/Redo, Zoom, Theme Toggle, Export
// ──────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../AppContext';
import { ZOOM_LIMITS } from '../constants';
import { exportPNG, exportSVG, exportJSON, importJSON } from '../storage/persistence';
import type { ExcalidrawElement } from '../types';

interface TopBarProps {
  onImport: (elements: ExcalidrawElement[]) => void;
}

export function TopBar({ onImport }: TopBarProps) {
  const { state, dispatch } = useAppContext();
  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const { viewport, theme, elements, history } = state;
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const zoomPercent = Math.round(viewport.zoom * 100);

  // Close export dropdown on outside click
  useEffect(() => {
    if (!showExport) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExport(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExport]);

  const handleZoomIn = () => {
    const newZoom = Math.min(ZOOM_LIMITS.max, viewport.zoom + 0.1);
    dispatch({ type: 'SET_VIEWPORT', viewport: { zoom: newZoom } });
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(ZOOM_LIMITS.min, viewport.zoom - 0.1);
    dispatch({ type: 'SET_VIEWPORT', viewport: { zoom: newZoom } });
  };

  const handleZoomReset = () => {
    dispatch({ type: 'SET_VIEWPORT', viewport: { zoom: 1, scrollX: 0, scrollY: 0 } });
  };

  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.drawfreely,.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const elements = await importJSON(file);
        onImport(elements);
      } catch (err) {
        console.error('Failed to import:', err);
      }
    };
    input.click();
    setShowExport(false);
  };

  return (
    <div className="top-bar glass-panel" role="toolbar" aria-label="Actions">
      {/* Logo */}
      <span className="app-logo">DrawFreely</span>

      <div className="top-bar-divider" />

      {/* Undo / Redo */}
      <div className="top-bar-section">
        <button
          className="top-bar-btn"
          onClick={() => dispatch({ type: 'UNDO' })}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>
        <button
          className="top-bar-btn"
          onClick={() => dispatch({ type: 'REDO' })}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
          </svg>
        </button>
      </div>

      <div className="top-bar-divider" />

      {/* Zoom Controls */}
      <div className="top-bar-section">
        <button className="top-bar-btn" onClick={handleZoomOut} title="Zoom Out">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button
          className="zoom-display"
          onClick={handleZoomReset}
          title="Reset Zoom"
          style={{ cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text-secondary)' }}
        >
          {zoomPercent}%
        </button>
        <button className="top-bar-btn" onClick={handleZoomIn} title="Zoom In">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div className="top-bar-divider" />

      {/* Theme Toggle */}
      <button
        className="top-bar-btn"
        onClick={() => dispatch({ type: 'TOGGLE_THEME' })}
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        {theme === 'light' ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        )}
      </button>

      <label className="canvas-color-button" title="Canvas background">
        <span className="canvas-color-sample" aria-hidden="true" style={{ background: state.canvasBackground }} />
        <span className="canvas-color-label">Canvas</span>
        <input aria-label="Canvas background" type="color" value={state.canvasBackground} onChange={(event) => dispatch({ type: 'SET_CANVAS_BACKGROUND', color: event.target.value })} />
      </label>

      {/* Export / Import */}
      <div ref={exportRef} style={{ position: 'relative' }}>
        <button
          className="top-bar-btn"
          onClick={() => setShowExport(!showExport)}
          title="Export / Save"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>

        {showExport && (
          <div className="export-dropdown glass-panel">
            <button onClick={() => { exportPNG(elements, theme); setShowExport(false); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              Export PNG
            </button>
            <button onClick={() => { exportSVG(elements, theme); setShowExport(false); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              Export SVG
            </button>
            <button onClick={() => { exportJSON(elements); setShowExport(false); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Save as .drawfreely
            </button>
            <button onClick={handleImportJSON}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Open .drawfreely
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
