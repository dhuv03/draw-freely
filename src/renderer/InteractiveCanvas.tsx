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

          const selColor = '#3B82F6';
          for (const el of selectedElements) {
            const hasTwoPointsOrFewer = (el.type === 'line' || el.type === 'arrow') && el.points && el.points.length <= 2;
            if (hasTwoPointsOrFewer) continue;

            const bounds = getElementBounds(el);
            ctx.strokeStyle = selColor;
            ctx.lineWidth = 2 / viewport.zoom;
            ctx.setLineDash([]);
            ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
          }

        // For single selection, draw resize handles
        if (selectedElements.length === 1) {
          const el = selectedElements[0];
          if ((el.type === 'line' || el.type === 'arrow') && el.points && el.points.length > 0) {
            const hasTwoPointsOrFewer = el.points.length <= 2;

            if (!hasTwoPointsOrFewer) {
              const bounds = getElementBounds(el);
              drawResizeHandles(ctx, bounds, handleSize, selColor, theme, false);
            }

            // Draw vertex handles
            for (let i = 0; i < el.points.length; i++) {
              const pt = el.points[i];
              const px = el.x + pt[0];
              const py = el.y + pt[1];

              ctx.fillStyle = '#ffffff';
              ctx.strokeStyle = selColor;
              ctx.lineWidth = 2 / viewport.zoom;
              ctx.beginPath();
              ctx.arc(px, py, 6 / viewport.zoom, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }

            // Draw midpoint handles
            for (let i = 0; i < el.points.length - 1; i++) {
              const p1 = el.points[i];
              const p2 = el.points[i + 1];
              const mx = el.x + (p1[0] + p2[0]) / 2;
              const my = el.y + (p1[1] + p2[1]) / 2;

              ctx.fillStyle = 'rgba(139, 92, 246, 0.6)'; // Purple semi-transparent
              ctx.strokeStyle = '#8B5CF6';
              ctx.lineWidth = 1.5 / viewport.zoom;
              ctx.beginPath();
              ctx.arc(mx, my, 4.5 / viewport.zoom, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }
          } else {
            const bounds = getElementBounds(el);
            drawResizeHandles(ctx, bounds, handleSize, selColor, theme, el.type === 'text');

            // Draw bend handle for curved arrow
            if (el.type === 'curvedarrow') {
              const w = el.width;
              const h = el.height;
              const L = Math.hypot(w, h);
              if (L >= 1) {
                const curvature = el.curvature !== undefined ? el.curvature : (L * 0.2);
                const px = el.x + w / 2 - (h / L) * curvature;
                const py = el.y + h / 2 + (w / L) * curvature;

                ctx.fillStyle = theme === 'dark' ? '#1a1a2e' : '#ffffff';
                ctx.strokeStyle = selColor;
                ctx.lineWidth = 1.5 / viewport.zoom;
                ctx.beginPath();
                ctx.arc(px, py, 6 / viewport.zoom, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
              }
            }
          }
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
  isText: boolean,
) {
  const { x, y, width, height } = bounds;
  const handlePositions = isText
    ? [
        { handle: 'nw', x: x, y: y },
        { handle: 'ne', x: x + width, y: y },
        { handle: 'e', x: x + width, y: y + height / 2 },
        { handle: 'se', x: x + width, y: y + height },
        { handle: 'sw', x: x, y: y + height },
        { handle: 'w', x: x, y: y + height / 2 },
      ]
    : [
        { handle: 'nw', x: x, y: y },
        { handle: 'n', x: x + width / 2, y: y },
        { handle: 'ne', x: x + width, y: y },
        { handle: 'e', x: x + width, y: y + height / 2 },
        { handle: 'se', x: x + width, y: y + height },
        { handle: 's', x: x + width / 2, y: y + height },
        { handle: 'sw', x: x, y: y + height },
        { handle: 'w', x: x, y: y + height / 2 },
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
