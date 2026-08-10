// ──────────────────────────────────────────────
// DrawFreely — App Context + State Reducer
// ──────────────────────────────────────────────

import React, { createContext, useContext, useReducer, type Dispatch } from 'react';
import type { AppState, AppAction } from './types';
import { HISTORY_LIMIT, DEFAULT_ELEMENT_PROPS } from './constants';

// ── Initial State ────────────────────────────
export const initialState: AppState = {
  elements: [],
  selectedElementIds: [],
  activeTool: 'select',
  viewport: { zoom: 1, scrollX: 0, scrollY: 0 },
  theme: 'light',
  canvasBackground: '#ffffff',
  history: { past: [], future: [] },
  editingTextId: null,
  editingTextClickPoint: null,
  defaultElementProps: { ...DEFAULT_ELEMENT_PROPS },
};

// ── Reducer ──────────────────────────────────
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'ADD_ELEMENT':
      return { ...state, elements: [...state.elements, action.element] };

    case 'UPDATE_ELEMENT':
      return {
        ...state,
        elements: state.elements.map((el) =>
          el.id === action.id ? { ...el, ...action.updates } : el,
        ),
      };

    case 'DELETE_ELEMENTS':
      return {
        ...state,
        elements: state.elements.filter((el) => !action.ids.includes(el.id)),
        selectedElementIds: state.selectedElementIds.filter(
          (id) => !action.ids.includes(id),
        ),
      };

    case 'SET_ELEMENTS':
      return { ...state, elements: action.elements };

    case 'SET_TOOL':
      return {
        ...state,
        activeTool: action.tool,
        // Clear selection when switching away from select
        selectedElementIds:
          action.tool !== 'select' ? [] : state.selectedElementIds,
      };

    case 'SET_VIEWPORT':
      return {
        ...state,
        viewport: { ...state.viewport, ...action.viewport },
      };

    case 'SET_SELECTION':
      return { ...state, selectedElementIds: action.ids };

    case 'SNAPSHOT': {
      const past = [
        ...state.history.past,
        state.elements.map((el) => ({ ...el })),
      ];
      if (past.length > HISTORY_LIMIT) past.shift();
      return { ...state, history: { past, future: [] } };
    }

    case 'UNDO': {
      if (state.history.past.length === 0) return state;
      const past = [...state.history.past];
      const previous = past.pop()!;
      return {
        ...state,
        elements: previous,
        selectedElementIds: [],
        history: {
          past,
          future: [
            state.elements.map((el) => ({ ...el })),
            ...state.history.future,
          ],
        },
      };
    }

    case 'REDO': {
      if (state.history.future.length === 0) return state;
      const future = [...state.history.future];
      const next = future.shift()!;
      return {
        ...state,
        elements: next,
        selectedElementIds: [],
        history: {
          past: [
            ...state.history.past,
            state.elements.map((el) => ({ ...el })),
          ],
          future,
        },
      };
    }

    case 'TOGGLE_THEME':
      return state.theme === 'light'
        ? { ...state, theme: 'dark', canvasBackground: state.canvasBackground.toLowerCase() === '#ffffff' ? '#121212' : state.canvasBackground }
        : { ...state, theme: 'light', canvasBackground: ['#121212', '#0f0f1a'].includes(state.canvasBackground.toLowerCase()) ? '#ffffff' : state.canvasBackground };

    case 'SET_THEME':
      return { ...state, theme: action.theme, canvasBackground: action.theme === 'dark' && state.canvasBackground === '#ffffff' ? '#121212' : action.theme === 'light' && ['#121212', '#0f0f1a'].includes(state.canvasBackground) ? '#ffffff' : state.canvasBackground };

    case 'SET_CANVAS_BACKGROUND':
      return { ...state, canvasBackground: action.color };

    case 'REORDER_ELEMENTS': {
      const ids = new Set(action.ids);
      const selected = state.elements.filter((el) => ids.has(el.id));
      const rest = state.elements.filter((el) => !ids.has(el.id));
      if (action.direction === 'front') return { ...state, elements: [...rest, ...selected] };
      if (action.direction === 'back') return { ...state, elements: [...selected, ...rest] };
      const next = [...state.elements];
      const step = action.direction === 'forward' ? 1 : -1;
      const indexes = next.map((el, i) => ids.has(el.id) ? i : -1).filter((i) => i >= 0);
      const ordered = step > 0 ? indexes.reverse() : indexes;
      for (const i of ordered) {
        const j = i + step;
        if (j >= 0 && j < next.length && !ids.has(next[j].id)) [next[i], next[j]] = [next[j], next[i]];
      }
      return { ...state, elements: next };
    }

    case 'SET_EDITING_TEXT':
      return {
        ...state,
        editingTextId: action.id,
        editingTextClickPoint: action.clickPoint || null,
      };

    case 'UPDATE_DEFAULT_PROPS':
      return {
        ...state,
        defaultElementProps: {
          ...state.defaultElementProps,
          ...action.updates,
        },
      };

    case 'CLEAR_CANVAS':
      return {
        ...state,
        elements: [],
        selectedElementIds: [],
        history: {
          past: [
            ...state.history.past,
            state.elements.map((el) => ({ ...el })),
          ],
          future: [],
        },
      };

    default:
      return state;
  }
}

// ── Context ──────────────────────────────────
interface AppContextType {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
