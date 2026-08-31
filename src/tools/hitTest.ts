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
  let testedPoint = point;
  if (el.angle) {
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const dx = point.x - cx;
    const dy = point.y - cy;
    const cos = Math.cos(-el.angle);
    const sin = Math.sin(-el.angle);
    testedPoint = { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  }

  switch (el.type) {
    case 'rectangle':
      return hitTestRectangle(el, testedPoint, threshold);
    case 'ellipse':
      return hitTestEllipse(el, testedPoint, threshold);
    case 'diamond':
      return hitTestDiamond(el, testedPoint, threshold);
    case 'triangle':
      return hitTestTriangle(el, testedPoint, threshold);
    case 'line':
      return hitTestLine(el, testedPoint, threshold);
    case 'arrow': {
      const arrowType = el.arrowType || 'straight';
      if (arrowType === 'curved') {
        return hitTestCurvedArrow(el, testedPoint, threshold);
      } else if (arrowType === 'elbow') {
        return hitTestElbowArrow(el, testedPoint, threshold);
      } else {
        return hitTestLine(el, testedPoint, threshold);
      }
    }
    case 'curvedarrow':
      return hitTestCurvedArrow(el, testedPoint, threshold);
    case 'elbowarrow':
      return hitTestElbowArrow(el, testedPoint, threshold);
    case 'freedraw':
      return hitTestFreedraw(el, testedPoint, threshold);
    case 'text':
      return hitTestText(el, testedPoint);
    default:
      return false;
  }
}

function hitTestTriangle(el: ExcalidrawElement, p: Point, t: number): boolean {
  const { x, y, width, height } = getElementBounds(el);
  const a = { x: x + width / 2, y };
  const b = { x: x + width, y: y + height };
  const c = { x, y: y + height };
  if (el.fillColor !== 'transparent') {
    const area = (u: Point, v: Point, w: Point) => Math.abs((u.x * (v.y - w.y) + v.x * (w.y - u.y) + w.x * (u.y - v.y)) / 2);
    const total = area(a, b, c);
    return Math.abs(area(p, b, c) + area(a, p, c) + area(a, b, p) - total) < Math.max(1, t);
  }
  return isNearSegment(p, a, b, t) || isNearSegment(p, b, c, t) || isNearSegment(p, c, a, t);
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
  if (el.points && el.points.length > 0) {
    for (let i = 1; i < el.points.length; i++) {
      const a: Point = { x: el.x + el.points[i - 1][0], y: el.y + el.points[i - 1][1] };
      const b: Point = { x: el.x + el.points[i][0], y: el.y + el.points[i][1] };
      if (isNearSegment(p, a, b, t)) return true;
    }
    return false;
  }
  const start: Point = { x: el.x, y: el.y };
  const end: Point = { x: el.x + el.width, y: el.y + el.height };
  return isNearSegment(p, start, end, t);
}

function hitTestCurvedArrow(el: ExcalidrawElement, p: Point, t: number): boolean {
  const w = el.width;
  const h = el.height;
  const L = Math.hypot(w, h);
  if (L < 1) return false;

  let cx = 0;
  let cy = 0;
  let endX = w;
  let endY = h;

  if (el.points && el.points.length === 3) {
    const p0 = el.points[0];
    const p1 = el.points[1];
    const p2 = el.points[2];
    cx = 2 * p1[0] - 0.5 * p0[0] - 0.5 * p2[0];
    cy = 2 * p1[1] - 0.5 * p0[1] - 0.5 * p2[1];
    endX = p2[0];
    endY = p2[1];
  } else {
    const curvature = el.curvature !== undefined ? el.curvature : (L * 0.2);
    cx = w / 2 - (h / L) * curvature;
    cy = h / 2 + (w / L) * curvature;
  }

  let prevX = el.x;
  let prevY = el.y;

  for (let i = 1; i <= 10; i++) {
    const tVal = i / 10;
    const mt = 1 - tVal;
    const x = mt * mt * el.x + 2 * mt * tVal * (el.x + cx) + tVal * tVal * (el.x + endX);
    const y = mt * mt * el.y + 2 * mt * tVal * (el.y + cy) + tVal * tVal * (el.y + endY);
    if (isNearSegment(p, { x: prevX, y: prevY }, { x, y }, t)) {
      return true;
    }
    prevX = x;
    prevY = y;
  }
  return false;
}

function hitTestElbowArrow(el: ExcalidrawElement, p: Point, t: number): boolean {
  const w = el.width;
  const h = el.height;
  const L = Math.hypot(w, h);
  if (L < 1) return false;

  const headSize = Math.min(L * 0.25, Math.max(12, el.strokeWidth * 5));
  const shorten = headSize * 0.9;
  
  let points: [number, number][];
  if (Math.abs(w) > Math.abs(h)) {
    const lastPointX = w - Math.sign(w) * shorten;
    points = [
      [0, 0],
      [w / 2, 0],
      [w / 2, h],
      [lastPointX, h]
    ];
  } else {
    const lastPointY = h - Math.sign(h) * shorten;
    points = [
      [0, 0],
      [0, h / 2],
      [w, h / 2],
      [w, lastPointY]
    ];
  }

  for (let i = 1; i < points.length; i++) {
    const p1 = { x: el.x + points[i - 1][0], y: el.y + points[i - 1][1] };
    const p2 = { x: el.x + points[i][0], y: el.y + points[i][1] };
    if (isNearSegment(p, p1, p2, t)) {
      return true;
    }
  }
  return false;
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
  const padding = 8; // generous click padding for text
  return (
    p.x >= bounds.x - padding && p.x <= bounds.x + bounds.width + padding &&
    p.y >= bounds.y - padding && p.y <= bounds.y + bounds.height + padding
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
  isText?: boolean,
  angle = 0,
  center?: Point,
): ResizeHandle | null {
  const hs = HANDLE_SIZE / zoom; // Handle size in canvas coordinates

  const handles: { handle: ResizeHandle; x: number; y: number }[] = [
    { handle: 'nw' as ResizeHandle, x: bounds.x, y: bounds.y },
    ...(isText ? [] : [{ handle: 'n' as ResizeHandle, x: bounds.x + bounds.width / 2, y: bounds.y }]),
    { handle: 'ne' as ResizeHandle, x: bounds.x + bounds.width, y: bounds.y },
    { handle: 'e' as ResizeHandle, x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 },
    { handle: 'se' as ResizeHandle, x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    ...(isText ? [] : [{ handle: 's' as ResizeHandle, x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height }]),
    { handle: 'sw' as ResizeHandle, x: bounds.x, y: bounds.y + bounds.height },
    { handle: 'w' as ResizeHandle, x: bounds.x, y: bounds.y + bounds.height / 2 },
  ];

  const pivot = center || { x:bounds.x + bounds.width / 2, y:bounds.y + bounds.height / 2 };
  for (const { handle, x, y } of handles) {
    const dx = x - pivot.x, dy = y - pivot.y;
    const hx = pivot.x + dx * Math.cos(angle) - dy * Math.sin(angle);
    const hy = pivot.y + dx * Math.sin(angle) + dy * Math.cos(angle);
    if (Math.abs(point.x - hx) <= hs && Math.abs(point.y - hy) <= hs) {
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
