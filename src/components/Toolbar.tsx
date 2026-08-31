import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useAppContext } from '../AppContext';
import type { Tool } from '../types';
import { exportPNG } from '../storage/persistence';

const Icon = ({ children }: { children: ReactNode }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;

const TOOL_META: Record<Tool, { label: string; shortcut: string; icon: ReactNode }> = {
  select: { label: 'Select', shortcut: 'V', icon: <Icon><path d="M5 3l14 9-7 2-3 7z" /><path d="m12 14 4 6" /></Icon> },
  hand: { label: 'Hand', shortcut: 'H', icon: <Icon><path d="M18 11V6a2 2 0 0 0-4 0v1M14 10V4a2 2 0 0 0-4 0v7M10 10.5V5a2 2 0 0 0-4 0v9" /><path d="M18 11a2 2 0 0 1 4 0v5a8 8 0 0 1-8 8h-2c-3.3 0-5.2-1.5-7-4l-1.3-2a2 2 0 0 1 3-2.5L8 16" /></Icon> },
  rectangle: { label: 'Rectangle', shortcut: 'R', icon: <Icon><rect x="3" y="4" width="18" height="16" rx="2" /></Icon> },
  ellipse: { label: 'Ellipse', shortcut: 'E', icon: <Icon><ellipse cx="12" cy="12" rx="9" ry="7" /></Icon> },
  diamond: { label: 'Diamond', shortcut: 'D', icon: <Icon><path d="m12 2 10 10-10 10L2 12z" /></Icon> },
  triangle: { label: 'Triangle', shortcut: 'G', icon: <Icon><path d="m12 3 10 18H2z" /></Icon> },
  arrow: { label: 'Arrow', shortcut: 'A', icon: <Icon><path d="M5 19 19 5M12 5h7v7" /></Icon> },
  curvedarrow: { label: 'Curved arrow', shortcut: 'C', icon: <Icon><path d="M4 19C8 8 13 5 20 5" /><path d="m15 2 5 3-3 5" /></Icon> },
  elbowarrow: { label: 'Elbow arrow', shortcut: 'Q', icon: <Icon><path d="M4 18h8V6h8" /><path d="m16 2 4 4-4 4" /></Icon> },
  line: { label: 'Line', shortcut: 'L', icon: <Icon><path d="m5 19 14-14" /></Icon> },
  freedraw: { label: 'Pencil', shortcut: 'P', icon: <Icon><path d="m17 3 4 4L7.5 20.5 2 22l1.5-5.5zM15 5l4 4" /></Icon> },
  text: { label: 'Text', shortcut: 'T', icon: <Icon><path d="M4 7V4h16v3M9 20h6M12 4v16" /></Icon> },
  eraser: { label: 'Eraser', shortcut: 'X', icon: <Icon><path d="m20 20H7l-4-4L14.6 1.6a2 2 0 0 1 2.8 0l5 5a2 2 0 0 1 0 2.8L12 20M6 11l5 5" /></Icon> },
};

const PRIMARY: Tool[] = ['select', 'hand', 'freedraw', 'text', 'eraser'];
const SHAPES: Tool[] = ['rectangle', 'ellipse', 'diamond', 'triangle', 'line', 'arrow', 'curvedarrow', 'elbowarrow'];

export function Toolbar() {
  const { state, dispatch } = useAppContext();
  const [showShapes, setShowShapes] = useState(false);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const shapeActive = SHAPES.includes(state.activeTool);

  const chooseTool = (tool: Tool) => {
    if (state.activeTool === tool) dispatch({ type: 'SET_PROPERTIES_OPEN', open: !state.propertiesOpen });
    else { dispatch({ type: 'SET_TOOL', tool }); dispatch({ type: 'SET_PROPERTIES_OPEN', open: true }); }
    if (SHAPES.includes(tool)) setShowShapes(false);
  };
  const clampPosition = useCallback((x: number, y: number) => {
    const rect = toolbarRef.current?.getBoundingClientRect();
    const width = rect?.width || 54;
    const height = rect?.height || 54;
    const reservedRight = window.innerWidth > 900 ? 82 : 8;
    return {
      x: Math.max(8, Math.min(Math.max(8, window.innerWidth - width - reservedRight), x)),
      y: Math.max(12, Math.min(Math.max(12, window.innerHeight - height - 12), y)),
    };
  }, []);
  useLayoutEffect(() => {
    const recover = () => {
      if (window.innerWidth <= 900) return;
      const next = clampPosition(state.toolbarPosition.x, state.toolbarPosition.y);
      if (next.x !== state.toolbarPosition.x || next.y !== state.toolbarPosition.y) dispatch({ type:'SET_TOOLBAR_POSITION', position:next });
    };
    recover();
    window.addEventListener('resize', recover);
    return () => window.removeEventListener('resize', recover);
  }, [clampPosition, dispatch, state.toolbarPosition.x, state.toolbarPosition.y]);
  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => { event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { dx: event.clientX - state.toolbarPosition.x, dy: event.clientY - state.toolbarPosition.y }; };
  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => { if (!dragRef.current) return; dispatch({ type: 'SET_TOOLBAR_POSITION', position: clampPosition(event.clientX - dragRef.current.dx, event.clientY - dragRef.current.dy) }); };

  const renderTool = (tool: Tool) => {
    if (state.hiddenTools.includes(tool)) return null;
    const meta = TOOL_META[tool];
    return <button key={tool} className={`toolbar-btn ${state.activeTool === tool ? 'active' : ''}`} onClick={() => chooseTool(tool)} aria-label={`${meta.label} (${meta.shortcut})`} aria-pressed={state.activeTool === tool} title={`${meta.label} (${meta.shortcut})`}>{meta.icon}<span className="toolbar-tooltip">{meta.label}<span className="shortcut">{meta.shortcut}</span></span></button>;
  };

  return <div ref={toolbarRef} className={`toolbar glass-panel toolbar-${state.toolbarOrientation}`} style={{ left: state.toolbarPosition.x, top: state.toolbarPosition.y }} role="toolbar" aria-label="Drawing tools">
    <button className="toolbar-drag-handle" aria-label="Move toolbar" title="Move toolbar" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => { dragRef.current = null; }}><span>⠿</span></button>
    {PRIMARY.slice(0, 3).map(renderTool)}
    <div className="shape-tool-wrap" onMouseEnter={() => setShowShapes(true)} onMouseLeave={() => setShowShapes(false)}><button className={`toolbar-btn ${shapeActive ? 'active' : ''}`} onClick={() => setShowShapes((open) => !open)} aria-expanded={showShapes} aria-label="Shapes" title="Shapes">{shapeActive ? TOOL_META[state.activeTool].icon : <Icon><rect x="3" y="4" width="8" height="8" rx="1"/><circle cx="17" cy="8" r="4"/><path d="m7 15 4 6H3zM14 20l7-7"/></Icon>}<span className="shape-caret">›</span></button>{showShapes && <div className="shape-popover glass-panel" role="menu" aria-label="Shapes">{SHAPES.filter((tool) => !state.hiddenTools.includes(tool)).map((tool) => <button key={tool} onClick={() => chooseTool(tool)} className={state.activeTool === tool ? 'active' : ''} title={TOOL_META[tool].label}>{TOOL_META[tool].icon}<span>{TOOL_META[tool].label}</span></button>)}</div>}</div>
    {PRIMARY.slice(3).map(renderTool)}
    <div className="toolbar-separator toolbar-action-separator" />
    <button className="toolbar-btn toolbar-action" onClick={() => dispatch({ type:'UNDO' })} disabled={!state.history.past.length} aria-label="Undo"><Icon><path d="M3 7v6h6"/><path d="M5.5 17a9 9 0 1 0 .5-10L3 10"/></Icon></button>
    <button className="toolbar-btn toolbar-action" onClick={() => dispatch({ type:'REDO' })} disabled={!state.history.future.length} aria-label="Redo"><Icon><path d="M21 7v6h-6"/><path d="M18.5 17a9 9 0 1 1-.5-10l3 3"/></Icon></button>
    <button className="toolbar-btn toolbar-action" onClick={() => exportPNG(state.elements, state.theme)} aria-label="Download PNG"><Icon><path d="M12 3v12m0 0 5-5m-5 5-5-5M4 19h16"/></Icon></button>
  </div>;
}
