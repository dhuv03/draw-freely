// ──────────────────────────────────────────────
// DrawFreely — Element Rendering + Shape Cache
// ──────────────────────────────────────────────

import type { ExcalidrawElement, Bounds } from '../types';
import { getStroke } from 'perfect-freehand';

// ── Shape Cache ──────────────────────────────
// Caches RoughJS drawables keyed by element id + visual hash.
// Generating drawables at (0,0) so moves don't invalidate cache.

const cache = new Map<string, { hash: string; drawable: any }>();

function getVisualHash(el: ExcalidrawElement): string {
  return `${el.type}|${Math.round(el.width * 100)}|${Math.round(el.height * 100)}|${el.strokeColor}|${el.fillColor}|${el.strokeWidth}|${el.strokeStyle}|${el.roughness}|${el.fillStyle}|${el.seed}`;
}

function getRoughOptions(el: ExcalidrawElement): any {
  const opts: any = {
    seed: el.seed,
    stroke: el.strokeColor,
    strokeWidth: el.strokeWidth,
    roughness: el.roughness,
  };
  if (el.fillColor !== 'transparent') {
    opts.fill = el.fillColor;
    opts.fillStyle = el.fillStyle;
  }
  if (el.strokeStyle === 'dashed') {
    opts.strokeLineDash = [12, 8];
  } else if (el.strokeStyle === 'dotted') {
    opts.strokeLineDash = [3, 6];
  }
  return opts;
}

function getCachedDrawable(el: ExcalidrawElement, generator: any): any | null {
  if (el.type === 'freedraw' || el.type === 'text') return null;

  const hash = getVisualHash(el);
  const cached = cache.get(el.id);
  if (cached && cached.hash === hash) return cached.drawable;

  const opts = getRoughOptions(el);
  let drawable: any = null;

  switch (el.type) {
    case 'rectangle':
      drawable = generator.rectangle(0, 0, el.width, el.height, opts);
      break;
    case 'ellipse':
      drawable = generator.ellipse(
        el.width / 2, el.height / 2,
        Math.abs(el.width), Math.abs(el.height), opts,
      );
      break;
    case 'diamond': {
      const w = el.width, h = el.height;
      drawable = generator.polygon(
        [[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]] as [number, number][],
        opts,
      );
      break;
    }
    case 'line':
      drawable = generator.line(0, 0, el.width, el.height, opts);
      break;
    case 'arrow': {
      const { lineEndX, lineEndY } = getArrowGeometry(el);
      drawable = generator.line(0, 0, lineEndX, lineEndY, opts);
      break;
    }
  }

  if (drawable) cache.set(el.id, { hash, drawable });
  return drawable;
}

export function clearShapeCache() {
  cache.clear();
}

// ── Main Render Function ─────────────────────
export function renderElement(
  ctx: CanvasRenderingContext2D,
  el: ExcalidrawElement,
  rc: any,
) {
  ctx.save();
  ctx.globalAlpha = el.opacity / 100;
  ctx.translate(el.x, el.y);

  if (el.type === 'freedraw') {
    renderFreedraw(ctx, el);
  } else if (el.type === 'text') {
    renderText(ctx, el);
  } else {
    const drawable = getCachedDrawable(el, rc.generator);
    if (drawable) rc.draw(drawable);
    if (el.type === 'arrow') drawArrowhead(ctx, el);
  }

  ctx.restore();
}

// ── Freedraw (Perfect Freehand) ──────────────
function renderFreedraw(ctx: CanvasRenderingContext2D, el: ExcalidrawElement) {
  if (!el.points || el.points.length < 2) return;

  const outlinePoints = getStroke(el.points, {
    size: el.strokeWidth * 3,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: true,
  });

  if (outlinePoints.length < 2) return;

  ctx.fillStyle = el.strokeColor;
  ctx.globalAlpha = el.opacity / 100;
  ctx.beginPath();
  ctx.moveTo(outlinePoints[0][0], outlinePoints[0][1]);
  for (let i = 1; i < outlinePoints.length; i++) {
    ctx.lineTo(outlinePoints[i][0], outlinePoints[i][1]);
  }
  ctx.closePath();
  ctx.fill();
}

