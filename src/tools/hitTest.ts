// ──────────────────────────────────────────────
// DrawFreely — Hit Testing
// ──────────────────────────────────────────────

import type { ExcalidrawElement, Point } from '../types';
import { getElementBounds } from '../renderer/renderElement';
import { HIT_TEST_THRESHOLD, HANDLE_SIZE } from '../constants';

// ── Main Hit Test ────────────────────────────
// Returns the topmost element at the given canvas point
export function hitTestAll(
  elements: ExcalidrawElement[],
  point: Point,
): ExcalidrawElement | null {
  // Iterate in reverse so topmost elements are checked first
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.isDeleted) continue;
    if (hitTest(el, point)) return el;
  }
  return null;
}

export function hitTest(el: ExcalidrawElement, point: Point): boolean {
  const threshold = HIT_TEST_THRESHOLD;

  switch (el.type) {
    case 'rectangle':
      return hitTestRectangle(el, point, threshold);
    case 'ellipse':
      return hitTestEllipse(el, point, threshold);
    case 'diamond':
      return hitTestDiamond(el, point, threshold);
    case 'line':
    case 'arrow':
      return hitTestLine(el, point, threshold);
    case 'freedraw':
      return hitTestFreedraw(el, point, threshold);
    case 'text':
      return hitTestText(el, point);
    default:
      return false;
  }
}

// ── Rectangle ────────────────────────────────
function hitTestRectangle(
  el: ExcalidrawElement, p: Point, t: number,
): boolean {
  const bounds = getElementBounds(el);
  const { x, y, width, height } = bounds;

  // Check if filled
  if (el.fillColor !== 'transparent') {
    return p.x >= x - t && p.x <= x + width + t &&
           p.y >= y - t && p.y <= y + height + t;
  }

  // Stroke-only: check proximity to edges
  return (
    isNearSegment(p, { x, y }, { x: x + width, y }, t) ||
    isNearSegment(p, { x: x + width, y }, { x: x + width, y: y + height }, t) ||
    isNearSegment(p, { x: x + width, y: y + height }, { x, y: y + height }, t) ||
    isNearSegment(p, { x, y: y + height }, { x, y }, t)
  );
}

// ── Ellipse ──────────────────────────────────
function hitTestEllipse(
  el: ExcalidrawElement, p: Point, t: number,
): boolean {
  const bounds = getElementBounds(el);
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const rx = bounds.width / 2;
  const ry = bounds.height / 2;

  const nx = (p.x - cx) / (rx || 1);
  const ny = (p.y - cy) / (ry || 1);
  const dist = nx * nx + ny * ny;

  if (el.fillColor !== 'transparent') {
    return dist <= 1 + t / Math.min(rx || 1, ry || 1);
  }

  // Stroke-only: check if near the ellipse border
  const outerRx = rx + t, outerRy = ry + t;
  const innerRx = Math.max(0, rx - t), innerRy = Math.max(0, ry - t);
  const outerDist = ((p.x - cx) / outerRx) ** 2 + ((p.y - cy) / outerRy) ** 2;
  const innerDist = innerRx > 0 && innerRy > 0
    ? ((p.x - cx) / innerRx) ** 2 + ((p.y - cy) / innerRy) ** 2
    : 0;
  return outerDist <= 1 && innerDist >= 1;
}

// ── Diamond ──────────────────────────────────
function hitTestDiamond(
  el: ExcalidrawElement, p: Point, t: number,
): boolean {
  const bounds = getElementBounds(el);
  const { x, y, width, height } = bounds;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const top: Point = { x: cx, y };
  const right: Point = { x: x + width, y: cy };
  const bottom: Point = { x: cx, y: y + height };
  const left: Point = { x, y: cy };

  if (el.fillColor !== 'transparent') {
    // Point in diamond: check using Manhattan-like distance
    const dx = Math.abs(p.x - cx) / (width / 2 || 1);
    const dy = Math.abs(p.y - cy) / (height / 2 || 1);
    return dx + dy <= 1 + t / Math.min(width / 2 || 1, height / 2 || 1);
  }

  return (
    isNearSegment(p, top, right, t) ||
    isNearSegment(p, right, bottom, t) ||
    isNearSegment(p, bottom, left, t) ||
    isNearSegment(p, left, top, t)
  );
}

// ── Line / Arrow ─────────────────────────────
function hitTestLine(
  el: ExcalidrawElement, p: Point, t: number,
): boolean {
  const start: Point = { x: el.x, y: el.y };
  const end: Point = { x: el.x + el.width, y: el.y + el.height };
  return isNearSegment(p, start, end, t);
}

// ── Freedraw ─────────────────────────────────
function hitTestFreedraw(
  el: ExcalidrawElement, p: Point, t: number,
): boolean {
  if (!el.points || el.points.length < 2) return false;

  const threshold = t + el.strokeWidth * 2;
  for (let i = 1; i < el.points.length; i++) {
    const a: Point = { x: el.x + el.points[i - 1][0], y: el.y + el.points[i - 1][1] };
    const b: Point = { x: el.x + el.points[i][0], y: el.y + el.points[i][1] };
    if (isNearSegment(p, a, b, threshold)) return true;
  }
  return false;
}

// ── Text ─────────────────────────────────────
function hitTestText(el: ExcalidrawElement, p: Point): boolean {
  const bounds = getElementBounds(el);
  return (
    p.x >= bounds.x && p.x <= bounds.x + bounds.width &&
    p.y >= bounds.y && p.y <= bounds.y + bounds.height
  );
}

// ── Utility: point near line segment ─────────
function isNearSegment(p: Point, a: Point, b: Point, threshold: number): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const d = Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
    return d <= threshold;
  }

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  const dist = Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
  return dist <= threshold;
}

// ── Resize Handle Hit Test ───────────────────
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export function hitTestResizeHandles(
  bounds: { x: number; y: number; width: number; height: number },
  point: Point,
  zoom: number,
): ResizeHandle | null {
  const hs = HANDLE_SIZE / zoom; // Handle size in canvas coordinates

  const handles: { handle: ResizeHandle; x: number; y: number }[] = [
    { handle: 'nw', x: bounds.x, y: bounds.y },
    { handle: 'n', x: bounds.x + bounds.width / 2, y: bounds.y },
    { handle: 'ne', x: bounds.x + bounds.width, y: bounds.y },
    { handle: 'e', x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 },
    { handle: 'se', x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { handle: 's', x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height },
    { handle: 'sw', x: bounds.x, y: bounds.y + bounds.height },
    { handle: 'w', x: bounds.x, y: bounds.y + bounds.height / 2 },
  ];

  for (const { handle, x, y } of handles) {
    if (Math.abs(point.x - x) <= hs && Math.abs(point.y - y) <= hs) {
      return handle;
    }
  }
  return null;
}

// ── Rubber-band selection: elements in rect ──
export function getElementsInRect(
  elements: ExcalidrawElement[],
  rect: { x: number; y: number; width: number; height: number },
): ExcalidrawElement[] {
  const rx = Math.min(rect.x, rect.x + rect.width);
  const ry = Math.min(rect.y, rect.y + rect.height);
  const rw = Math.abs(rect.width);
  const rh = Math.abs(rect.height);

  return elements.filter((el) => {
    if (el.isDeleted) return false;
    const b = getElementBounds(el);
    return b.x >= rx && b.y >= ry &&
           b.x + b.width <= rx + rw &&
           b.y + b.height <= ry + rh;
  });
}
