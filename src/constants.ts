// ──────────────────────────────────────────────
// DrawFreely — Constants & Defaults
// ──────────────────────────────────────────────

export const STROKE_COLORS = [
  '#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00',
  '#6741d9', '#f783ac', '#748ffc', '#099268', '#e8590c',
];

export const FILL_COLORS = [
  'transparent',
  '#ffc9c9', '#b2f2bb', '#a5d8ff', '#ffec99',
  '#d0bfff', '#fcc2d7', '#bac8ff', '#96f2d7', '#ffd8a8',
];

export const STROKE_WIDTHS = [1, 2, 4] as const;

export const FONT_SIZES = [16, 20, 28, 36] as const;

export const ZOOM_LIMITS = { min: 0.1, max: 10 };
export const ZOOM_STEP = 0.1;

export const DEFAULT_ELEMENT_PROPS = {
  strokeColor: '#1e1e1e',
  fillColor: 'transparent',
  strokeWidth: 2,
  strokeStyle: 'solid' as const,
  roughness: 1,
  opacity: 100,
  fillStyle: 'hachure' as const,
  angle: 0,
  fontSize: 20,
  fontFamily: 'Virgil',
};

export const KEYBOARD_SHORTCUTS: Record<string, string> = {
  v: 'select',
  '1': 'select',
  h: 'hand',
  r: 'rectangle',
  e: 'ellipse',
  d: 'diamond',
  a: 'arrow',
  l: 'line',
  p: 'freedraw',
  t: 'text',
  x: 'eraser',
};

export const GRID_SIZE = 20;
export const HANDLE_SIZE = 8;
export const ROTATION_HANDLE_OFFSET = 24;
export const MIN_ELEMENT_SIZE = 2;
export const HISTORY_LIMIT = 100;
export const AUTOSAVE_DEBOUNCE_MS = 500;
export const HIT_TEST_THRESHOLD = 10;
