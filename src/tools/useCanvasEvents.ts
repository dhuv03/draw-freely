// ??????????????????????????????????????????????
// DrawFreely ? Master Canvas Event Handler
// All tool logic: select, shapes, line, arrow,
// freedraw, text, eraser, hand, pan, zoom
// ??????????????????????????????????????????????

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
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

let elementClipboard: ExcalidrawElement[] = [];

function bindArrowEndpoint(point: Point, elements: ExcalidrawElement[], excludedId: string) {
  let best: { element: ExcalidrawElement; point: Point; distance: number } | null = null;
  for (const element of elements) {
    if (element.id === excludedId || element.isDeleted || ['arrow', 'line', 'freedraw', 'text'].includes(element.type)) continue;
    const bounds = getElementBounds(element);
    const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const scale = Math.max(Math.abs(dx) / Math.max(bounds.width / 2, 1), Math.abs(dy) / Math.max(bounds.height / 2, 1), 1);
    const edge = { x: center.x + dx / scale, y: center.y + dy / scale };
    const distance = Math.hypot(point.x - edge.x, point.y - edge.y);
    if (distance <= 28 && (!best || distance < best.distance)) best = { element, point: edge, distance };
  }
  return best;
}

// ?? Pointer State (ref, not React state) ?????
interface PointerState {
  isDown: boolean;
  startCanvas: Point;
  lastCanvas: Point;
  startScreen: Point;
  action: 'none' | 'drawing' | 'moving' | 'resizing' | 'rotating' | 'panning' | 'rubberband' | 'erasing';
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
  useLayoutEffect(() => { stateRef.current = state; }, [state]);
  const ps = useRef<PointerState>(initialPointerState());
  const touchPoints = useRef(new Map<number, Point>());
  const pinch = useRef<null | { distance: number; canvasPoint: Point }>(null);

  // ?? Coordinate conversion ??????????????????
  const screenToCanvas = useCallback((sx: number, sy: number): Point => {
    const { zoom, scrollX, scrollY } = stateRef.current.viewport;
    return { x: (sx - scrollX) / zoom, y: (sy - scrollY) / zoom };
  }, []);

