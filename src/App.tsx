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
import { SettingsModal } from './components/SettingsModal';
import { WorkspacePanel } from './components/WorkspacePanel';
import { ZoomControls } from './components/ZoomControls';
import { getThemeCanvas } from './constants';

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
  const [showSettings, setShowSettings] = useState(false);

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
      if (data.layers?.length) dispatch({ type: 'SET_LAYERS', layers: data.layers, activeLayerId: data.activeLayerId });
      if (data.viewport) {
        dispatch({ type: 'SET_VIEWPORT', viewport: data.viewport });
      }
      const themeId = data.themeId || 'slate';
      const appearanceMode = data.appearanceMode || data.theme || 'system';
      const resolvedTheme = appearanceMode === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : appearanceMode;
      dispatch({ type: 'SET_THEME_ID', themeId, appearance: resolvedTheme, canvasBackground: data.canvasBackground || getThemeCanvas(themeId, resolvedTheme) });
      dispatch({ type: 'SET_APPEARANCE_MODE', mode: appearanceMode, resolvedTheme, canvasBackground: data.canvasBackground || getThemeCanvas(themeId, resolvedTheme) });
      if (typeof data.toolLocked === 'boolean') dispatch({ type: 'SET_TOOL_LOCKED', locked: data.toolLocked });
      if (data.canvasPattern) dispatch({ type: 'SET_CANVAS_PATTERN', pattern: data.canvasPattern });
      if (data.hiddenTools) dispatch({ type: 'SET_HIDDEN_TOOLS', tools: data.hiddenTools });
      if (data.toolbarOrientation) dispatch({ type: 'SET_TOOLBAR_ORIENTATION', orientation: data.toolbarOrientation });
      if (data.toolbarPosition) dispatch({ type: 'SET_TOOLBAR_POSITION', position: data.toolbarPosition });
      if (typeof data.patternOpacity === 'number') dispatch({ type: 'SET_PATTERN_OPACITY', opacity: data.patternOpacity });
    }).finally(() => setHydrated(true));
  }, [dispatch]);

  // ── Auto-save on changes ───────────────────
  useEffect(() => {
    if (!hydrated) return;
    debouncedSave({
      elements: state.elements,
      layers: state.layers,
      activeLayerId: state.activeLayerId,
      viewport: state.viewport,
      theme: state.theme,
      appearanceMode: state.appearanceMode,
      canvasBackground: state.canvasBackground,
      themeId: state.themeId,
      toolLocked: state.toolLocked,
      canvasPattern: state.canvasPattern,
      hiddenTools: state.hiddenTools,
      toolbarOrientation: state.toolbarOrientation,
      toolbarPosition: state.toolbarPosition,
      patternOpacity: state.patternOpacity,
    });
  }, [hydrated, state.elements, state.layers, state.activeLayerId, state.viewport, state.theme, state.appearanceMode, state.canvasBackground, state.themeId, state.toolLocked, state.canvasPattern, state.hiddenTools, state.toolbarOrientation, state.toolbarPosition, state.patternOpacity]);

  useEffect(() => {
    if (!hydrated || state.appearanceMode !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystemAppearance = () => {
      const resolvedTheme = media.matches ? 'dark' : 'light';
      dispatch({ type: 'SET_APPEARANCE_MODE', mode: 'system', resolvedTheme, canvasBackground: getThemeCanvas(state.themeId, resolvedTheme) });
    };
    media.addEventListener('change', syncSystemAppearance);
    return () => media.removeEventListener('change', syncSystemAppearance);
  }, [dispatch, hydrated, state.appearanceMode, state.themeId]);

  // ── Apply theme to document ────────────────
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
    document.documentElement.setAttribute('data-color-theme', state.themeId);
  }, [state.theme, state.themeId]);

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
      <WorkspacePanel onOpenSettings={() => setShowSettings(true)} />
      <ZoomControls />
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {contextMenu && <ContextMenu {...contextMenu} onClose={() => setContextMenu(null)} />}
      {showCommands && <CommandPalette onClose={() => setShowCommands(false)} />}
      {!hydrated && <div className="canvas-loading" role="status">Restoring drawing…</div>}
    </div>
  );
}
