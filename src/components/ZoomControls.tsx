import { useAppContext } from '../AppContext';
import { ZOOM_LIMITS } from '../constants';
import { getElementBounds } from '../renderer/renderElement';

export function ZoomControls() {
  const { state, dispatch } = useAppContext();
  const contentBounds = () => {
    const bounds = state.elements.filter((element) => !element.isDeleted).map(getElementBounds);
    if (!bounds.length) return null;
    const minX = Math.min(...bounds.map((bound) => bound.x));
    const minY = Math.min(...bounds.map((bound) => bound.y));
    const maxX = Math.max(...bounds.map((bound) => bound.x + bound.width));
    const maxY = Math.max(...bounds.map((bound) => bound.y + bound.height));
    return { minX, minY, maxX, maxY };
  };
  const setZoom = (requestedZoom: number) => {
    const zoom = Math.max(ZOOM_LIMITS.min, Math.min(ZOOM_LIMITS.max, requestedZoom));
    const screenCenterX = window.innerWidth / 2;
    const screenCenterY = window.innerHeight / 2;
    const canvasCenterX = (screenCenterX - state.viewport.scrollX) / state.viewport.zoom;
    const canvasCenterY = (screenCenterY - state.viewport.scrollY) / state.viewport.zoom;
    dispatch({ type: 'SET_VIEWPORT', viewport: {
      zoom,
      scrollX: screenCenterX - canvasCenterX * zoom,
      scrollY: screenCenterY - canvasCenterY * zoom,
    } });
  };
  const centerContentAt = (zoom: number) => {
    const bounds = contentBounds();
    if (!bounds) { dispatch({ type:'SET_VIEWPORT', viewport:{ zoom, scrollX:0, scrollY:0 } }); return; }
    dispatch({ type:'SET_VIEWPORT', viewport:{
      zoom,
      scrollX: window.innerWidth / 2 - (bounds.minX + bounds.maxX) / 2 * zoom,
      scrollY: window.innerHeight / 2 - (bounds.minY + bounds.maxY) / 2 * zoom,
    } });
  };
  const scrollToContent = () => {
    const bounds = contentBounds();
    if (!bounds) { centerContentAt(1); return; }
    const { minX, minY, maxX, maxY } = bounds;
    const availableWidth = Math.max(160, window.innerWidth - 120); const availableHeight = Math.max(160, window.innerHeight - 150);
    const zoom = Math.max(ZOOM_LIMITS.min, Math.min(ZOOM_LIMITS.max, Math.min(availableWidth / Math.max(1, maxX - minX), availableHeight / Math.max(1, maxY - minY))));
    dispatch({ type:'SET_VIEWPORT', viewport:{ zoom, scrollX:window.innerWidth / 2 - (minX + maxX) / 2 * zoom, scrollY:window.innerHeight / 2 - (minY + maxY) / 2 * zoom } });
  };
  const bounds = contentBounds();
  const isContentOffscreen = !!bounds && (
    bounds.maxX * state.viewport.zoom + state.viewport.scrollX < 0 ||
    bounds.minX * state.viewport.zoom + state.viewport.scrollX > window.innerWidth ||
    bounds.maxY * state.viewport.zoom + state.viewport.scrollY < 0 ||
    bounds.minY * state.viewport.zoom + state.viewport.scrollY > window.innerHeight
  );
  return <div className="zoom-cluster">
    {isContentOffscreen && <button className="scroll-back-to-content glass-panel" onClick={() => centerContentAt(state.viewport.zoom)}>Scroll back to content</button>}
    <div className="zoom-controls glass-panel" aria-label="Zoom controls">
    <button onClick={() => setZoom(state.viewport.zoom - .1)} aria-label="Zoom out">−</button>
    <button onClick={() => centerContentAt(1)} aria-label="Reset zoom">{Math.round(state.viewport.zoom * 100)}%</button>
    <button onClick={() => setZoom(state.viewport.zoom + .1)} aria-label="Zoom in">+</button>
    <button onClick={scrollToContent} aria-label="Scroll to content" title="Fit drawing to screen">⌖</button>
    </div>
  </div>;
}
