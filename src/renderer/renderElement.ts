// ──────────────────────────────────────────────
// DrawFreely — Element Rendering + Shape Cache
// ──────────────────────────────────────────────

import type { ExcalidrawElement, Bounds, Point } from '../types';
import { getStroke } from 'perfect-freehand';

// ── Shape Cache ──────────────────────────────
// Caches RoughJS drawables keyed by element id + visual hash.
// Generating drawables at (0,0) so moves don't invalidate cache.

const cache = new Map<string, { hash: string; drawable: any }>();

function getVisualHash(el: ExcalidrawElement): string {
  const pointsStr = el.points ? el.points.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(':') : '';
  return `${el.type}|${Math.round(el.width * 100)}|${Math.round(el.height * 100)}|${el.strokeColor}|${el.fillColor}|${el.strokeWidth}|${el.strokeStyle}|${el.roughness}|${el.fillStyle}|${el.seed}|${el.cornerRadius || 0}|${el.curvature !== undefined ? Math.round(el.curvature * 100) : ''}|${pointsStr}`;
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
      if (el.cornerRadius) {
        const radius = Math.min(Math.abs(el.cornerRadius), Math.abs(el.width) / 2, Math.abs(el.height) / 2);
        drawable = generator.path(`M ${radius} 0 H ${el.width - radius} Q ${el.width} 0 ${el.width} ${radius} V ${el.height - radius} Q ${el.width} ${el.height} ${el.width - radius} ${el.height} H ${radius} Q 0 ${el.height} 0 ${el.height - radius} V ${radius} Q 0 0 ${radius} 0 Z`, opts);
      } else drawable = generator.rectangle(0, 0, el.width, el.height, opts);
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
    case 'triangle': {
      const w = el.width, h = el.height;
      drawable = generator.polygon([[w / 2, 0], [w, h], [0, h]] as [number, number][], opts);
      break;
    }
    case 'line': {
      if (el.points && el.points.length > 0) {
        const roughPoints = el.points.map(([px, py]) => [px, py] as [number, number]);
        drawable = generator.linearPath(roughPoints, opts);
      } else {
        drawable = generator.line(0, 0, el.width, el.height, opts);
      }
      break;
    }
    case 'arrow': {
      if (el.points && el.points.length > 1) {
        const { lineEndX, lineEndY } = getArrowGeometry(el);
        const roughPoints = el.points.map(([px, py]) => [px, py] as [number, number]);
        roughPoints[roughPoints.length - 1] = [lineEndX, lineEndY];
        drawable = generator.linearPath(roughPoints, opts);
      } else {
        const { lineEndX, lineEndY } = getArrowGeometry(el);
        drawable = generator.line(0, 0, lineEndX, lineEndY, opts);
      }
      break;
    }
    case 'curvedarrow': {
      const w = el.width;
      const h = el.height;
      const L = Math.hypot(w, h);
      if (L < 1) {
        drawable = generator.line(0, 0, w, h, opts);
      } else {
        const curvature = el.curvature !== undefined ? el.curvature : (L * 0.2);
        const cx = w / 2 - (h / L) * curvature;
        const cy = h / 2 + (w / L) * curvature;
        const theta = Math.atan2(h - cy, w - cx);
        const headSize = Math.min(L * 0.25, Math.max(12, el.strokeWidth * 5));
        const shorten = headSize * 0.8;
        const endX = w - shorten * Math.cos(theta);
        const endY = h - shorten * Math.sin(theta);
        const path = `M 0 0 Q ${cx} ${cy} ${endX} ${endY}`;
        drawable = generator.path(path, opts);
      }
      break;
    }
    case 'elbowarrow': {
      const w = el.width;
      const h = el.height;
      const L = Math.hypot(w, h);
      if (L < 1) {
        drawable = generator.line(0, 0, w, h, opts);
      } else {
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
        drawable = generator.linearPath(points, opts);
      }
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
  if (el.angle) {
    ctx.translate(el.width / 2, el.height / 2);
    ctx.rotate(el.angle);
    ctx.translate(-el.width / 2, -el.height / 2);
  }

  if (el.type === 'freedraw') {
    renderFreedraw(ctx, el);
  } else if (el.type === 'text') {
    renderText(ctx, el);
  } else {
    const drawable = getCachedDrawable(el, rc.generator);
    if (drawable) rc.draw(drawable);
    if (el.type === 'arrow') drawArrowhead(ctx, el);
    if (el.type === 'curvedarrow') drawCurvedArrowhead(ctx, el);
    if (el.type === 'elbowarrow') drawElbowArrowhead(ctx, el);
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

export function wrapText(text: string, maxWidth: number, font: string): string[] {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = font;

  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }
    const words = paragraph.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      const testWidth = ctx.measureText(testLine).width;
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }
  return lines;
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
  const font = `${el.fontStyle || 'normal'} ${el.fontWeight || 'normal'} ${fontSize}px ${fontFamily}`;
  ctx.font = font;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${el.letterSpacing || 0}px`;
  ctx.fillStyle = el.strokeColor;
  ctx.textBaseline = 'top';
  ctx.textAlign = el.textAlign || 'left';

  const lines = el.width > 30 ? wrapText(el.text, el.width, font) : el.text.split('\n');
  const lineHeight = fontSize * (el.lineHeight || 1.25);
  const blockHeight = lines.length * lineHeight;
  const yOffset = el.verticalAlign === 'middle' ? (el.height - blockHeight) / 2 : el.verticalAlign === 'bottom' ? el.height - blockHeight : 0;
  const xOffset = el.textAlign === 'center' ? el.width / 2 : el.textAlign === 'right' ? el.width : 0;
  if (el.textBackgroundColor && el.textBackgroundColor !== 'transparent') {
    ctx.save();
    ctx.fillStyle = el.textBackgroundColor;
    ctx.fillRect(0, yOffset, el.width, blockHeight);
    ctx.restore();
  }
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], xOffset, yOffset + i * lineHeight);
    if (el.textDecoration === 'underline') {
      const measured = ctx.measureText(lines[i]).width;
      const startX = el.textAlign === 'center' ? xOffset - measured / 2 : el.textAlign === 'right' ? xOffset - measured : xOffset;
      ctx.beginPath();
      ctx.moveTo(startX, yOffset + i * lineHeight + fontSize * 1.05);
      ctx.lineTo(startX + measured, yOffset + i * lineHeight + fontSize * 1.05);
      ctx.strokeStyle = el.strokeColor;
      ctx.lineWidth = Math.max(1, fontSize / 16);
      ctx.stroke();
    }
  }
}

// ── Arrow geometry (Excalidraw-style) ────────
export function getArrowGeometry(el: ExcalidrawElement) {
  if (el.points && el.points.length > 1) {
    const last = el.points[el.points.length - 1];
    const prev = el.points[el.points.length - 2];
    const dx = last[0] - prev[0];
    const dy = last[1] - prev[1];
    const length = Math.hypot(dx, dy);
    if (length < 1) {
      return { lineEndX: last[0], lineEndY: last[1], tipX: last[0], tipY: last[1], angle: 0, headSize: 0 };
    }
    const angle = Math.atan2(dy, dx);
    const headSize = Math.min(length * 0.25, Math.max(12, el.strokeWidth * 5));
    const shorten = headSize * 0.9;
    return {
      lineEndX: last[0] - shorten * Math.cos(angle),
      lineEndY: last[1] - shorten * Math.sin(angle),
      tipX: last[0],
      tipY: last[1],
      angle,
      headSize,
    };
  }

  const dx = el.width;
  const dy = el.height;
  const length = Math.hypot(dx, dy);
  if (length < 1) {
    return { lineEndX: dx, lineEndY: dy, tipX: dx, tipY: dy, angle: 0, headSize: 0 };
  }

  const angle = Math.atan2(dy, dx);
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

function drawCurvedArrowhead(ctx: CanvasRenderingContext2D, el: ExcalidrawElement) {
  const w = el.width;
  const h = el.height;
  const L = Math.hypot(w, h);
  if (L < 1) return;

  const curvature = el.curvature !== undefined ? el.curvature : (L * 0.2);
  const cx = w / 2 - (h / L) * curvature;
  const cy = h / 2 + (w / L) * curvature;
  const angle = Math.atan2(h - cy, w - cx);
  const headSize = Math.min(L * 0.25, Math.max(12, el.strokeWidth * 5));
  const headAngle = Math.PI / 6;

  ctx.fillStyle = el.strokeColor;
  ctx.beginPath();
  ctx.moveTo(w, h);
  ctx.lineTo(
    w - headSize * Math.cos(angle - headAngle),
    h - headSize * Math.sin(angle - headAngle),
  );
  ctx.lineTo(
    w - headSize * Math.cos(angle + headAngle),
    h - headSize * Math.sin(angle + headAngle),
  );
  ctx.closePath();
  ctx.fill();
}

function drawElbowArrowhead(ctx: CanvasRenderingContext2D, el: ExcalidrawElement) {
  const w = el.width;
  const h = el.height;
  const L = Math.hypot(w, h);
  if (L < 1) return;

  let angle = 0;
  if (Math.abs(w) > Math.abs(h)) {
    angle = Math.atan2(0, w);
  } else {
    angle = Math.atan2(h, 0);
  }

  const headSize = Math.min(L * 0.25, Math.max(12, el.strokeWidth * 5));
  const headAngle = Math.PI / 6;

  ctx.fillStyle = el.strokeColor;
  ctx.beginPath();
  ctx.moveTo(w, h);
  ctx.lineTo(
    w - headSize * Math.cos(angle - headAngle),
    h - headSize * Math.sin(angle - headAngle),
  );
  ctx.lineTo(
    w - headSize * Math.cos(angle + headAngle),
    h - headSize * Math.sin(angle + headAngle),
  );
  ctx.closePath();
  ctx.fill();
}

// ── Element Bounds ───────────────────────────
export function getElementBounds(el: ExcalidrawElement): Bounds {
  if (el.type === 'curvedarrow' || (el.type === 'arrow' && el.arrowType === 'curved')) {
    const w = el.width, h = el.height, length = Math.hypot(w, h);
    const curvature = el.curvature ?? length * 0.2;
    const cx = length < 1 ? w / 2 : w / 2 - (h / length) * curvature;
    const cy = length < 1 ? h / 2 : h / 2 + (w / length) * curvature;
    const samples: Point[] = [];
    for (let index = 0; index <= 32; index++) {
      const t = index / 32, mt = 1 - t;
      samples.push({ x: el.x + 2 * mt * t * cx + t * t * w, y: el.y + 2 * mt * t * cy + t * t * h });
    }
    const padding = Math.max(8, el.strokeWidth * 4);
    const minX = Math.min(...samples.map((point) => point.x)) - padding;
    const maxX = Math.max(...samples.map((point) => point.x)) + padding;
    const minY = Math.min(...samples.map((point) => point.y)) - padding;
    const maxY = Math.max(...samples.map((point) => point.y)) + padding;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  if (el.type === 'elbowarrow') {
    const padding = Math.max(8, el.strokeWidth * 4);
    const x = Math.min(el.x, el.x + el.width) - padding;
    const y = Math.min(el.y, el.y + el.height) - padding;
    return { x, y, width: Math.abs(el.width) + padding * 2, height: Math.abs(el.height) + padding * 2 };
  }
  if ((el.type === 'freedraw' || el.type === 'line' || el.type === 'arrow') && el.points && el.points.length > 0) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [px, py] of el.points) {
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }
    const bounds = {
      x: el.x + minX,
      y: el.y + minY,
      width: maxX - minX || 1,
      height: maxY - minY || 1,
    };
    if (!el.angle) return bounds;
    const center = { x: el.x + el.width / 2, y: el.y + el.height / 2 };
    const cos = Math.cos(el.angle), sin = Math.sin(el.angle);
    const corners = [
      { x:bounds.x, y:bounds.y }, { x:bounds.x + bounds.width, y:bounds.y },
      { x:bounds.x + bounds.width, y:bounds.y + bounds.height }, { x:bounds.x, y:bounds.y + bounds.height },
    ].map((point) => ({
      x:center.x + (point.x - center.x) * cos - (point.y - center.y) * sin,
      y:center.y + (point.x - center.x) * sin + (point.y - center.y) * cos,
    }));
    const rotatedMinX = Math.min(...corners.map((point) => point.x));
    const rotatedMaxX = Math.max(...corners.map((point) => point.x));
    const rotatedMinY = Math.min(...corners.map((point) => point.y));
    const rotatedMaxY = Math.max(...corners.map((point) => point.y));
    return { x:rotatedMinX, y:rotatedMinY, width:rotatedMaxX - rotatedMinX, height:rotatedMaxY - rotatedMinY };
  }

  if (el.type === 'text') {
    return measureTextElement(el);
  }

  // Normalize negative dimensions (lines/arrows drawn right-to-left)
  const x = Math.min(el.x, el.x + el.width);
  const y = Math.min(el.y, el.y + el.height);
  const width = Math.abs(el.width) || 1;
  const height = Math.abs(el.height) || 1;
  if (!el.angle) return { x, y, width, height };
  const cos = Math.abs(Math.cos(el.angle));
  const sin = Math.abs(Math.sin(el.angle));
  const rotatedWidth = width * cos + height * sin;
  const rotatedHeight = width * sin + height * cos;
  return { x: x + width / 2 - rotatedWidth / 2, y: y + height / 2 - rotatedHeight / 2, width: rotatedWidth, height: rotatedHeight };
}

/** Bounds before rotation; selection UI and resize math use this local frame. */
export function getElementUnrotatedBounds(el: ExcalidrawElement): Bounds {
  return getElementBounds(el.angle ? { ...el, angle: 0 } : el);
}

export function transformElementPoint(el: ExcalidrawElement, point: Point, inverse = false): Point {
  if (!el.angle) return point;
  const centerX = el.x + el.width / 2;
  const centerY = el.y + el.height / 2;
  const angle = inverse ? -el.angle : el.angle;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const dx = point.x - centerX, dy = point.y - centerY;
  return { x:centerX + dx * cos - dy * sin, y:centerY + dx * sin + dy * cos };
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

  const font = `${el.fontStyle || 'normal'} ${el.fontWeight || 'normal'} ${fontSize}px ${fontFamily}`;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = font;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${el.letterSpacing || 0}px`;

  let lines: string[];
  let width = el.width;

  if (el.width > 30) {
    lines = wrapText(text, el.width, font);
  } else {
    const rawLines = text.split('\n');
    width = Math.max(30, ...rawLines.map((l) => ctx.measureText(l).width));
    lines = rawLines;
  }

  const height = Math.max(fontSize, lines.length * fontSize * (el.lineHeight || 1.25));
  return { x: el.x, y: el.y, width, height };
}
