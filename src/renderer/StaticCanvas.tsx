// ──────────────────────────────────────────────
// DrawFreely — Static Canvas (Bottom Layer)
// Renders all committed + in-progress elements
// ──────────────────────────────────────────────

import React, { useRef, useEffect, useLayoutEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import rough from 'roughjs';
import { useAppContext } from '../AppContext';
import { renderElement } from './renderElement';
import type { ExcalidrawElement } from '../types';

export interface StaticCanvasHandle {
  forceRender: () => void;
}

interface StaticCanvasProps {
  activeElementRef: React.RefObject<ExcalidrawElement | null>;
}

export const StaticCanvas = forwardRef<StaticCanvasHandle, StaticCanvasProps>(
  ({ activeElementRef }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { state } = useAppContext();

    // Keep a stable ref to the latest state for imperative renders
    const stateRef = useRef(state);
    useLayoutEffect(() => { stateRef.current = state; }, [state]);

    const render = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d')!;
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      // Resize canvas backing store for HiDPI
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      const { elements, viewport, theme, canvasBackground } = stateRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      // Canvas background
      ctx.fillStyle = canvasBackground || (theme === 'dark' ? '#0f0f1a' : '#ffffff');
      ctx.fillRect(0, 0, width, height);

      // Viewport transform: pan then zoom
      ctx.translate(viewport.scrollX, viewport.scrollY);
      ctx.scale(viewport.zoom, viewport.zoom);

      // Draw a subtle dot grid
      drawGrid(ctx, viewport, width, height, theme);

      // RoughJS canvas (shares the transformed 2D context)
      const rc = rough.canvas(canvas);

      // Render committed elements
      for (const el of elements) {
        if (el.isDeleted) continue;
        if (el.id === stateRef.current.editingTextId) continue;
        const visibleElement = theme === 'dark' && ['#000000', '#000', '#1e1e1e'].includes(el.strokeColor.toLowerCase())
          ? { ...el, strokeColor: '#e8e8f0' }
          : el;
        renderElement(ctx, visibleElement, rc);
      }

      // Render the in-progress element (being drawn right now)
      const activeEl = activeElementRef.current;
      if (activeEl) {
        const visibleActiveElement = theme === 'dark' && ['#000000', '#000', '#1e1e1e'].includes(activeEl.strokeColor.toLowerCase())
          ? { ...activeEl, strokeColor: '#e8e8f0' }
          : activeEl;
        renderElement(ctx, visibleActiveElement, rc);
      }

      ctx.restore();
    }, [activeElementRef]);

    // Re-render when state changes
    useEffect(() => {
      requestAnimationFrame(render);
    }, [render, state.elements, state.viewport, state.theme, state.canvasBackground, state.editingTextId]);

    // Handle window resize
    useEffect(() => {
      const onResize = () => requestAnimationFrame(render);
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }, [render]);

    // Expose forceRender for imperative calls during drawing
    useImperativeHandle(ref, () => ({
      forceRender: () => requestAnimationFrame(render),
    }));

    return (
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}
      />
    );
  },
);

StaticCanvas.displayName = 'StaticCanvas';

// ── Grid Drawing ─────────────────────────────
function drawGrid(
  ctx: CanvasRenderingContext2D,
  viewport: { zoom: number; scrollX: number; scrollY: number },
  screenWidth: number,
  screenHeight: number,
  theme: string,
) {
  const gridSize = 20;
  if (viewport.zoom < 0.3) return; // Don't draw grid when zoomed out too far

  const dotSize = 1;
  ctx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';

  // Compute visible range in canvas coordinates
  const startX = Math.floor((-viewport.scrollX / viewport.zoom - 10) / gridSize) * gridSize;
  const startY = Math.floor((-viewport.scrollY / viewport.zoom - 10) / gridSize) * gridSize;
  const endX = startX + screenWidth / viewport.zoom + gridSize * 2;
  const endY = startY + screenHeight / viewport.zoom + gridSize * 2;

  for (let x = startX; x < endX; x += gridSize) {
    for (let y = startY; y < endY; y += gridSize) {
      ctx.fillRect(x - dotSize / 2, y - dotSize / 2, dotSize, dotSize);
    }
  }
}