// ── Text ─────────────────────────────────────
function renderText(ctx: CanvasRenderingContext2D, el: ExcalidrawElement) {
  if (!el.text) return;

  const fontFamily =
    el.fontFamily === 'Virgil'
      ? "'Caveat', cursive"
      : el.fontFamily === 'Cascadia'
        ? "'Fira Code', monospace"
        : "'Inter', Helvetica, Arial, sans-serif";

  const fontSize = el.fontSize || 20;
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = el.strokeColor;
  ctx.textBaseline = 'top';

  const lines = el.text.split('\n');
  const lineHeight = fontSize * 1.25;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 0, i * lineHeight);
  }
}

// ── Arrow geometry (Excalidraw-style) ────────
function getArrowGeometry(el: ExcalidrawElement) {
  const dx = el.width;
  const dy = el.height;
  const length = Math.hypot(dx, dy);
  if (length < 1) {
    return { lineEndX: dx, lineEndY: dy, tipX: dx, tipY: dy, angle: 0, headSize: 0 };
  }

  const angle = Math.atan2(dy, dx);
  // Head size scales with stroke width, capped by line length (like Excalidraw)
  const headSize = Math.min(length * 0.25, Math.max(12, el.strokeWidth * 5));
  const shorten = headSize * 0.9;

  return {
    lineEndX: dx - shorten * Math.cos(angle),
    lineEndY: dy - shorten * Math.sin(angle),
    tipX: dx,
    tipY: dy,
    angle,
    headSize,
  };
}

// ── Arrowhead ────────────────────────────────
function drawArrowhead(ctx: CanvasRenderingContext2D, el: ExcalidrawElement) {
  const { tipX, tipY, angle, headSize } = getArrowGeometry(el);
  if (headSize < 1) return;

  const headAngle = Math.PI / 6; // 30° — matches Excalidraw

  ctx.fillStyle = el.strokeColor;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(
    tipX - headSize * Math.cos(angle - headAngle),
    tipY - headSize * Math.sin(angle - headAngle),
  );
  ctx.lineTo(
    tipX - headSize * Math.cos(angle + headAngle),
    tipY - headSize * Math.sin(angle + headAngle),
  );
  ctx.closePath();
  ctx.fill();
}

// ── Element Bounds ───────────────────────────
export function getElementBounds(el: ExcalidrawElement): Bounds {
  if (el.type === 'freedraw' && el.points && el.points.length > 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [px, py] of el.points) {
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }
    return {
      x: el.x + minX,
      y: el.y + minY,
      width: maxX - minX || 1,
      height: maxY - minY || 1,
    };
  }

  if (el.type === 'text') {
    return measureTextElement(el);
  }

  // Normalize negative dimensions (lines/arrows drawn right-to-left)
  const x = Math.min(el.x, el.x + el.width);
  const y = Math.min(el.y, el.y + el.height);
  return { x, y, width: Math.abs(el.width) || 1, height: Math.abs(el.height) || 1 };
}

// ── Text Measurement ─────────────────────────
export function measureTextElement(el: ExcalidrawElement): Bounds {
  const text = el.text || '';
  const fontSize = el.fontSize || 20;
  const fontFamily =
    el.fontFamily === 'Virgil'
      ? "'Caveat', cursive"
      : el.fontFamily === 'Cascadia'
        ? "'Fira Code', monospace"
        : "'Inter', Helvetica, Arial, sans-serif";

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = `${fontSize}px ${fontFamily}`;

  const lines = text.split('\n');
  const width = Math.max(10, ...lines.map((l) => ctx.measureText(l).width));
  const height = Math.max(fontSize, lines.length * fontSize * 1.25);

  return { x: el.x, y: el.y, width, height };
}
