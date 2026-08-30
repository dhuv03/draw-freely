import { APP_THEMES, getThemeCanvas, getThemePalette } from '../constants';
import { useAppContext } from '../AppContext';
import { CanvasColorPicker } from './CanvasColorPicker';
import type { AppearanceMode, Tool } from '../types';
import { useState } from 'react';

interface Props { onClose: () => void }
const toolRows: Array<{ label: string; description: string; tools: Tool[] }> = [
  { label: 'Select & hand', description: 'Selection and canvas navigation tools', tools: ['select', 'hand'] },
  { label: 'Pencil', description: 'Freehand drawing tool', tools: ['freedraw'] },
  { label: 'Eraser', description: 'Classic circular eraser tool', tools: ['eraser'] },
  { label: 'Shapes', description: 'Rectangle, ellipse, diamond, triangle, lines and arrows', tools: ['rectangle', 'ellipse', 'diamond', 'triangle', 'line', 'arrow', 'curvedarrow', 'elbowarrow'] },
  { label: 'Text', description: 'Text tool and typography panel', tools: ['text'] },
];

export function SettingsModal({ onClose }: Props) {
  const { state, dispatch } = useAppContext();
  const [tab, setTab] = useState<'appearance' | 'tools' | 'interface' | 'canvas' | 'help'>('appearance');
  const toggleRow = (tools: Tool[]) => {
    const enabled = tools.some((tool) => !state.hiddenTools.includes(tool));
    const next = enabled ? Array.from(new Set([...state.hiddenTools, ...tools])) : state.hiddenTools.filter((tool) => !tools.includes(tool));
    dispatch({ type: 'SET_HIDDEN_TOOLS', tools: next });
  };
  const chooseAppearance = (mode: AppearanceMode) => {
    const palette = getThemePalette(state.themeId);
    const resolvedTheme = mode === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode;
    dispatch({ type: 'SET_APPEARANCE_MODE', mode, resolvedTheme, canvasBackground: getThemeCanvas(palette.id, resolvedTheme) });
  };

  return <div className="settings-backdrop" onPointerDown={onClose}>
    <section className="settings-modal" role="dialog" aria-modal="true" aria-label="Settings" onPointerDown={(event) => event.stopPropagation()}>
      <header><div><strong>DrawFreely</strong><span>Settings</span></div><button onClick={onClose} aria-label="Close settings">×</button></header>
      <div className="settings-layout">
        <nav><button className={tab === 'appearance' ? 'active' : ''} onClick={() => setTab('appearance')}>Appearance</button><button className={tab === 'tools' ? 'active' : ''} onClick={() => setTab('tools')}>Drawing tools</button><button className={tab === 'interface' ? 'active' : ''} onClick={() => setTab('interface')}>Interface</button><button className={tab === 'canvas' ? 'active' : ''} onClick={() => setTab('canvas')}>Canvas</button><button className={tab === 'help' ? 'active' : ''} onClick={() => setTab('help')}>Help</button></nav>
        <main>
          {tab === 'appearance' && <section><h3>Appearance</h3><p>Appearance and accent colour are independent; every palette works in light and dark.</p><div className="appearance-toggle"><button className={state.appearanceMode === 'system' ? 'active' : ''} onClick={() => chooseAppearance('system')}>System</button><button className={state.appearanceMode === 'light' ? 'active' : ''} onClick={() => chooseAppearance('light')}>Light</button><button className={state.appearanceMode === 'dark' ? 'active' : ''} onClick={() => chooseAppearance('dark')}>Dark</button></div><div className="settings-theme-grid">{APP_THEMES.map((theme) => <button key={theme.id} className={state.themeId === theme.id ? 'active' : ''} onClick={() => dispatch({ type: 'SET_THEME_ID', themeId: theme.id, appearance: state.theme, canvasBackground: getThemeCanvas(theme.id, state.theme) })}><i style={{ background: theme.accent }} /><span>{theme.name}</span></button>)}</div></section>}
          {tab === 'tools' && <section><h3>Drawing tools</h3>{toolRows.map((row) => { const enabled = row.tools.some((tool) => !state.hiddenTools.includes(tool)); return <div className="setting-row" key={row.label}><div><strong>{row.label}</strong><span>{row.description}</span></div><button className={`switch ${enabled ? 'on' : ''}`} onClick={() => toggleRow(row.tools)} aria-pressed={enabled}><i /></button></div>; })}</section>}
          {tab === 'interface' && <section><h3>Toolbar</h3><p>Drag the six-dot handle anytime to move it out of your drawing area.</p><div className="setting-row"><div><strong>Orientation</strong><span>Choose a vertical or horizontal floating toolbar</span></div><div className="appearance-toggle compact"><button className={state.toolbarOrientation === 'vertical' ? 'active' : ''} onClick={() => dispatch({ type: 'SET_TOOLBAR_ORIENTATION', orientation: 'vertical' })}>Vertical</button><button className={state.toolbarOrientation === 'horizontal' ? 'active' : ''} onClick={() => dispatch({ type: 'SET_TOOLBAR_ORIENTATION', orientation: 'horizontal' })}>Horizontal</button></div></div><button className="reset-toolbar" onClick={() => dispatch({ type: 'SET_TOOLBAR_POSITION', position: state.toolbarOrientation === 'horizontal' ? { x: 54, y: 12 } : { x: 16, y: 160 } })}>Reset toolbar position</button></section>}
          {tab === 'canvas' && <section><h3>Canvas</h3><p>Canvas colour and background patterns remain separate from element styling.</p><div className="setting-row canvas-setting-row"><div><strong>Canvas background</strong><span>Choose a preset or enter an exact hex code</span></div><CanvasColorPicker value={state.canvasBackground} onChange={(color) => dispatch({ type:'SET_CANVAS_BACKGROUND', color })}/></div></section>}
          {tab === 'help' && <section><h3>Help</h3><p>Double-click any tool—including a shape inside the Shapes menu—to pin it. Drag the six-dot handle to reposition the toolbar. Press Escape to return to Select.</p></section>}
        </main>
      </div>
    </section>
  </div>;
}
