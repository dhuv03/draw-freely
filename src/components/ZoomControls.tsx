import { useAppContext } from '../AppContext';
import { ZOOM_LIMITS } from '../constants';

export function ZoomControls() {
  const { state, dispatch } = useAppContext();
  const setZoom = (zoom: number) => dispatch({ type: 'SET_VIEWPORT', viewport: { zoom: Math.max(ZOOM_LIMITS.min, Math.min(ZOOM_LIMITS.max, zoom)) } });
  return <div className="zoom-controls glass-panel" aria-label="Zoom controls">
    <button onClick={() => setZoom(state.viewport.zoom - .1)} aria-label="Zoom out">−</button>
    <button onClick={() => dispatch({ type: 'SET_VIEWPORT', viewport: { zoom: 1, scrollX: 0, scrollY: 0 } })} aria-label="Reset zoom">{Math.round(state.viewport.zoom * 100)}%</button>
    <button onClick={() => setZoom(state.viewport.zoom + .1)} aria-label="Zoom in">+</button>
  </div>;
}
