import { useEffect } from 'react';
import { nanoid } from 'nanoid';
import { useAppContext } from '../AppContext';

interface Props { x: number; y: number; onClose: () => void; }

export function ContextMenu({ x, y, onClose }: Props) {
  const { state, dispatch } = useAppContext();
  const ids = state.selectedElementIds;
  const selected = state.elements.filter((el) => ids.includes(el.id));
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [onClose]);
  const run = (fn: () => void) => { fn(); onClose(); };
  const duplicate = () => {
    if (!selected.length) return;
    dispatch({ type: 'SNAPSHOT' });
    const copies = selected.map((el) => ({ ...el, id: nanoid(), x: el.x + 20, y: el.y + 20, groupId: undefined }));
    dispatch({ type: 'SET_ELEMENTS', elements: [...state.elements, ...copies] });
    dispatch({ type: 'SET_SELECTION', ids: copies.map((el) => el.id) });
  };
  const group = () => {
    if (selected.length < 2) return;
    dispatch({ type: 'SNAPSHOT' });
    const groupId = nanoid();
    selected.forEach((el) => dispatch({ type: 'UPDATE_ELEMENT', id: el.id, updates: { groupId } }));
  };
  return <div className="context-menu glass-panel" style={{ left: x, top: y }} onPointerDown={(e) => e.stopPropagation()} role="menu">
    <button onClick={() => run(duplicate)} disabled={!selected.length}>Duplicate <kbd>Ctrl+D</kbd></button>
    <button onClick={() => run(group)} disabled={selected.length < 2}>Group <kbd>Ctrl+G</kbd></button>
    <button onClick={() => run(() => selected.forEach((el) => dispatch({ type: 'UPDATE_ELEMENT', id: el.id, updates: { groupId: undefined } })))} disabled={!selected.some((el) => el.groupId)}>Ungroup</button>
    <button onClick={() => run(() => selected.forEach((el) => dispatch({ type: 'UPDATE_ELEMENT', id: el.id, updates: { locked: !el.locked } })))} disabled={!selected.length}>{selected.every((el) => el.locked) ? 'Unlock' : 'Lock'}</button>
    <hr />
    <button onClick={() => run(() => dispatch({ type: 'REORDER_ELEMENTS', ids, direction: 'front' }))} disabled={!selected.length}>Bring to front</button>
    <button onClick={() => run(() => dispatch({ type: 'REORDER_ELEMENTS', ids, direction: 'forward' }))} disabled={!selected.length}>Bring forward</button>
    <button onClick={() => run(() => dispatch({ type: 'REORDER_ELEMENTS', ids, direction: 'backward' }))} disabled={!selected.length}>Send backward</button>
    <button onClick={() => run(() => dispatch({ type: 'REORDER_ELEMENTS', ids, direction: 'back' }))} disabled={!selected.length}>Send to back</button>
    <hr />
    <button className="danger" onClick={() => run(() => { dispatch({ type: 'SNAPSHOT' }); dispatch({ type: 'DELETE_ELEMENTS', ids }); })} disabled={!selected.length}>Delete</button>
  </div>;
}
