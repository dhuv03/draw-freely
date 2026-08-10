// ──────────────────────────────────────────────
// DrawFreely — Main App Component
// ──────────────────────────────────────────────

import { useRef, useEffect, useCallback, useState } from 'react';
import { useAppContext } from './AppContext';
import { StaticCanvas, type StaticCanvasHandle } from './renderer/StaticCanvas';
import { InteractiveCanvas, type InteractiveCanvasHandle } from './renderer/InteractiveCanvas';
import { useCanvasEvents } from './tools/useCanvasEvents';
import { Toolbar } from './components/Toolbar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { TopBar } from './components/TopBar';
import { TextEditor } from './components/TextEditor';
import { loadFromDB, debouncedSave } from './storage/persistence';
import type { ExcalidrawElement } from './types';
import { ContextMenu } from './components/ContextMenu';
import { CommandPalette } from './components/CommandPalette';

export default function App() {
  const { state, dispatch } = useAppContext();

  // Canvas refs
  const interactiveCanvasElRef = useRef<HTMLCanvasElement | null>(null);
  const staticCanvasHandleRef = useRef<StaticCanvasHandle | null>(null);
  const interactiveCanvasHandleRef = useRef<InteractiveCanvasHandle | null>(null);
  const activeElementRef = useRef<ExcalidrawElement | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showCommands, setShowCommands] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hook up all canvas events
  useCanvasEvents(
    interactiveCanvasElRef,
    activeElementRef,
    staticCanvasHandleRef,
    interactiveCanvasHandleRef,
  );

  // ── Load saved data on mount ───────────────
  useEffect(() => {
    loadFromDB().then((data) => {
      if (data.elements && data.elements.length > 0) {
        dispatch({ type: 'SET_ELEMENTS', elements: data.elements });
      }
      if (data.viewport) {
        dispatch({ type: 'SET_VIEWPORT', viewport: data.viewport });
      }
      if (data.theme) {
        dispatch({ type: 'SET_THEME', theme: data.theme });
      }
      if (data.canvasBackground) dispatch({ type: 'SET_CANVAS_BACKGROUND', color: data.theme === 'dark' && data.canvasBackground === '#ffffff' ? '#121212' : data.canvasBackground });
    }).finally(() => setHydrated(true));
  }, [dispatch]);

  // ── Auto-save on changes ───────────────────
  useEffect(() => {
    if (!hydrated) return;
    debouncedSave({
      elements: state.elements,
      viewport: state.viewport,
      theme: state.theme,
      canvasBackground: state.canvasBackground,
    });
  }, [hydrated, state.elements, state.viewport, state.theme, state.canvasBackground]);

  // ── Apply theme to document ────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--bg-canvas', state.canvasBackground);
  }, [state.canvasBackground]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && (event.key === '/' || event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        setShowCommands(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Handle text element submission ─────────
  const handleTextSubmit = useCallback(
    (element: ExcalidrawElement) => {
      dispatch({ type: 'SNAPSHOT' });
      dispatch({ type: 'ADD_ELEMENT', element });
    },
    [dispatch],
  );

  // ── Handle JSON import ─────────────────────
  const handleImport = useCallback(
    (elements: ExcalidrawElement[]) => {
      dispatch({ type: 'SNAPSHOT' });
      dispatch({ type: 'SET_ELEMENTS', elements });
    },
    [dispatch],
  );

  // ── Capture the interactive canvas DOM element ──
  const setInteractiveCanvasRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      interactiveCanvasElRef.current = node;
    },
    [],
  );

  return (
    <div className="app-container">
      {/* Canvas layers */}
      <div className="canvas-wrapper">
        <StaticCanvas
          ref={staticCanvasHandleRef}
          activeElementRef={activeElementRef}
        />
        <InteractiveCanvas ref={interactiveCanvasHandleRef} />
        {/* Invisible canvas element ref for event binding */}
        <canvas
          ref={setInteractiveCanvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 3,
            background: 'transparent',
            pointerEvents: state.editingTextId ? 'none' : 'auto',
          }}
          onContextMenu={(event) => { event.preventDefault(); setContextMenu({ x: event.clientX, y: event.clientY }); }}
        />
        {/* Text editing overlay */}
        <TextEditor viewport={state.viewport} onSubmit={handleTextSubmit} />
      </div>

      {/* UI overlays */}
      <TopBar onImport={handleImport} />
      <Toolbar />
      <PropertiesPanel />
      {contextMenu && <ContextMenu {...contextMenu} onClose={() => setContextMenu(null)} />}
      {showCommands && <CommandPalette onClose={() => setShowCommands(false)} />}
      {!hydrated && <div className="canvas-loading" role="status">Restoring drawing…</div>}
    </div>
  );
}
