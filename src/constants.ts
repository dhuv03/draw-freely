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
  textAlign: 'left' as const,
  verticalAlign: 'top' as const,
  lineHeight: 1.25,
  fontWeight: 'normal' as const,
  fontStyle: 'normal' as const,
  textDecoration: 'none' as const,
  letterSpacing: 0,
  textBackgroundColor: 'transparent',
  cornerRadius: 8,
  arrowType: 'straight' as const,
  startArrowhead: null,
  endArrowhead: 'arrow' as const,
};

export const APP_THEMES = [
  { id: 'neutral', name: 'Neutral', lightCanvas: '#ffffff', darkCanvas: '#171717', accent: '#171717' },
  { id: 'blue', name: 'Blue', lightCanvas: '#f7fbff', darkCanvas: '#101b2d', accent: '#2563eb' },
  { id: 'green', name: 'Green', lightCanvas: '#f6fdf9', darkCanvas: '#0d2218', accent: '#16a34a' },
  { id: 'yellow', name: 'Yellow', lightCanvas: '#fffdf5', darkCanvas: '#29220d', accent: '#d89b00' },
  { id: 'pink', name: 'Pink', lightCanvas: '#fff7fb', darkCanvas: '#2b1422', accent: '#e83e8c' },
  { id: 'orange', name: 'Orange', lightCanvas: '#fff9f5', darkCanvas: '#2b190d', accent: '#ea580c' },
  { id: 'purple', name: 'Purple', lightCanvas: '#fbf8ff', darkCanvas: '#21152e', accent: '#9333ea' },
  { id: 'slate', name: 'Slate', lightCanvas: '#ffffff', darkCanvas: '#0f172a', accent: '#64748b' },
  { id: 'graphite', name: 'Graphite', lightCanvas: '#fafafa', darkCanvas: '#18181b', accent: '#71717a' },
  { id: 'indigo', name: 'Indigo', lightCanvas: '#f5f7ff', darkCanvas: '#111827', accent: '#6366f1' },
  { id: 'violet', name: 'Violet', lightCanvas: '#faf5ff', darkCanvas: '#1f1833', accent: '#a855f7' },
  { id: 'emerald', name: 'Emerald', lightCanvas: '#f7fffb', darkCanvas: '#07251b', accent: '#10b981' },
  { id: 'rose', name: 'Rose', lightCanvas: '#fff8fa', darkCanvas: '#2b1018', accent: '#f43f5e' },
  { id: 'sepia', name: 'Sepia', lightCanvas: '#f7f0df', darkCanvas: '#292117', accent: '#9a6b3f' },
  { id: 'solarized', name: 'Solarized', lightCanvas: '#fdf6e3', darkCanvas: '#002b36', accent: '#268bd2' },
  { id: 'gruvbox', name: 'Gruvbox', lightCanvas: '#fbf1c7', darkCanvas: '#282828', accent: '#b57614' },
] as const;

export function getThemePalette(themeId: import('./types').ThemeId) {
  return APP_THEMES.find((theme) => theme.id === themeId) || APP_THEMES[0];
}

export function getThemeCanvas(themeId: import('./types').ThemeId, appearance: 'light' | 'dark') {
  const palette = getThemePalette(themeId);
  return appearance === 'dark' ? palette.darkCanvas : palette.lightCanvas;
}

export const KEYBOARD_SHORTCUTS: Record<string, string> = {
  v: 'select',
  '1': 'select',
  h: 'hand',
  r: 'rectangle',
  e: 'ellipse',
  d: 'diamond',
  g: 'triangle',
  a: 'arrow',
  c: 'curvedarrow',
  q: 'elbowarrow',
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