  // ?? Create a new element ???????????????????
  const createElement = useCallback(
    (type: ExcalidrawElement['type'], x: number, y: number): ExcalidrawElement => ({
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

      if (e.pointerType === 'touch') {
        touchPoints.current.set(e.pointerId, { x: sx, y: sy });
        if (touchPoints.current.size === 2) {
          const [a, b] = [...touchPoints.current.values()];
          const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          pinch.current = {
            distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
            canvasPoint: screenToCanvas(center.x, center.y),
          };
          activeElementRef.current = null;
          Object.assign(ps.current, initialPointerState());
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          forceStaticRender();
          return;
        }
      }
      dispatch({ type: 'SET_PROPERTIES_OPEN', open: false });
      const activeLayer = s.layers.find((layer) => layer.id === s.activeLayerId);
      if (!['select', 'hand', 'eraser'].includes(tool) && (!activeLayer?.visible || activeLayer.locked)) return;

      // Text tool: open editor without capturing pointer (allows textarea interaction)
      if (tool === 'text' && e.button === 0) {
        const hit = hitTestAll(getInteractiveElements(s), cp);
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
            const rotatePoint = { x: bounds.x + bounds.width / 2, y: bounds.y - 24 / s.viewport.zoom };
            if (Math.hypot(cp.x - rotatePoint.x, cp.y - rotatePoint.y) <= 10 / s.viewport.zoom) {
              dispatch({ type: 'SNAPSHOT' }); p.action = 'rotating'; (p as PointerState & { rotationCenter?: Point }).rotationCenter = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }; return;
            }
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
        const hit = hitTestAll(getInteractiveElements(s), cp);
        if (hit) {
          if (hit.locked) return;
          const hitIds = hit.groupId
            ? s.elements.filter((el) => el.groupId === hit.groupId && !el.isDeleted).map((el) => el.id)
            : [hit.id];
          const isAlreadySelected = s.selectedElementIds.includes(hit.id);
          if (e.shiftKey) {
            // Toggle selection
            const newIds = isAlreadySelected
              ? s.selectedElementIds.filter((id) => !hitIds.includes(id))
              : [...new Set([...s.selectedElementIds, ...hitIds])];
            dispatch({ type: 'SET_SELECTION', ids: newIds });
          } else if (!isAlreadySelected) {
            dispatch({ type: 'SET_SELECTION', ids: hitIds });
          }
          // Prepare to move
          dispatch({ type: 'SNAPSHOT' });
          p.action = 'moving';
          // Store starting positions of all selected elements
          const selectedIds = e.shiftKey && !s.selectedElementIds.includes(hit.id)
            ? [...new Set([...s.selectedElementIds, ...hitIds])]
            : s.selectedElementIds.includes(hit.id)
              ? s.selectedElementIds
              : hitIds;
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
      if (['rectangle', 'ellipse', 'diamond', 'triangle'].includes(tool)) {
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
        const hit = hitTestAll(getInteractiveElements(s), cp);
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

      if (e.pointerType === 'touch' && touchPoints.current.has(e.pointerId)) {
        touchPoints.current.set(e.pointerId, { x: sx, y: sy });
        if (touchPoints.current.size >= 2 && pinch.current) {
          const [a, b] = [...touchPoints.current.values()];
          const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
          const currentZoom = stateRef.current.viewport.zoom;
          const zoom = Math.max(ZOOM_LIMITS.min, Math.min(ZOOM_LIMITS.max, currentZoom * (distance / pinch.current.distance)));
          pinch.current.distance = distance;
          dispatch({ type: 'SET_VIEWPORT', viewport: {
            zoom,
            scrollX: center.x - pinch.current.canvasPoint.x * zoom,
            scrollY: center.y - pinch.current.canvasPoint.y * zoom,
          } });
          return;
        }
      }
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

        if (['arrow', 'curvedarrow', 'elbowarrow'].includes(el.type)) {
          const start = bindArrowEndpoint({ x: el.x, y: el.y }, stateRef.current.elements, el.id);
          const end = bindArrowEndpoint({ x: el.x + el.width, y: el.y + el.height }, stateRef.current.elements, el.id);
          if (start) { el.startBindingId = start.element.id; el.x = start.point.x; el.y = start.point.y; }
          if (end) { el.endBindingId = end.element.id; el.width = end.point.x - el.x; el.height = end.point.y - el.y; }
          if (el.type === 'elbowarrow' || el.arrowType === 'elbow') {
            el.points = [[0, 0, 0], [el.width, 0, 0], [el.width, el.height, 0]];
          } else if (el.type === 'arrow' && el.arrowType !== 'curved') {
            el.points = [[0, 0, 0], [el.width, el.height, 0]];
          }
        }

        if (el.type === 'freedraw') {
          // Preserve high-frequency pen/trackpad samples instead of dropping
          // coalesced pointer events between animation frames.
          const samples = e.getCoalescedEvents?.() ?? [e];
          const nextPoints = [...(el.points || [])];
          for (const sample of samples) {
            const point = screenToCanvas(sample.clientX - rect.left, sample.clientY - rect.top);
            const previous = nextPoints[nextPoints.length - 1];
            const relX = point.x - el.x;
            const relY = point.y - el.y;
            if (!previous || Math.hypot(relX - previous[0], relY - previous[1]) >= 0.35 / s.viewport.zoom) {
              nextPoints.push([relX, relY, sample.pressure > 0 ? sample.pressure : 0.5]);
            }
          }
          el.points = nextPoints;
        } else {
          // Update dimensions
          el.width = cp.x - p.startCanvas.x;
          el.height = cp.y - p.startCanvas.y;

          // Shift key ? constrain to square/circle or 45? lines
          if (e.shiftKey) {
            if (['rectangle', 'ellipse', 'diamond', 'triangle'].includes(el.type)) {
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
        const moveDx = cp.x - p.startCanvas.x;
        const moveDy = cp.y - p.startCanvas.y;
        for (const [id, start] of p.movedElements) {
          dispatch({
            type: 'UPDATE_ELEMENT',
            id,
            updates: {
              x: start.x + moveDx,
              y: start.y + moveDy,
            },
          });
          for (const arrow of s.elements.filter((element) => !p.movedElements.has(element.id) && (element.startBindingId === id || element.endBindingId === id))) {
            if (arrow.startBindingId === id) {
              dispatch({ type: 'UPDATE_ELEMENT', id: arrow.id, updates: { x: arrow.x + moveDx, y: arrow.y + moveDy, width: arrow.width - moveDx, height: arrow.height - moveDy } });
            } else {
              dispatch({ type: 'UPDATE_ELEMENT', id: arrow.id, updates: { width: arrow.width + moveDx, height: arrow.height + moveDy } });
            }
          }
        }
        forceInteractiveRender();
        return;
      }

      if (p.action === 'rotating') {
        const id = s.selectedElementIds[0];
        const center = (p as PointerState & { rotationCenter?: Point }).rotationCenter;
        if (id && center) {
          let angle = Math.atan2(cp.y - center.y, cp.x - center.x) + Math.PI / 2;
          if (e.shiftKey) angle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
          dispatch({ type: 'UPDATE_ELEMENT', id, updates: { angle } }); forceInteractiveRender();
        }
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
        const selected = getElementsInRect(getInteractiveElements(s), rb);
        dispatch({ type: 'SET_SELECTION', ids: selected.map((el) => el.id) });
        return;
      }

      // ?? ERASING ?????????????????????????
      if (p.action === 'erasing') {
        const hit = hitTestAll(getInteractiveElements(s), cp);
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
    (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        touchPoints.current.delete(e.pointerId);
        if (touchPoints.current.size < 2) pinch.current = null;
      }
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
          dispatch({ type: 'SET_SELECTION', ids: [] });
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
          ids: s.elements.filter((el) => !el.isDeleted && !el.locked).map((el) => el.id),
        });
        dispatch({ type: 'SET_TOOL', tool: 'select' });
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        elementClipboard = s.elements.filter((el) => s.selectedElementIds.includes(el.id)).map((el) => ({ ...el, points: el.points?.map((point) => [...point]) }));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        elementClipboard = s.elements.filter((el) => s.selectedElementIds.includes(el.id)).map((el) => ({ ...el, points: el.points?.map((point) => [...point]) }));
        if (elementClipboard.length) { e.preventDefault(); dispatch({ type: 'SNAPSHOT' }); dispatch({ type: 'DELETE_ELEMENTS', ids: s.selectedElementIds }); }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && elementClipboard.length) {
        e.preventDefault(); dispatch({ type: 'SNAPSHOT' });
        const copies = elementClipboard.map((el) => ({ ...el, id: nanoid(), x: el.x + 24, y: el.y + 24, groupId: undefined, startBindingId: null, endBindingId: null, points: el.points?.map((point) => [...point] as [number, number, number]) }));
        elementClipboard = copies;
        dispatch({ type: 'SET_ELEMENTS', elements: [...s.elements, ...copies] });
        dispatch({ type: 'SET_SELECTION', ids: copies.map((el) => el.id) });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && s.selectedElementIds.length) {
        e.preventDefault();
        const copies = s.elements.filter((el) => s.selectedElementIds.includes(el.id)).map((el) => ({ ...el, id: nanoid(), x: el.x + 20, y: el.y + 20, groupId: undefined, points: el.points?.map((point) => [...point] as [number, number, number]) }));
        dispatch({ type: 'SNAPSHOT' }); dispatch({ type: 'SET_ELEMENTS', elements: [...s.elements, ...copies] }); dispatch({ type: 'SET_SELECTION', ids: copies.map((el) => el.id) }); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g' && s.selectedElementIds.length > 1) {
        e.preventDefault(); const groupId = nanoid(); dispatch({ type: 'SNAPSHOT' }); s.selectedElementIds.forEach((id) => dispatch({ type: 'UPDATE_ELEMENT', id, updates: { groupId } })); return;
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
      const hit = hitTestAll(getInteractiveElements(s), cp);
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
    canvas.addEventListener('pointercancel', handlePointerUp);
    canvas.addEventListener('pointerleave', handlePointerUp);
    canvas.addEventListener('dblclick', handleDoubleClick);
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerUp);
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
          const rotatePoint = { x: bounds.x + bounds.width / 2, y: bounds.y - 24 / state.viewport.zoom };
          if (Math.hypot(cp.x - rotatePoint.x, cp.y - rotatePoint.y) <= 10 / state.viewport.zoom) {
            canvas.style.cursor = 'grab';
            return;
          }
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
      const hovered = hitTestAll(getInteractiveElements(state), cp);
      canvas.style.cursor = hovered && !hovered.locked ? 'move' : hovered?.locked ? 'not-allowed' : 'default';
      break;
    }
    case 'hand':
      canvas.style.cursor = 'grab';
      break;
    case 'text':
      canvas.style.cursor = 'text';
      break;
    case 'eraser':
      canvas.style.cursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='10' fill='white' fill-opacity='.35' stroke='%231e293b' stroke-width='2'/%3E%3Ccircle cx='16' cy='16' r='2' fill='%231e293b'/%3E%3C/svg%3E") 16 16, crosshair`;
      break;
    default:
      canvas.style.cursor = 'crosshair';
  }
}

function getInteractiveElements(state: any): ExcalidrawElement[] {
  const available = new Set(state.layers.filter((layer: any) => layer.visible && !layer.locked).map((layer: any) => layer.id));
  const layerOrder = new Map(state.layers.map((layer: any, index: number) => [layer.id, index]));
  return state.elements.filter((el: ExcalidrawElement) => available.has(el.layerId || 'layer-1')).sort((a: ExcalidrawElement, b: ExcalidrawElement) => Number(layerOrder.get(a.layerId || 'layer-1') || 0) - Number(layerOrder.get(b.layerId || 'layer-1') || 0));
}
