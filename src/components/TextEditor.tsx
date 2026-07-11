// ──────────────────────────────────────────────
// DrawFreely — Text Editor Overlay
// ──────────────────────────────────────────────

import { useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '../AppContext';
import type { ExcalidrawElement, Viewport } from '../types';
import { DEFAULT_ELEMENT_PROPS } from '../constants';
import { nanoid } from 'nanoid';

interface TextEditorProps {
  viewport: Viewport;
  onSubmit: (element: ExcalidrawElement) => void;
}

export function TextEditor({ viewport, onSubmit }: TextEditorProps) {
  const { state, dispatch } = useAppContext();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const skipBlurRef = useRef(false);
  const editingId = state.editingTextId;

  const editingElement = editingId
    ? state.elements.find((el) => el.id === editingId)
    : null;

  const getStyle = useCallback((): React.CSSProperties | null => {
    if (!editingId) return null;

    let canvasX: number, canvasY: number;
    let fontSize = DEFAULT_ELEMENT_PROPS.fontSize;
    let fontFamily = DEFAULT_ELEMENT_PROPS.fontFamily;
    let color = DEFAULT_ELEMENT_PROPS.strokeColor;

    if (editingElement) {
      canvasX = editingElement.x;
      canvasY = editingElement.y;
      fontSize = editingElement.fontSize || fontSize;
      fontFamily = editingElement.fontFamily || fontFamily;
      color = editingElement.strokeColor;
    } else {
      try {
        const pos = JSON.parse(editingId);
        canvasX = pos.x;
        canvasY = pos.y;
      } catch {
        return null;
      }
    }

    const screenX = canvasX * viewport.zoom + viewport.scrollX;
    const screenY = canvasY * viewport.zoom + viewport.scrollY;
    const scaledFontSize = fontSize * viewport.zoom;

    const ff =
      fontFamily === 'Virgil'
        ? "'Caveat', cursive"
        : fontFamily === 'Cascadia'
          ? "'Fira Code', monospace"
          : "'Inter', Helvetica, Arial, sans-serif";

    return {
      left: screenX,
      top: screenY,
      fontSize: scaledFontSize,
      fontFamily: ff,
      color,
      lineHeight: '1.25',
      transform: 'none',
    };
  }, [editingId, editingElement, viewport]);

  const style = getStyle();

  const commitText = useCallback(
    (rawValue: string) => {
      const text = rawValue;
      if (!text.trim()) {
        dispatch({ type: 'SET_EDITING_TEXT', id: null });
        return;
      }

      if (editingElement) {
        dispatch({ type: 'SNAPSHOT' });
        dispatch({
          type: 'UPDATE_ELEMENT',
          id: editingElement.id,
          updates: { text },
        });
        dispatch({ type: 'SET_TOOL', tool: 'select' });
        dispatch({ type: 'SET_SELECTION', ids: [editingElement.id] });
      } else {
        try {
          const pos = JSON.parse(editingId!);
          const newElement: ExcalidrawElement = {
            ...DEFAULT_ELEMENT_PROPS,
            id: nanoid(),
            type: 'text',
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            text,
            seed: Math.floor(Math.random() * 100000),
          };
          onSubmit(newElement);
          dispatch({ type: 'SET_TOOL', tool: 'select' });
          dispatch({ type: 'SET_SELECTION', ids: [newElement.id] });
        } catch {
          // ignore invalid position id
        }
      }

      dispatch({ type: 'SET_EDITING_TEXT', id: null });
    },
    [editingId, editingElement, dispatch, onSubmit],
  );

  // Auto-focus when editing starts
  useEffect(() => {
    skipBlurRef.current = false;
    const ta = textareaRef.current;
    if (!ta || !style) return;

    ta.value = editingElement?.text ?? '';
    ta.style.width = 'auto';
    ta.style.height = 'auto';
    ta.style.width = Math.max(40, ta.scrollWidth) + 'px';
    ta.style.height = Math.max(24, ta.scrollHeight) + 'px';

    const raf = requestAnimationFrame(() => {
      ta.focus();
      if (editingElement?.text) {
        ta.setSelectionRange(ta.value.length, ta.value.length);
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      skipBlurRef.current = true;
    };
  }, [editingId, editingElement, style]);

  const handleSubmit = useCallback(() => {
    if (skipBlurRef.current) return;
    const ta = textareaRef.current;
    if (!ta) return;
    commitText(ta.value);
  }, [commitText]);

  const handleInput = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.width = 'auto';
    ta.style.height = 'auto';
    ta.style.width = Math.max(40, ta.scrollWidth) + 'px';
    ta.style.height = Math.max(24, ta.scrollHeight) + 'px';
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();

      if (e.key === 'Escape') {
        dispatch({ type: 'SET_EDITING_TEXT', id: null });
        e.preventDefault();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        commitText((e.target as HTMLTextAreaElement).value);
      }
    },
    [dispatch, commitText],
  );

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  if (!editingId || !style) return null;

  return (
    <textarea
      ref={textareaRef}
      className="text-editor-overlay"
      style={style}
      onBlur={handleSubmit}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      spellCheck={false}
      autoComplete="off"
    />
  );
}
