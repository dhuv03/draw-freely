// ──────────────────────────────────────────────
// DrawFreely — Core Type Definitions
// ──────────────────────────────────────────────

export type ElementType =
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'line'
  | 'arrow'
  | 'curvedarrow'
  | 'elbowarrow'
  | 'freedraw'
  | 'text';

export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type FillStyle = 'solid' | 'hachure' | 'cross-hatch';
export type TextAlign = 'left' | 'center' | 'right';
export type VerticalAlign = 'top' | 'middle' | 'bottom';
export type Arrowhead = 'arrow' | 'dot' | 'bar' | 'triangle' | null;

export type Tool =
  | 'select'
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'line'
  | 'arrow'
  | 'curvedarrow'
  | 'elbowarrow'
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
  textAlign?: TextAlign;
  verticalAlign?: VerticalAlign;
  lineHeight?: number;
  startArrowhead?: Arrowhead;
  endArrowhead?: Arrowhead;
  seed: number;
  isDeleted?: boolean;
  curvature?: number;
  arrowType?: 'straight' | 'curved' | 'elbow';
  groupId?: string;
  locked?: boolean;
  startBindingId?: string | null;
  endBindingId?: string | null;
  cornerRadius?: number;
  name?: string;
}

export type ElementDefaults = Pick<ExcalidrawElement,
  'strokeColor' | 'fillColor' | 'strokeWidth' | 'strokeStyle' | 'roughness' |
  'opacity' | 'fillStyle' | 'angle' | 'fontSize' | 'fontFamily' | 'textAlign' |
  'verticalAlign' | 'lineHeight' | 'cornerRadius' | 'arrowType' | 'startArrowhead' |
  'endArrowhead'>;

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
  canvasBackground: string;
  history: {
    past: ExcalidrawElement[][];
    future: ExcalidrawElement[][];
  };
  editingTextId: string | null;
  editingTextClickPoint: Point | null;
  defaultElementProps: ElementDefaults;
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
  | { type: 'SET_EDITING_TEXT'; id: string | null; clickPoint?: Point | null }
  | { type: 'UPDATE_DEFAULT_PROPS'; updates: Partial<ElementDefaults> }
  | { type: 'REORDER_ELEMENTS'; ids: string[]; direction: 'front' | 'back' | 'forward' | 'backward' }
  | { type: 'SET_CANVAS_BACKGROUND'; color: string }
  | { type: 'CLEAR_CANVAS' };
