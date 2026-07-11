// ──────────────────────────────────────────────
// DrawFreely — Persistence (IndexedDB + Export)
// ──────────────────────────────────────────────

import { openDB, type IDBPDatabase } from 'idb';
import type { ExcalidrawElement, Viewport } from '../types';
import { renderElement, getElementBounds } from '../renderer/renderElement';
import rough from 'roughjs';

// ── IndexedDB ────────────────────────────────

const DB_NAME = 'drawfreely';
const DB_VERSION = 1;
const STORE_NAME = 'appData';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

export async function saveToDB(data: {
  elements?: ExcalidrawElement[];
  viewport?: Viewport;
  theme?: 'light' | 'dark';
}) {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    if (data.elements) await store.put(data.elements, 'elements');
    if (data.viewport) await store.put(data.viewport, 'viewport');
    if (data.theme) await store.put(data.theme, 'theme');
    await tx.done;
  } catch (err) {
    console.warn('Failed to save to IndexedDB:', err);
  }
}

export async function loadFromDB(): Promise<{
  elements?: ExcalidrawElement[];
  viewport?: Viewport;
  theme?: 'light' | 'dark';
}> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const [elements, viewport, theme] = await Promise.all([
      store.get('elements'),
      store.get('viewport'),
      store.get('theme'),
    ]);
    return { elements, viewport, theme };
  } catch (err) {
    console.warn('Failed to load from IndexedDB:', err);
    return {};
  }
}

// ── Debounced Auto-save ──────────────────────

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export function debouncedSave(data: {
  elements?: ExcalidrawElement[];
  viewport?: Viewport;
  theme?: 'light' | 'dark';
}, delay = 500) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => saveToDB(data), delay);
}

// ── Export PNG ────────────────────────────────

export function exportPNG(elements: ExcalidrawElement[], theme: 'light' | 'dark') {
  const padding = 40;
  const filtered = elements.filter((el) => !el.isDeleted);
  if (filtered.length === 0) return;

  // Compute bounding box of all elements
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of filtered) {
    const b = getElementBounds(el);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }

  const width = maxX - minX + padding * 2;
  const height = maxY - minY + padding * 2;

  const canvas = document.createElement('canvas');
  const dpr = 2; // Export at 2x for crisp output
  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  // Background
  ctx.fillStyle = theme === 'dark' ? '#0f0f1a' : '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Translate so elements start at padding offset
  ctx.translate(padding - minX, padding - minY);

  const rc = rough.canvas(canvas);
  for (const el of filtered) {
    renderElement(ctx, el, rc);
  }

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'drawfreely-export.png';
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

// ── Export SVG ────────────────────────────────

export function exportSVG(elements: ExcalidrawElement[], theme: 'light' | 'dark') {
  const padding = 40;
  const filtered = elements.filter((el) => !el.isDeleted);
  if (filtered.length === 0) return;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of filtered) {
    const b = getElementBounds(el);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }

  const width = maxX - minX + padding * 2;
  const height = maxY - minY + padding * 2;

  // Render to SVG using RoughJS SVG mode
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('xmlns', svgNs);

  // Background rect
  const bg = document.createElementNS(svgNs, 'rect');
  bg.setAttribute('width', String(width));
  bg.setAttribute('height', String(height));
  bg.setAttribute('fill', theme === 'dark' ? '#0f0f1a' : '#ffffff');
  svg.appendChild(bg);

  // Container group with offset
  const g = document.createElementNS(svgNs, 'g');
  g.setAttribute('transform', `translate(${padding - minX}, ${padding - minY})`);
  svg.appendChild(g);

  const rc = rough.svg(svg);
  for (const el of filtered) {
    if (el.type === 'freedraw' || el.type === 'text') {
      // For freedraw and text, render to a small canvas and embed as image
      // (simplified — full SVG path generation is complex)
      const elGroup = document.createElementNS(svgNs, 'g');
      elGroup.setAttribute('opacity', String(el.opacity / 100));

      if (el.type === 'text' && el.text) {
        const text = document.createElementNS(svgNs, 'text');
        text.setAttribute('x', String(el.x));
        text.setAttribute('y', String(el.y));
        text.setAttribute('fill', el.strokeColor);
        text.setAttribute('font-size', String(el.fontSize || 20));
        text.setAttribute('font-family', el.fontFamily === 'Virgil' ? 'Caveat, cursive' : 'Inter, sans-serif');
        text.setAttribute('dominant-baseline', 'hanging');
        const lines = el.text.split('\n');
        lines.forEach((line, i) => {
          const tspan = document.createElementNS(svgNs, 'tspan');
          tspan.setAttribute('x', String(el.x));
          tspan.setAttribute('dy', i === 0 ? '0' : String((el.fontSize || 20) * 1.25));
          tspan.textContent = line;
          text.appendChild(tspan);
        });
        elGroup.appendChild(text);
      }
      g.appendChild(elGroup);
      continue;
    }

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
    if (el.strokeStyle === 'dashed') opts.strokeLineDash = [12, 8];
    else if (el.strokeStyle === 'dotted') opts.strokeLineDash = [3, 6];

    let node: SVGGElement | null = null;
    switch (el.type) {
      case 'rectangle':
        node = rc.rectangle(el.x, el.y, el.width, el.height, opts);
        break;
      case 'ellipse':
        node = rc.ellipse(el.x + el.width / 2, el.y + el.height / 2, Math.abs(el.width), Math.abs(el.height), opts);
        break;
      case 'diamond': {
        const w = el.width, h = el.height;
        node = rc.polygon([
          [el.x + w / 2, el.y],
          [el.x + w, el.y + h / 2],
          [el.x + w / 2, el.y + h],
          [el.x, el.y + h / 2],
        ], opts);
        break;
      }
      case 'line':
      case 'arrow':
        node = rc.line(el.x, el.y, el.x + el.width, el.y + el.height, opts);
        break;
    }
    if (node) {
      node.setAttribute('opacity', String(el.opacity / 100));
      g.appendChild(node);
    }
  }

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svg);
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'drawfreely-export.svg';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Export / Import JSON ─────────────────────

export function exportJSON(elements: ExcalidrawElement[]) {
  const data = {
    type: 'drawfreely',
    version: 1,
    elements: elements.filter((el) => !el.isDeleted),
    exportedAt: new Date().toISOString(),
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'drawing.drawfreely';
  a.click();
  URL.revokeObjectURL(url);
}

export function importJSON(file: File): Promise<ExcalidrawElement[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (data.type === 'drawfreely' && Array.isArray(data.elements)) {
          resolve(data.elements);
        } else if (Array.isArray(data)) {
          resolve(data);
        } else {
          reject(new Error('Invalid DrawFreely file format'));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
