// ──────────────────────────────────────────────
// DrawFreely — Interactive Canvas (Top Layer)
// Draws selection UI: bounding boxes, resize handles, rubber band
// ──────────────────────────────────────────────

import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useAppContext } from '../AppContext';
import { getElementBounds } from './renderElement';
import { HANDLE_SIZE } from '../constants';

export interface InteractiveCanvasHandle {
  render: (rubberBand?: { x: number; y: number; width: number; height: number } | null) => void;
}

export const InteractiveCanvas = forwardRef<InteractiveCanvasHandle, object>(
  (_props, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { state } = useAppContext();
    const stateRef = useRef(state);
    stateRef.current = state;
    const rubberBandRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

    const render = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d')!;
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      const { elements, selectedElementIds, viewport, theme } = stateRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.translate(viewport.scrollX, viewport.scrollY);
      ctx.scale(viewport.zoom, viewport.zoom);

      const selColor = theme === 'dark' ? '#6b9fff' : '#4f8df7';
      const handleSize = HANDLE_SIZE / viewport.zoom;
      const lineWidth = 1.5 / viewport.zoom;

      // Draw selection bounding boxes and handles
      if (selectedElementIds.length > 0) {
        const selectedElements = elements.filter((el) =>
          selectedElementIds.includes(el.id) && !el.isDeleted,
        );

          for (const el of selectedElements) {
            const bounds = getElementBounds(el);
            const selColor = '#3B82F6';
            ctx.strokeStyle = selColor;
            ctx.lineWidth = 2 / viewport.zoom;
            ctx.setLineDash([]);
            ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
          }

        // For single selection, draw resize handles
        if (selectedElements.length === 1) {
          const bounds = getElementBounds(selectedElements[0]);
          drawResizeHandles(ctx, bounds, handleSize, selColor, theme);
        }

        // For multi-selection, draw combined bounding box
        if (selectedElements.length > 1) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const el of selectedElements) {
            const b = getElementBounds(el);
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.width);
            maxY = Math.max(maxY, b.y + b.height);
          }
          ctx.strokeStyle = selColor;
          ctx.lineWidth = lineWidth;
          ctx.setLineDash([6 / viewport.zoom, 4 / viewport.zoom]);
          ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
          ctx.setLineDash([]);
        }
      }

      // Draw rubber band selection
      const rb = rubberBandRef.current;
      if (rb) {
        ctx.fillStyle = `${selColor}15`;
        ctx.strokeStyle = selColor;
        ctx.lineWidth = lineWidth;
        const rx = Math.min(rb.x, rb.x + rb.width);
        const ry = Math.min(rb.y, rb.y + rb.height);
        const rw = Math.abs(rb.width);
        const rh = Math.abs(rb.height);
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeRect(rx, ry, rw, rh);
      }

      ctx.restore();
    }, [state.selectedElementIds, state.elements, state.viewport, state.theme]);

    useEffect(() => {
      requestAnimationFrame(render);
    }, [render]);

    useEffect(() => {
      const onResize = () => requestAnimationFrame(render);
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }, [render]);

    useImperativeHandle(ref, () => ({
      render: (rubberBand) => {
        rubberBandRef.current = rubberBand || null;
        requestAnimationFrame(render);
      },
    }));

    return (
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 2,
        }}
      />
    );
  },
);

InteractiveCanvas.displayName = 'InteractiveCanvas';

// ── Resize Handles ───────────────────────────
function drawResizeHandles(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; width: number; height: number },
  size: number,
  color: string,
  theme: string,
) {
  const { x, y, width, height } = bounds;
  const handlePositions = [
    { x: x, y: y },                                    // nw
    { x: x + width / 2, y: y },                        // n
    { x: x + width, y: y },                            // ne
    { x: x + width, y: y + height / 2 },               // e
    { x: x + width, y: y + height },                   // se
    { x: x + width / 2, y: y + height },               // s
    { x: x, y: y + height },                           // sw
    { x: x, y: y + height / 2 },                       // w
  ];

  const fillColor = theme === 'dark' ? '#1a1a2e' : '#ffffff';

  for (const pos of handlePositions) {
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 / (ctx.getTransform().a || 1); // account for current scale
    ctx.fillRect(pos.x - size / 2, pos.y - size / 2, size, size);
    ctx.strokeRect(pos.x - size / 2, pos.y - size / 2, size, size);
  }
}
