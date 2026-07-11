// ──────────────────────────────────────────────
// DrawFreely — Core Type Definitions
// ──────────────────────────────────────────────

export type ElementType =
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'line'
  | 'arrow'
  | 'freedraw'
  | 'text';

export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type FillStyle = 'solid' | 'hachure' | 'cross-hatch';

export type Tool =
  | 'select'
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'line'
  | 'arrow'
  | 'freedraw'
  | 'text'
  | 'eraser'
  | 'hand';

export interface ExcalidrawElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roughness: number;
  opacity: number;
  fillStyle: FillStyle;
  points?: [number, number, number][];
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  startArrowhead?: 'arrow' | null;
  endArrowhead?: 'arrow' | null;
  seed: number;
  isDeleted?: boolean;
}

export interface Viewport {
  zoom: number;
  scrollX: number;
  scrollY: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppState {
  elements: ExcalidrawElement[];
  selectedElementIds: string[];
  activeTool: Tool;
  viewport: Viewport;
  theme: 'light' | 'dark';
  history: {
    past: ExcalidrawElement[][];
    future: ExcalidrawElement[][];
  };
  editingTextId: string | null;
}

export type AppAction =
  | { type: 'ADD_ELEMENT'; element: ExcalidrawElement }
  | { type: 'UPDATE_ELEMENT'; id: string; updates: Partial<ExcalidrawElement> }
  | { type: 'DELETE_ELEMENTS'; ids: string[] }
  | { type: 'SET_ELEMENTS'; elements: ExcalidrawElement[] }
  | { type: 'SET_TOOL'; tool: Tool }
  | { type: 'SET_VIEWPORT'; viewport: Partial<Viewport> }
  | { type: 'SET_SELECTION'; ids: string[] }
  | { type: 'SNAPSHOT' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'TOGGLE_THEME' }
  | { type: 'SET_THEME'; theme: 'light' | 'dark' }
  | { type: 'SET_EDITING_TEXT'; id: string | null }
  | { type: 'CLEAR_CANVAS' };
