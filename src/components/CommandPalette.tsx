import { useMemo, useState } from 'react';
import { useAppContext } from '../AppContext';
import type { Tool } from '../types';

interface Props { onClose: () => void; }
export function CommandPalette({ onClose }: Props) {
  const { state, dispatch } = useAppContext();
  const [query, setQuery] = useState('');
  const pageElements = state.elements.filter((element) => (element.pageId || 'page-1') === state.activePageId);
  const commands = useMemo(() => [
    ...(['select','hand','rectangle','ellipse','diamond','triangle','arrow','line','freedraw','text','eraser'] as Tool[]).map((tool) => ({ label: `Tool: ${tool}`, run: () => dispatch({ type: 'SET_TOOL', tool }) })),
    { label: 'Undo', run: () => dispatch({ type: 'UNDO' }) },
    { label: 'Redo', run: () => dispatch({ type: 'REDO' }) },
    { label: 'Select all', run: () => dispatch({ type: 'SET_SELECTION', ids: pageElements.filter((el) => !el.isDeleted && !el.locked).map((el) => el.id) }) },
    { label: 'Toggle theme', run: () => dispatch({ type: 'TOGGLE_THEME' }) },
    { label: 'Clear selection', run: () => dispatch({ type: 'SET_SELECTION', ids: [] }) },
    ...pageElements.filter((el) => !el.isDeleted).map((element, index) => ({
      label: `Find: ${element.name || element.text?.replace(/\s+/g, ' ').slice(0, 40) || `${element.type} ${index + 1}`}`,
      run: () => {
        dispatch({ type: 'SET_TOOL', tool: 'select' });
        dispatch({ type: 'SET_SELECTION', ids: element.groupId ? pageElements.filter((el) => el.groupId === element.groupId).map((el) => el.id) : [element.id] });
        dispatch({ type: 'SET_VIEWPORT', viewport: { scrollX: window.innerWidth / 2 - (element.x + element.width / 2) * state.viewport.zoom, scrollY: window.innerHeight / 2 - (element.y + element.height / 2) * state.viewport.zoom } });
      },
    })),
  ], [dispatch, pageElements, state.viewport.zoom]);
  const shown = commands.filter((command) => command.label.toLowerCase().includes(query.toLowerCase())).slice(0, 12);
  return <div className="modal-backdrop" onPointerDown={onClose}>
    <div className="command-palette glass-panel" onPointerDown={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette">
      <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter' && shown[0]) { shown[0].run(); onClose(); } }} placeholder="Type a command…" />
      <div className="command-results">{shown.map((command) => <button key={command.label} onClick={() => { command.run(); onClose(); }}>{command.label}</button>)}</div>
    </div>
  </div>;
}
