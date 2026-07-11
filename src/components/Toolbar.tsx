// ──────────────────────────────────────────────
// DrawFreely — Toolbar (Left Side)
// ──────────────────────────────────────────────

import type { ReactElement } from 'react';
import { useAppContext } from '../AppContext';
import type { Tool } from '../types';

interface ToolDef {
  id: Tool;
  label: string;
  shortcut: string;
  icon: ReactElement;
}

const tools: ToolDef[] = [
  {
    id: 'select',
    label: 'Select',
    shortcut: 'V',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 3l14 9-7 2-3 7z" />
        <path d="M12 14l4 6" />
      </svg>
    ),
  },
  {
    id: 'hand',
    label: 'Hand',
    shortcut: 'H',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 11V6a2 2 0 0 0-4 0v1M14 10V4a2 2 0 0 0-4 0v7M10 10.5V5a2 2 0 0 0-4 0v9" />
        <path d="M18 11a2 2 0 0 1 4 0v5a8 8 0 0 1-8 8h-2c-3.3 0-5.2-1.5-7-4l-1.3-2a2 2 0 0 1 3-2.5L8 16" />
      </svg>
    ),
  },
  {
    id: 'rectangle',
    label: 'Rectangle',
    shortcut: 'R',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
      </svg>
    ),
  },
  {
    id: 'ellipse',
    label: 'Ellipse',
    shortcut: 'E',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="12" rx="10" ry="8" />
      </svg>
    ),
  },
  {
    id: 'diamond',
    label: 'Diamond',
    shortcut: 'D',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l10 10-10 10L2 12z" />
      </svg>
    ),
  },
  {
    id: 'arrow',
    label: 'Arrow',
    shortcut: 'A',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 19L19 5" />
        <path d="M12 5h7v7" />
      </svg>
    ),
  },
  {
    id: 'line',
    label: 'Line',
    shortcut: 'L',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="19" x2="19" y2="5" />
      </svg>
    ),
  },
  {
    id: 'freedraw',
    label: 'Pencil',
    shortcut: 'P',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
        <path d="M15 5l4 4" />
      </svg>
    ),
  },
  {
    id: 'text',
    label: 'Text',
    shortcut: 'T',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 7 4 4 20 4 20 7" />
        <line x1="9" y1="20" x2="15" y2="20" />
        <line x1="12" y1="4" x2="12" y2="20" />
      </svg>
    ),
  },
  {
    id: 'eraser',
    label: 'Eraser',
    shortcut: 'X',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L14.6 1.6c.8-.8 2-.8 2.8 0l5 5c.8.8.8 2 0 2.8L12 20" />
        <path d="M6 11l5 5" />
      </svg>
    ),
  },
];

export function Toolbar() {
  const { state, dispatch } = useAppContext();

  return (
    <div className="toolbar glass-panel" role="toolbar" aria-label="Drawing tools">
      {tools.map((tool) => (
        <button
          key={tool.id}
          className={`toolbar-btn ${state.activeTool === tool.id ? 'active' : ''}`}
          onClick={() => dispatch({ type: 'SET_TOOL', tool: tool.id })}
          title={`${tool.label} (${tool.shortcut})`}
          aria-pressed={state.activeTool === tool.id}
        >
          {tool.icon}
          <span className="toolbar-tooltip">
            {tool.label}
            <span className="shortcut">{tool.shortcut}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
