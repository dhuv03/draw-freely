// ??????????????????????????????????????????????
// DrawFreely ? Master Canvas Event Handler
// All tool logic: select, shapes, line, arrow,
// freedraw, text, eraser, hand, pan, zoom
// ??????????????????????????????????????????????

import { useCallback, useEffect, useRef } from 'react';
import { useAppContext } from '../AppContext';
import type { ExcalidrawElement, Point, Tool } from '../types';
import {
  ZOOM_LIMITS,
  KEYBOARD_SHORTCUTS,
} from '../constants';
import {
  hitTestAll,
  hitTestResizeHandles,
  getElementsInRect,
  type ResizeHandle,
} from './hitTest';
import { getElementBounds } from '../renderer/renderElement';
import { nanoid } from 'nanoid';
import type { StaticCanvasHandle } from '../renderer/StaticCanvas';
import type { InteractiveCanvasHandle } from '../renderer/InteractiveCanvas';

// ?? Pointer State (ref, not React state) ?????
interface PointerState {
  isDown: boolean;
  startCanvas: Point;
  lastCanvas: Point;
  startScreen: Point;
  action: 'none' | 'drawing' | 'moving' | 'resizing' | 'panning' | 'rubberband' | 'erasing';
  resizeHandle: ResizeHandle | null;
  movedElements: Map<string, { x: number; y: number }>;
  spaceHeld: boolean;
  hasMoved: boolean;
}

function initialPointerState(): PointerState {
  return {
    isDown: false,
    startCanvas: { x: 0, y: 0 },
    lastCanvas: { x: 0, y: 0 },
    startScreen: { x: 0, y: 0 },
    action: 'none',
    resizeHandle: null,
    movedElements: new Map(),
    spaceHeld: false,
    hasMoved: false,
  };
}

