// ──────────────────────────────────────────────
// DrawFreely — Text Editor Overlay
// ──────────────────────────────────────────────

import { useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '../AppContext';
import type { ExcalidrawElement, Viewport } from '../types';
import { DEFAULT_ELEMENT_PROPS } from '../constants';
import { nanoid } from 'nanoid';
import { wrapText, measureTextElement } from '../renderer/renderElement';

interface TextEditorProps {
  viewport: Viewport;
  onSubmit: (element: ExcalidrawElement) => void;
}

function getCaretIndexAtPoint(
  el: ExcalidrawElement,
  clickX: number,
  clickY: number
): number {
  const text = el.text || '';
  const fontSize = el.fontSize || 20;
  const fontFamily =
    el.fontFamily === 'Virgil'
      ? "'Caveat', cursive"
      : el.fontFamily === 'Cascadia'
        ? "'Fira Code', monospace"
        : "'Inter', Helvetica, Arial, sans-serif";

  const font = `${fontSize}px ${fontFamily}`;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = font;

  const paragraphs = text.split('\n');
  const lineHeight = fontSize * 1.25;
  const localY = clickY - el.y;
  let clickedLineIdx = Math.floor(localY / lineHeight);
  clickedLineIdx = Math.max(0, clickedLineIdx);

  let currentWrappedLineIdx = 0;
  let rawCharOffset = 0;
  let found = false;
  let caretIndex = 0;

  for (let p = 0; p < paragraphs.length; p++) {
    const paragraph = paragraphs[p];
    const pLines = el.width > 30 ? wrapText(paragraph, el.width, font) : [paragraph];
    
    if (!found && clickedLineIdx >= currentWrappedLineIdx && clickedLineIdx < currentWrappedLineIdx + pLines.length) {
      const lineInP = clickedLineIdx - currentWrappedLineIdx;
      const targetLine = pLines[lineInP] || '';
      
      const localX = clickX - el.x;
      let charInLine = 0;
      let minDiff = Infinity;
      for (let i = 0; i <= targetLine.length; i++) {
        const width = ctx.measureText(targetLine.substring(0, i)).width;
        const diff = Math.abs(width - localX);
        if (diff < minDiff) {
          minDiff = diff;
          charInLine = i;
        }
      }
      
      let charsBeforeLine = 0;
      const idxInParagraph = paragraph.indexOf(targetLine);
      if (idxInParagraph !== -1) {
        charsBeforeLine = idxInParagraph;
      } else {
        for (let j = 0; j < lineInP; j++) {
          charsBeforeLine += (pLines[j] || '').length + 1;
        }
      }
      
      caretIndex = rawCharOffset + charsBeforeLine + charInLine;
      found = true;
    }
    
    rawCharOffset += paragraph.length + 1;
    currentWrappedLineIdx += pLines.length;
  }

  if (!found) {
    caretIndex = text.length;
  }
  
  return Math.max(0, Math.min(text.length, caretIndex));
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

    const widthStyle: React.CSSProperties = {};
    if (editingElement && editingElement.width > 30) {
      widthStyle.width = editingElement.width * viewport.zoom;
    }

    return {
      left: screenX,
      top: screenY,
      fontSize: scaledFontSize,
      fontFamily: ff,
      color,
      lineHeight: '1.25',
      transform: 'none',
      ...widthStyle,
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
        
        // Measure text bounds
        const tempEl = { ...editingElement, text };
        const bounds = measureTextElement(tempEl);

        const updates: Partial<ExcalidrawElement> = {
          text,
          height: bounds.height,
        };
        // Only update width if text is not wrapped or was extremely narrow
        if (editingElement.width <= 30) {
          updates.width = bounds.width;
        }

        dispatch({
          type: 'UPDATE_ELEMENT',
          id: editingElement.id,
          updates,
        });
        dispatch({ type: 'SET_TOOL', tool: 'select' });
        dispatch({ type: 'SET_SELECTION', ids: [editingElement.id] });
      } else {
        try {
          const pos = JSON.parse(editingId!);
          const tempEl = {
            angle: 0,
            strokeColor: '#000000',
            fillColor: 'transparent',
            strokeWidth: 2,
            strokeStyle: 'solid',
            roughness: 1,
            opacity: 100,
            fillStyle: 'hachure',
            ...state.defaultElementProps,
            id: nanoid(),
            type: 'text',
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            text,
            seed: 0,
          } as ExcalidrawElement;
          const bounds = measureTextElement(tempEl);

          const newElement = {
            angle: 0,
            strokeColor: '#000000',
            fillColor: 'transparent',
            strokeWidth: 2,
            strokeStyle: 'solid',
            roughness: 1,
            opacity: 100,
            fillStyle: 'hachure',
            ...state.defaultElementProps,
            id: nanoid(),
            type: 'text',
            x: pos.x,
            y: pos.y,
            width: bounds.width,
            height: bounds.height,
            text,
            seed: Math.floor(Math.random() * 100000),
          } as ExcalidrawElement;
          onSubmit(newElement);
          dispatch({ type: 'SET_TOOL', tool: 'select' });
          dispatch({ type: 'SET_SELECTION', ids: [newElement.id] });
        } catch {
          // ignore invalid position id
        }
      }

      dispatch({ type: 'SET_EDITING_TEXT', id: null });
    },
    [editingId, editingElement, dispatch, onSubmit, state.defaultElementProps],
  );

  // Auto-focus when editing starts
  useEffect(() => {
    skipBlurRef.current = false;
    const ta = textareaRef.current;
    if (!ta || !style) return;

    ta.value = editingElement?.text ?? '';
    
    if (editingElement && editingElement.width > 30) {
      ta.style.width = (editingElement.width * viewport.zoom) + 'px';
      ta.style.height = Math.max(24, ta.scrollHeight) + 'px';
    } else {
      ta.style.width = 'auto';
      ta.style.height = 'auto';
      ta.style.width = Math.max(40, ta.scrollWidth) + 'px';
      ta.style.height = Math.max(24, ta.scrollHeight) + 'px';
    }

    const raf = requestAnimationFrame(() => {
      ta.focus();
      if (editingElement?.text) {
        let caretIndex = ta.value.length;
        if (state.editingTextClickPoint) {
          caretIndex = getCaretIndexAtPoint(
            editingElement,
            state.editingTextClickPoint.x,
            state.editingTextClickPoint.y
          );
        }
        ta.setSelectionRange(caretIndex, caretIndex);
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      skipBlurRef.current = true;
    };
  }, [editingId, editingElement, style, state.editingTextClickPoint, viewport.zoom]);

  const handleSubmit = useCallback(() => {
    if (skipBlurRef.current) return;
    const ta = textareaRef.current;
    if (!ta) return;
    commitText(ta.value);
  }, [commitText]);

  const handleInput = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (editingElement && editingElement.width > 30) {
      ta.style.height = 'auto';
      ta.style.height = Math.max(24, ta.scrollHeight) + 'px';
    } else {
      ta.style.width = 'auto';
      ta.style.height = 'auto';
      ta.style.width = Math.max(40, ta.scrollWidth) + 'px';
      ta.style.height = Math.max(24, ta.scrollHeight) + 'px';
    }
  }, [editingElement, viewport.zoom]);

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
