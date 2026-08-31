import { useAppContext } from '../AppContext';
import { ZOOM_LIMITS } from '../constants';
import { getElementBounds } from '../renderer/renderElement';

export function ZoomControls() {
  const { state, dispatch } = useAppContext();
  const setZoom = (zoom: number) => dispatch({ type: 'SET_VIEWPORT', viewport: { zoom: Math.max(ZOOM_LIMITS.min, Math.min(ZOOM_LIMITS.max, zoom)) } });
  const scrollToContent = () => {
    const visible = state.elements.filter((element) => !element.isDeleted);
    if (!visible.length) { dispatch({ type:'SET_VIEWPORT', viewport:{ zoom:1, scrollX:0, scrollY:0 } }); return; }
    const bounds = visible.map(getElementBounds);
    const minX = Math.min(...bounds.map((bound) => bound.x)); const minY = Math.min(...bounds.map((bound) => bound.y));
    const maxX = Math.max(...bounds.map((bound) => bound.x + bound.width)); const maxY = Math.max(...bounds.map((bound) => bound.y + bound.height));
    const availableWidth = Math.max(160, window.innerWidth - 120); const availableHeight = Math.max(160, window.innerHeight - 150);
    const zoom = Math.max(ZOOM_LIMITS.min, Math.min(ZOOM_LIMITS.max, Math.min(availableWidth / Math.max(1, maxX - minX), availableHeight / Math.max(1, maxY - minY))));
    dispatch({ type:'SET_VIEWPORT', viewport:{ zoom, scrollX:window.innerWidth / 2 - (minX + maxX) / 2 * zoom, scrollY:window.innerHeight / 2 - (minY + maxY) / 2 * zoom } });
  };
  return <div className="zoom-controls glass-panel" aria-label="Zoom controls">
    <button onClick={() => setZoom(state.viewport.zoom - .1)} aria-label="Zoom out">−</button>
    <button onClick={() => dispatch({ type: 'SET_VIEWPORT', viewport: { zoom: 1, scrollX: 0, scrollY: 0 } })} aria-label="Reset zoom">{Math.round(state.viewport.zoom * 100)}%</button>
    <button onClick={() => setZoom(state.viewport.zoom + .1)} aria-label="Zoom in">+</button>
    <button onClick={scrollToContent} aria-label="Scroll to content" title="Fit drawing to screen">⌖</button>
  </div>;
}