// ?? Hook ?????????????????????????????????????
export function useCanvasEvents(
  interactiveCanvasRef: React.RefObject<HTMLCanvasElement | null>,
  activeElementRef: React.MutableRefObject<ExcalidrawElement | null>,
  staticCanvasHandle: React.RefObject<StaticCanvasHandle | null>,
  interactiveCanvasHandle: React.RefObject<InteractiveCanvasHandle | null>,
) {
  const { state, dispatch } = useAppContext();
  const stateRef = useRef(state);
  stateRef.current = state;
  const ps = useRef<PointerState>(initialPointerState());

  // ?? Coordinate conversion ??????????????????
  const screenToCanvas = useCallback((sx: number, sy: number): Point => {
    const { zoom, scrollX, scrollY } = stateRef.current.viewport;
    return { x: (sx - scrollX) / zoom, y: (sy - scrollY) / zoom };
  }, []);

  // ?? Create a new element ???????????????????
  const createElement = useCallback(
    (type: ExcalidrawElement['type'], x: number, y: number): ExcalidrawElement => ({
      angle: 0,
      strokeColor: '#000000',
      fillColor: 'transparent',
      strokeWidth: 2,
      strokeStyle: 'solid',
      roughness: 1,
      opacity: 100,
      fillStyle: 'hachure',
      ...stateRef.current.defaultElementProps,
      id: nanoid(),
      type,
      x, y,
      width: 0,
      height: 0,
      seed: Math.floor(Math.random() * 100000),
      points: type === 'freedraw' ? [[0, 0, 0.5]] : (type === 'line' || type === 'arrow') ? [[0, 0, 0], [0, 0, 0]] : undefined,
      endArrowhead: ['arrow', 'curvedarrow', 'elbowarrow'].includes(type) ? 'arrow' : null,
      startArrowhead: null,
      curvature: type === 'curvedarrow' ? 30 : undefined,
    } as ExcalidrawElement),
    [],
  );

  // ?? Force renders ??????????????????????????
  const forceStaticRender = useCallback(() => {
    staticCanvasHandle.current?.forceRender();
  }, [staticCanvasHandle]);

  const forceInteractiveRender = useCallback(
    (rubberBand?: { x: number; y: number; width: number; height: number } | null) => {
      interactiveCanvasHandle.current?.render(rubberBand);
    },
    [interactiveCanvasHandle],
  );

  // ??????????????????????????????????????????
  // POINTER DOWN
  // ??????????????????????????????????????????
  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      const canvas = interactiveCanvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const cp = screenToCanvas(sx, sy);
      const s = stateRef.current;
      const p = ps.current;
      const tool = s.activeTool;

      // Text tool: open editor without capturing pointer (allows textarea interaction)
      if (tool === 'text' && e.button === 0) {
        const hit = hitTestAll(s.elements, cp);
        if (hit && hit.type === 'text') {
          dispatch({ type: 'SET_EDITING_TEXT', id: hit.id, clickPoint: cp });
        } else {
          dispatch({
            type: 'SET_EDITING_TEXT',
            id: JSON.stringify({ x: cp.x, y: cp.y }),
            clickPoint: cp,
          });
        }
        return;
      }

      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

      p.isDown = true;
      p.startCanvas = cp;
      p.lastCanvas = cp;
      p.startScreen = { x: sx, y: sy };
      p.hasMoved = false;

      // Middle-click or space-held ? pan
      if (e.button === 1 || p.spaceHeld || tool === 'hand') {
        p.action = 'panning';
        canvas.style.cursor = 'grabbing';
        return;
      }

      // SELECT TOOL
      if (tool === 'select') {
        // Check curved arrow bending handle first
        if (s.selectedElementIds.length === 1) {
          const selEl = s.elements.find((el) => el.id === s.selectedElementIds[0]);
          if (selEl && selEl.type === 'curvedarrow') {
            const w = selEl.width;
            const h = selEl.height;
            const L = Math.hypot(w, h);
            if (L >= 1) {
              const curvature = selEl.curvature !== undefined ? selEl.curvature : (L * 0.2);
              const px = selEl.x + w / 2 - (h / L) * curvature;
              const py = selEl.y + h / 2 + (w / L) * curvature;

              const hs = 8 / s.viewport.zoom;
              if (Math.abs(cp.x - px) <= hs && Math.abs(cp.y - py) <= hs) {
                dispatch({ type: 'SNAPSHOT' });
                p.action = 'bending' as any;
                return;
              }
            }
          }
        }

        // Check selected line vertex or midpoint handles
        if (s.selectedElementIds.length === 1) {
          const selEl = s.elements.find((el) => el.id === s.selectedElementIds[0]);
          if (selEl && (selEl.type === 'line' || selEl.type === 'arrow') && selEl.points && selEl.points.length > 0) {
            const hs = 8 / s.viewport.zoom;

            // 1. Check vertex handles
            for (let i = 0; i < selEl.points.length; i++) {
              const pt = selEl.points[i];
              const px = selEl.x + pt[0];
              const py = selEl.y + pt[1];
              if (Math.abs(cp.x - px) <= hs && Math.abs(cp.y - py) <= hs) {
                dispatch({ type: 'SNAPSHOT' });
                p.action = 'vertex_dragging' as any;
                (p as any).draggedLineId = selEl.id;
                (p as any).draggedVertexIndex = i;
                return;
              }
            }

            // 2. Check midpoint handles
            for (let i = 0; i < selEl.points.length - 1; i++) {
              const p1 = selEl.points[i];
              const p2 = selEl.points[i + 1];
              const mx = selEl.x + (p1[0] + p2[0]) / 2;
              const my = selEl.y + (p1[1] + p2[1]) / 2;
              if (Math.abs(cp.x - mx) <= hs && Math.abs(cp.y - my) <= hs) {
                dispatch({ type: 'SNAPSHOT' });
                
                // Create a new vertex at the midpoint
                const newPoints = [...selEl.points];
                const newPt: [number, number, number] = [mx - selEl.x, my - selEl.y, 0];
                newPoints.splice(i + 1, 0, newPt);

                dispatch({
                  type: 'UPDATE_ELEMENT',
                  id: selEl.id,
                  updates: { points: newPoints }
                });

                p.action = 'vertex_dragging' as any;
                (p as any).draggedLineId = selEl.id;
                (p as any).draggedVertexIndex = i + 1;
                return;
              }
            }
          }
        }

        // 1. Check resize handles on selected element
        if (s.selectedElementIds.length === 1) {
          const selEl = s.elements.find((el) => el.id === s.selectedElementIds[0]);
          if (selEl) {
            const bounds = getElementBounds(selEl);
            const handle = hitTestResizeHandles(bounds, cp, s.viewport.zoom, selEl.type === 'text');
            if (handle) {
              dispatch({ type: 'SNAPSHOT' });
              p.action = 'resizing';
              p.resizeHandle = handle;
              p.movedElements.set(selEl.id, { x: selEl.x, y: selEl.y });
              // Store starting sizes for text scaling/wrapping and custom curves:
              (p as any).startWidth = selEl.width;
              (p as any).startHeight = bounds.height;
              (p as any).startFontSize = selEl.fontSize || 20;
              return;
            }
          }
        }

        // 2. Hit test elements
        const hit = hitTestAll(s.elements, cp);
        if (hit) {
          const isAlreadySelected = s.selectedElementIds.includes(hit.id);
          if (e.shiftKey) {
            // Toggle selection
            const newIds = isAlreadySelected
              ? s.selectedElementIds.filter((id) => id !== hit.id)
              : [...s.selectedElementIds, hit.id];
            dispatch({ type: 'SET_SELECTION', ids: newIds });
          } else if (!isAlreadySelected) {
            dispatch({ type: 'SET_SELECTION', ids: [hit.id] });
          }
          // Prepare to move
          dispatch({ type: 'SNAPSHOT' });
          p.action = 'moving';
          // Store starting positions of all selected elements
          const selectedIds = e.shiftKey && !s.selectedElementIds.includes(hit.id)
            ? [...s.selectedElementIds, hit.id]
            : s.selectedElementIds.includes(hit.id)
              ? s.selectedElementIds
              : [hit.id];
          p.movedElements.clear();
          for (const id of selectedIds) {
            const el = s.elements.find((el) => el.id === id);
            if (el) p.movedElements.set(id, { x: el.x, y: el.y });
          }
          return;
        }

        // 3. Empty space ? rubber band selection
        if (!e.shiftKey) {
          dispatch({ type: 'SET_SELECTION', ids: [] });
        }
        p.action = 'rubberband';
        return;
      }

      // ?? SHAPE TOOLS ?????????????????????
      if (['rectangle', 'ellipse', 'diamond'].includes(tool)) {
        dispatch({ type: 'SNAPSHOT' });
        const el = createElement(tool as ExcalidrawElement['type'], cp.x, cp.y);
        activeElementRef.current = el;
        p.action = 'drawing';
        return;
      }

      // ?? LINE / ARROW ????????????????????
      if (tool === 'line' || tool === 'arrow') {
        dispatch({ type: 'SNAPSHOT' });
        let typeToCreate: ExcalidrawElement['type'] = tool as ExcalidrawElement['type'];
        if (tool === 'arrow') {
          const arrowType = s.defaultElementProps.arrowType;
          if (arrowType === 'curved') typeToCreate = 'curvedarrow';
          else if (arrowType === 'elbow') typeToCreate = 'elbowarrow';
        }
        const el = createElement(typeToCreate, cp.x, cp.y);
        activeElementRef.current = el;
        p.action = 'drawing';
        return;
      }

      // FREEDRAW
      if (tool === 'freedraw') {
        dispatch({ type: 'SNAPSHOT' });
        const el = createElement('freedraw', cp.x, cp.y);
        el.points = [[0, 0, e.pressure || 0.5]];
        activeElementRef.current = el;
        p.action = 'drawing';
        forceStaticRender();
        return;
      }

      // ERASER
      if (tool === 'eraser') {
        const hit = hitTestAll(s.elements, cp);
        if (hit) {
          dispatch({ type: 'SNAPSHOT' });
          dispatch({ type: 'DELETE_ELEMENTS', ids: [hit.id] });
        }
        p.action = 'erasing';
        return;
      }
    },
    [
      interactiveCanvasRef, screenToCanvas, dispatch,
      createElement, activeElementRef, forceStaticRender,
    ],
  );

  // ??????????????????????????????????????????
  // POINTER MOVE
  // ??????????????????????????????????????????
  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const canvas = interactiveCanvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const cp = screenToCanvas(sx, sy);
      const s = stateRef.current;
      const p = ps.current;

      // Update cursor based on tool
      if (!p.isDown) {
        updateCursor(canvas, s.activeTool, cp, s);
        return;
      }

      const dx = cp.x - p.lastCanvas.x;
      const dy = cp.y - p.lastCanvas.y;

      if (Math.abs(sx - p.startScreen.x) > 2 || Math.abs(sy - p.startScreen.y) > 2) {
        p.hasMoved = true;
      }

      // ?? PANNING ?????????????????????????
      if (p.action === 'panning') {
        const sdx = sx - p.startScreen.x;
        const sdy = sy - p.startScreen.y;
        dispatch({
          type: 'SET_VIEWPORT',
          viewport: {
            scrollX: s.viewport.scrollX + (e.movementX || sdx * 0.1),
            scrollY: s.viewport.scrollY + (e.movementY || sdy * 0.1),
          },
        });
        p.startScreen = { x: sx, y: sy };
        return;
      }

      // ?? DRAWING SHAPES / LINES ??????????
      if (p.action === 'drawing' && activeElementRef.current) {
        const el = activeElementRef.current;

        if (el.type === 'freedraw') {
          // Add point relative to element origin
          const relX = cp.x - el.x;
          const relY = cp.y - el.y;
          el.points = [...(el.points || []), [relX, relY, e.pressure || 0.5]];
        } else {
          // Update dimensions
          el.width = cp.x - p.startCanvas.x;
          el.height = cp.y - p.startCanvas.y;

          // Shift key ? constrain to square/circle or 45? lines
          if (e.shiftKey) {
            if (['rectangle', 'ellipse', 'diamond'].includes(el.type)) {
              const size = Math.max(Math.abs(el.width), Math.abs(el.height));
              el.width = Math.sign(el.width) * size;
              el.height = Math.sign(el.height) * size;
            } else if (['line', 'arrow', 'curvedarrow', 'elbowarrow'].includes(el.type)) {
              // Snap to nearest 45? angle
              const angle = Math.atan2(el.height, el.width);
              const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
              const len = Math.sqrt(el.width * el.width + el.height * el.height);
              el.width = Math.cos(snapped) * len;
              el.height = Math.sin(snapped) * len;
            }
          }
          if (el.type === 'line' || el.type === 'arrow') {
            if (el.type === 'arrow' && el.arrowType === 'curved') {
              const L = Math.hypot(el.width, el.height);
              if (L >= 1) {
                const mx = el.width / 2;
                const my = el.height / 2;
                const curvature = L * 0.15;
                const px = mx - (el.height / L) * curvature;
                const py = my + (el.width / L) * curvature;
                el.points = [
                  [0, 0, 0],
                  [px, py, 0],
                  [el.width, el.height, 0]
                ];
              } else {
                el.points = [[0, 0, 0], [el.width, el.height, 0]];
              }
            } else {
              el.points = [[0, 0, 0], [el.width, el.height, 0]];
            }
          }
        }

        activeElementRef.current = { ...el };
        forceStaticRender();
        return;
      }

      // ?? VERTEX DRAGGING (Line Element) ────────
      if (p.action === ('vertex_dragging' as any)) {
        const lineId = (p as any).draggedLineId;
        const vertexIdx = (p as any).draggedVertexIndex;
        const el = s.elements.find((e) => e.id === lineId);
        if (el && el.points) {
          const newPoints = [...el.points];
          newPoints[vertexIdx] = [cp.x - el.x, cp.y - el.y, 0];

          dispatch({
            type: 'UPDATE_ELEMENT',
            id: el.id,
            updates: { points: newPoints },
          });
          forceStaticRender();
          forceInteractiveRender();
        }
        return;
      }

      // ?? BENDING (Curved Arrow) ──────────────
      if (p.action === ('bending' as any)) {
        const selId = s.selectedElementIds[0];
        const el = s.elements.find((e) => e.id === selId);
        if (!el) return;

        const w = el.width;
        const h = el.height;
        const L = Math.hypot(w, h);
        if (L >= 1) {
          const newCurvature = ((cp.x - el.x) * (-h) + (cp.y - el.y) * w) / L;
          dispatch({
            type: 'UPDATE_ELEMENT',
            id: el.id,
            updates: { curvature: newCurvature },
          });
          forceStaticRender();
          forceInteractiveRender();
        }
        return;
      }

      // ?? MOVING ELEMENTS ?????????????????
      if (p.action === 'moving') {
        for (const [id, start] of p.movedElements) {
          dispatch({
            type: 'UPDATE_ELEMENT',
            id,
            updates: {
              x: start.x + (cp.x - p.startCanvas.x),
              y: start.y + (cp.y - p.startCanvas.y),
            },
          });
        }
        forceInteractiveRender();
        return;
      }

      // ?? RESIZING ????????????????????????
      if (p.action === 'resizing' && p.resizeHandle) {
        const selId = s.selectedElementIds[0];
        const el = s.elements.find((e) => e.id === selId);
        if (!el) return;

        const startPos = p.movedElements.get(selId);
        if (!startPos) return;

        if (el.type === 'text') {
          const startWidth = (p as any).startWidth ?? el.width;
          const startHeight = (p as any).startHeight ?? 30;
          const startFontSize = (p as any).startFontSize ?? 20;

          if (['nw', 'ne', 'se', 'sw'].includes(p.resizeHandle)) {
            // Corner handles -> scale font size
            const deltaY = p.resizeHandle.includes('s') 
              ? (cp.y - p.startCanvas.y) 
              : (p.startCanvas.y - cp.y);
            const newHeight = Math.max(20, startHeight + deltaY);
            const scale = newHeight / startHeight;
            const newFontSize = Math.max(10, Math.round(startFontSize * scale));

            const updates: Partial<ExcalidrawElement> = {
              fontSize: newFontSize,
            };

            // Scale width proportionally to prevent line wrapping change during scaling
            if (p.resizeHandle.includes('w')) {
              const deltaX = cp.x - p.startCanvas.x;
              updates.x = startPos.x + deltaX;
              updates.width = Math.max(30, startWidth - deltaX);
            } else {
              updates.width = Math.max(30, startWidth * scale);
            }

            if (p.resizeHandle.includes('n')) {
              updates.y = startPos.y + (startHeight - newHeight);
            }

            dispatch({ type: 'UPDATE_ELEMENT', id: el.id, updates });
          } else if (['e', 'w'].includes(p.resizeHandle)) {
            // Side handles -> resize wrapping width
            const updates: Partial<ExcalidrawElement> = {};
            if (p.resizeHandle === 'w') {
              const deltaX = cp.x - p.startCanvas.x;
              updates.x = startPos.x + deltaX;
              updates.width = Math.max(30, startWidth - deltaX);
            } else {
              const deltaX = cp.x - p.startCanvas.x;
              updates.width = Math.max(30, startWidth + deltaX);
            }
            dispatch({ type: 'UPDATE_ELEMENT', id: el.id, updates });
          }
        } else {
          applyResize(el, p.resizeHandle, dx, dy, dispatch);
        }
        forceStaticRender();
        forceInteractiveRender();
      }

      // ?? RUBBER BAND ????????????????????
      if (p.action === 'rubberband') {
        const rb = {
          x: p.startCanvas.x,
          y: p.startCanvas.y,
          width: cp.x - p.startCanvas.x,
          height: cp.y - p.startCanvas.y,
        };
        forceInteractiveRender(rb);

        // Select elements within rubber band
        const selected = getElementsInRect(s.elements, rb);
        dispatch({ type: 'SET_SELECTION', ids: selected.map((el) => el.id) });
        return;
      }

      // ?? ERASING ?????????????????????????
      if (p.action === 'erasing') {
        const hit = hitTestAll(s.elements, cp);
        if (hit) {
          dispatch({ type: 'DELETE_ELEMENTS', ids: [hit.id] });
        }
        return;
      }

      p.lastCanvas = cp;
    },
    [
      interactiveCanvasRef, screenToCanvas, activeElementRef, dispatch,
      forceStaticRender, forceInteractiveRender,
    ],
  );

  // ??????????????????????????????????????????
  // POINTER UP
  // ??????????????????????????????????????????
  const handlePointerUp = useCallback(
    (_e: PointerEvent) => {
      const p = ps.current;
      const canvas = interactiveCanvasRef.current;

      if (p.action === 'drawing' && activeElementRef.current) {
        const el = activeElementRef.current;

        // Only commit if the element has meaningful size
        if (
          el.type === 'freedraw'
            ? (el.points?.length || 0) > 2
            : Math.abs(el.width) > 1 || Math.abs(el.height) > 1
        ) {
          dispatch({ type: 'ADD_ELEMENT', element: { ...el } });
          // Switch back to select and select the new element
          dispatch({ type: 'SET_TOOL', tool: 'select' });
          dispatch({ type: 'SET_SELECTION', ids: [el.id] });
        }

        activeElementRef.current = null;
        forceStaticRender();
      }

      if (p.action === 'panning' && canvas) {
        canvas.style.cursor = '';
      }

      // Clear rubber band
      if (p.action === 'rubberband') {
        forceInteractiveRender(null);
      }

      // Reset pointer state
      p.isDown = false;
      p.action = 'none';
      p.resizeHandle = null;
      p.movedElements.clear();
      p.hasMoved = false;
    },
    [
      interactiveCanvasRef, activeElementRef, dispatch,
      forceStaticRender, forceInteractiveRender,
    ],
  );

  // ??????????????????????????????????????????
  // WHEEL (Zoom)
  // ??????????????????????????????????????????
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const s = stateRef.current;
      const { zoom, scrollX, scrollY } = s.viewport;

      if (e.ctrlKey || e.metaKey) {
        // Pinch zoom or Ctrl+scroll ? zoom
        const delta = -e.deltaY * 0.005;
        const newZoom = Math.max(
          ZOOM_LIMITS.min,
          Math.min(ZOOM_LIMITS.max, zoom * (1 + delta)),
        );

        // Zoom towards cursor position
        const canvas = interactiveCanvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          const zoomRatio = newZoom / zoom;
          dispatch({
            type: 'SET_VIEWPORT',
            viewport: {
              zoom: newZoom,
              scrollX: mx - (mx - scrollX) * zoomRatio,
              scrollY: my - (my - scrollY) * zoomRatio,
            },
          });
        }
      } else {
        // Regular scroll ? pan
        dispatch({
          type: 'SET_VIEWPORT',
          viewport: {
            scrollX: scrollX - e.deltaX,
            scrollY: scrollY - e.deltaY,
          },
        });
      }
    },
    [interactiveCanvasRef, dispatch],
  );

  // ??????????????????????????????????????????
  // KEYBOARD
  // ??????????????????????????????????????????
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't handle if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const s = stateRef.current;

      // Space ? toggle panning mode
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        ps.current.spaceHeld = true;
        if (interactiveCanvasRef.current) {
          interactiveCanvasRef.current.style.cursor = 'grab';
        }
        return;
      }

      // Enter ? edit selected text element
      if (e.key === 'Enter' && s.selectedElementIds.length === 1) {
        const selEl = s.elements.find((el) => el.id === s.selectedElementIds[0]);
        if (selEl && selEl.type === 'text') {
          e.preventDefault();
          dispatch({ type: 'SET_EDITING_TEXT', id: selEl.id });
          return;
        }
      }

      // Delete / Backspace ? delete selected
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.selectedElementIds.length > 0) {
        e.preventDefault();
        dispatch({ type: 'SNAPSHOT' });
        dispatch({ type: 'DELETE_ELEMENTS', ids: s.selectedElementIds });
        return;
      }

      // Ctrl+Z ? undo, Ctrl+Shift+Z or Ctrl+Y ? redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        dispatch({ type: 'REDO' });
        return;
      }

      // Ctrl+A ? select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        dispatch({
          type: 'SET_SELECTION',
          ids: s.elements.filter((el) => !el.isDeleted).map((el) => el.id),
        });
        dispatch({ type: 'SET_TOOL', tool: 'select' });
        return;
      }

      // Tool shortcuts (single key, no modifiers)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const tool = KEYBOARD_SHORTCUTS[e.key.toLowerCase()];
        if (tool) {
          e.preventDefault();
          dispatch({ type: 'SET_TOOL', tool: tool as Tool });
          return;
        }
      }

      // Escape ? deselect / switch to select
      if (e.key === 'Escape') {
        dispatch({ type: 'SET_SELECTION', ids: [] });
        dispatch({ type: 'SET_TOOL', tool: 'select' });
        dispatch({ type: 'SET_EDITING_TEXT', id: null });
        activeElementRef.current = null;
        forceStaticRender();
      }
    },
    [interactiveCanvasRef, dispatch, activeElementRef, forceStaticRender],
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        ps.current.spaceHeld = false;
        if (interactiveCanvasRef.current && !ps.current.isDown) {
          interactiveCanvasRef.current.style.cursor = '';
        }
      }
    },
    [interactiveCanvasRef],
  );

  const handleDoubleClick = useCallback(
    (e: MouseEvent) => {
      const canvas = interactiveCanvasRef.current;
      if (!canvas) return;
      const s = stateRef.current;
      if (s.activeTool !== 'select') return;

      const rect = canvas.getBoundingClientRect();
      const cp = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top);
      const hit = hitTestAll(s.elements, cp);
      if (hit?.type === 'text') {
        dispatch({ type: 'SET_EDITING_TEXT', id: hit.id, clickPoint: cp });
      } else if (!hit) {
        dispatch({
          type: 'SET_EDITING_TEXT',
          id: JSON.stringify({ x: cp.x, y: cp.y }),
          clickPoint: cp,
        });
      }
    },
    [interactiveCanvasRef, screenToCanvas, dispatch],
  );

  // Attach / Detach event listeners
  useEffect(() => {
    const canvas = interactiveCanvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointerleave', handlePointerUp);
    canvas.addEventListener('dblclick', handleDoubleClick);
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointerleave', handlePointerUp);
      canvas.removeEventListener('dblclick', handleDoubleClick);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [
    interactiveCanvasRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleDoubleClick,
    handleWheel,
  ]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);
}

function applyResize(
  el: ExcalidrawElement,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  dispatch: React.Dispatch<any>,
) {
  const updates: Partial<ExcalidrawElement> = {};

  if (handle.includes('w')) {
    updates.x = el.x + dx;
    updates.width = el.width - dx;
  }
  if (handle.includes('e')) {
    updates.width = el.width + dx;
  }
  if (handle.includes('n')) {
    updates.y = el.y + dy;
    updates.height = el.height - dy;
  }
  if (handle.includes('s')) {
    updates.height = el.height + dy;
  }

  dispatch({ type: 'UPDATE_ELEMENT', id: el.id, updates });
}

function updateCursor(
  canvas: HTMLCanvasElement,
  tool: Tool,
  cp: Point,
  state: any,
) {
  switch (tool) {
    case 'select': {
      if (state.selectedElementIds.length === 1) {
        const selEl = state.elements.find((el: any) => el.id === state.selectedElementIds[0]);
        if (selEl) {
          // If it's a curved arrow, check if hovering over the bend handle
          if (selEl.type === 'curvedarrow') {
            const w = selEl.width;
            const h = selEl.height;
            const L = Math.hypot(w, h);
            if (L >= 1) {
              const curvature = selEl.curvature !== undefined ? selEl.curvature : (L * 0.2);
              const px = selEl.x + w / 2 - (h / L) * curvature;
              const py = selEl.y + h / 2 + (w / L) * curvature;
              const hs = 8 / state.viewport.zoom;
              if (Math.abs(cp.x - px) <= hs && Math.abs(cp.y - py) <= hs) {
                canvas.style.cursor = 'pointer';
                return;
              }
            }
          }

          // If it's a line or arrow with points, check if hovering over vertices or midpoints
          if ((selEl.type === 'line' || selEl.type === 'arrow') && selEl.points && selEl.points.length > 0) {
            const hs = 8 / state.viewport.zoom;
            for (const pt of selEl.points) {
              const px = selEl.x + pt[0];
              const py = selEl.y + pt[1];
              if (Math.abs(cp.x - px) <= hs && Math.abs(cp.y - py) <= hs) {
                canvas.style.cursor = 'pointer';
                return;
              }
            }
            for (let i = 0; i < selEl.points.length - 1; i++) {
              const p1 = selEl.points[i];
              const p2 = selEl.points[i + 1];
              const mx = selEl.x + (p1[0] + p2[0]) / 2;
              const my = selEl.y + (p1[1] + p2[1]) / 2;
              if (Math.abs(cp.x - mx) <= hs && Math.abs(cp.y - my) <= hs) {
                canvas.style.cursor = 'pointer';
                return;
              }
            }
          }

          const bounds = getElementBounds(selEl);
          const handle = hitTestResizeHandles(bounds, cp, state.viewport.zoom, selEl.type === 'text');
          if (handle) {
            const cursorMap: Record<string, string> = {
              nw: 'nwse-resize',
              n: 'ns-resize',
              ne: 'nesw-resize',
              e: 'ew-resize',
              se: 'nwse-resize',
              s: 'ns-resize',
              sw: 'nesw-resize',
              w: 'ew-resize',
            };
            canvas.style.cursor = cursorMap[handle] ?? 'default';
            return;
          }
        }
      }
      canvas.style.cursor = 'default';
      break;
    }
    case 'hand':
      canvas.style.cursor = 'grab';
      break;
    case 'text':
      canvas.style.cursor = 'text';
      break;
    case 'eraser':
      canvas.style.cursor = 'crosshair';
      break;
    default:
      canvas.style.cursor = 'crosshair';
  }
}