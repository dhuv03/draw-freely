// ──────────────────────────────────────────────
// DrawFreely — Properties Panel (Right Side)
// ──────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { useAppContext } from '../AppContext';
import { STROKE_COLORS, FILL_COLORS, STROKE_WIDTHS } from '../constants';
import type { StrokeStyle, FillStyle, ExcalidrawElement, TextAlign, VerticalAlign, ElementDefaults, ElementType } from '../types';
import { CanvasColorPicker } from './CanvasColorPicker';

export function PropertiesPanel() {
  const { state, dispatch } = useAppContext();
  const [mobileCollapsed, setMobileCollapsed] = useState(false);
  const [, setViewportRevision] = useState(0);
  useEffect(() => { const resize = () => setViewportRevision((value) => value + 1); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize); }, []);
  const { elements, selectedElementIds } = state;

  const selectedElements = elements.filter((el) =>
    selectedElementIds.includes(el.id) && !el.isDeleted
  );
  const hasSelection = selectedElements.length > 0;

  if (!state.propertiesOpen) return null;

  // If no selection and no drawing tool is active, don't show the panel
  if (!hasSelection && ['select', 'hand', 'eraser'].includes(state.activeTool)) {
    return null;
  }

  // Current values to show in fields:
  // If there's a selection, use the first selected element.
  // Otherwise, use the default properties.
  const currentProperties = hasSelection ? selectedElements[0] : state.defaultElementProps;
  
  // Current active element type (for conditional sections):
  const currentType = hasSelection ? selectedElements[0].type : state.activeTool;
  const panelDirection = state.toolbarOrientation === 'vertical'
    ? (state.toolbarPosition.x > window.innerWidth / 2 ? 'left' : 'right')
    : (state.toolbarPosition.y > window.innerHeight / 2 ? 'above' : 'below');

  const updateAll = (updates: Partial<ExcalidrawElement>) => {
    if (hasSelection) {
      dispatch({ type: 'SNAPSHOT' });
      for (const id of selectedElementIds) {
        const finalUpdates = { ...updates };
        const el = elements.find((x) => x.id === id);
        if (el && el.type === 'arrow' && updates.arrowType === 'curved') {
          if (el.points && el.points.length === 2) {
            const L = Math.hypot(el.width, el.height);
            if (L >= 1) {
              const mx = el.width / 2;
              const my = el.height / 2;
              const curvature = L * 0.15;
              const px = mx - (el.height / L) * curvature;
              const py = my + (el.width / L) * curvature;
              finalUpdates.points = [
                [0, 0, 0],
                [px, py, 0],
                [el.width, el.height, 0]
              ];
            }
          }
        }
        dispatch({ type: 'UPDATE_ELEMENT', id, updates: finalUpdates });
      }
    } else {
      dispatch({ type: 'UPDATE_DEFAULT_PROPS', updates: updates as Partial<ElementDefaults> });
    }
  };

  const align = (axis: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (selectedElements.length < 2) return;
    dispatch({ type: 'SNAPSHOT' });
    const left = Math.min(...selectedElements.map((el) => el.x));
    const right = Math.max(...selectedElements.map((el) => el.x + el.width));
    const top = Math.min(...selectedElements.map((el) => el.y));
    const bottom = Math.max(...selectedElements.map((el) => el.y + el.height));
    selectedElements.forEach((el) => {
      const updates: Partial<ExcalidrawElement> = {};
      if (axis === 'left') updates.x = left;
      if (axis === 'center') updates.x = (left + right - el.width) / 2;
      if (axis === 'right') updates.x = right - el.width;
      if (axis === 'top') updates.y = top;
      if (axis === 'middle') updates.y = (top + bottom - el.height) / 2;
      if (axis === 'bottom') updates.y = bottom - el.height;
      dispatch({ type: 'UPDATE_ELEMENT', id: el.id, updates });
    });
  };

  const distribute = (horizontal: boolean) => {
    if (selectedElements.length < 3) return;
    dispatch({ type: 'SNAPSHOT' });
    const sorted = [...selectedElements].sort((a, b) => horizontal ? a.x - b.x : a.y - b.y);
    const first = horizontal ? sorted[0].x : sorted[0].y;
    const last = horizontal ? sorted.at(-1)!.x : sorted.at(-1)!.y;
    sorted.forEach((el, index) => dispatch({ type: 'UPDATE_ELEMENT', id: el.id, updates: horizontal ? { x: first + (last - first) * index / (sorted.length - 1) } : { y: first + (last - first) * index / (sorted.length - 1) } }));
  };

  return (
    <div className={`properties-panel properties-${panelDirection} glass-panel ${mobileCollapsed ? 'mobile-collapsed' : ''}`} role="complementary" aria-label="Element properties">
      <button
        type="button"
        className="properties-collapse-btn"
        onClick={() => setMobileCollapsed((collapsed) => !collapsed)}
        aria-label={mobileCollapsed ? 'Expand properties' : 'Collapse properties'}
        aria-expanded={!mobileCollapsed}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <polyline points={mobileCollapsed ? '6 15 12 9 18 15' : '6 9 12 15 18 9'} />
        </svg>
      </button>
      {selectedElements.length > 1 && <div className="prop-section"><span className="prop-label">Align</span><div className="compact-grid">
        {(['left','center','right','top','middle','bottom'] as const).map((value) => <button key={value} onClick={() => align(value)} aria-label={`Align ${value}`}>{value.slice(0,1).toUpperCase()}</button>)}
        <button onClick={() => distribute(true)} disabled={selectedElements.length < 3} aria-label="Distribute horizontally">↔</button><button onClick={() => distribute(false)} disabled={selectedElements.length < 3} aria-label="Distribute vertically">↕</button>
      </div></div>}
      {/* Arrow Type (Straight, Curved, Elbow) */}
      {(currentType === 'arrow' || currentType === 'curvedarrow' || currentType === 'elbowarrow') && (
        <div className="prop-section">
          <span className="prop-label">Arrow Type</span>
          <div className="segmented-control">
            {[
              {
                label: 'Straight Arrow',
                typeVal: 'arrow' as ElementType,
                arrowTypeVal: 'straight' as const,
                icon: (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="19" x2="19" y2="5" />
                    <polyline points="12,5 19,5 19,12" />
                  </svg>
                )
              },
              {
                label: 'Curved Arrow',
                typeVal: 'curvedarrow' as ElementType,
                arrowTypeVal: 'curved' as const,
                icon: (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4,20 C10,12 12,8 20,4" />
                    <polyline points="14,4 20,4 20,10" />
                  </svg>
                )
              },
              {
                label: 'Elbow Arrow',
                typeVal: 'elbowarrow' as ElementType,
                arrowTypeVal: 'elbow' as const,
                icon: (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4,18 L12,18 L12,6 L20,6" />
                    <polyline points="16,2 20,6 16,10" />
                  </svg>
                )
              },
            ].map((opt) => {
              const isActive = hasSelection
                ? selectedElements[0].type === opt.typeVal
                : currentType === opt.typeVal || (currentType === 'arrow' && state.defaultElementProps.arrowType === opt.arrowTypeVal);
              return (
                <div className="tooltip-container" key={opt.label}>
                  <button
                    aria-label={opt.label}
                    className={`segment-btn ${isActive ? 'active' : ''}`}
                    style={{ width: '100%' }}
                    onClick={() => {
                      if (hasSelection) {
                        updateAll({ type: opt.typeVal });
                      } else {
                        updateAll({ arrowType: opt.arrowTypeVal });
                        dispatch({ type:'SET_TOOL', tool:opt.typeVal });
                      }
                    }}
                  >
                    {opt.icon}
                  </button>
                  <span className="tooltip-box">{opt.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stroke Color */}
      {currentType !== 'eraser' && (
        <div className="prop-section">
          <span className="prop-label">Stroke</span>
          <CanvasColorPicker value={currentProperties.strokeColor} swatches={[...STROKE_COLORS]} label="stroke colour" onChange={(color) => updateAll({ strokeColor:color })}/>
        </div>
      )}

      {/* Fill Color */}
      {!['line', 'arrow', 'curvedarrow', 'elbowarrow', 'freedraw', 'text', 'eraser'].includes(currentType) && (
        <div className="prop-section">
          <span className="prop-label">Fill</span>
          <div className="fill-color-row"><button className={`color-swatch transparent-swatch ${currentProperties.fillColor === 'transparent' ? 'active' : ''}`} onClick={() => updateAll({ fillColor:'transparent' })} aria-label="No fill"/><CanvasColorPicker value={currentProperties.fillColor === 'transparent' ? '#ffffff' : currentProperties.fillColor} swatches={FILL_COLORS.filter((color) => color !== 'transparent')} label="fill colour" onChange={(color) => updateAll({ fillColor:color })}/></div>
        </div>
      )}

      {/* Stroke Width */}
      {currentType !== 'text' && currentType !== 'eraser' && (
        <div className="prop-section">
          <span className="prop-label">Stroke Width</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {STROKE_WIDTHS.map((w) => (
              <button
                key={w}
                aria-label={`Stroke width ${w}`}
                className={`width-btn ${currentProperties.strokeWidth === w ? 'active' : ''}`}
                onClick={() => updateAll({ strokeWidth: w })}
              >
                <svg width="24" height="20" viewBox="0 0 24 20">
                  <line
                    x1="4" y1="10" x2="20" y2="10"
                    stroke="currentColor"
                    strokeWidth={w}
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stroke Style */}
      {!['freedraw', 'text', 'eraser'].includes(currentType) && (
        <div className="prop-section">
          <span className="prop-label">Stroke Style</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['solid', 'dashed', 'dotted'] as StrokeStyle[]).map((style) => (
              <button
                key={style}
                aria-label={`${style} stroke`}
                className={`style-btn ${currentProperties.strokeStyle === style ? 'active' : ''}`}
                onClick={() => updateAll({ strokeStyle: style })}
              >
                <svg width="32" height="14" viewBox="0 0 32 14">
                  <line
                    x1="2" y1="7" x2="30" y2="7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={
                      style === 'dashed' ? '6 4' : style === 'dotted' ? '2 4' : 'none'
                    }
                  />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fill Style (only for filled shapes) */}
      {currentProperties.fillColor !== 'transparent' && !['line', 'arrow', 'curvedarrow', 'elbowarrow', 'freedraw', 'text', 'eraser'].includes(currentType) && (
        <div className="prop-section">
          <span className="prop-label">Fill Style</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['hachure', 'solid', 'cross-hatch'] as FillStyle[]).map((fs) => (
              <button
                key={fs}
                className={`fill-style-btn ${currentProperties.fillStyle === fs ? 'active' : ''}`}
                onClick={() => updateAll({ fillStyle: fs })}
                style={{ fontSize: 11, textTransform: 'capitalize' }}
              >
                {fs === 'cross-hatch' ? 'X-Hatch' : fs}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sloppiness (Roughness) */}
      {currentType !== 'text' && currentType !== 'eraser' && (
        <div className="prop-section">
          <span className="prop-label">Sloppiness</span>
          <div className="segmented-control">
            {[
              {
                label: 'Architect (Sharp)',
                val: 0,
                icon: (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="4" y1="20" x2="20" y2="4" />
                  </svg>
                )
              },
              {
                label: 'Artist (Hand-drawn)',
                val: 1,
                icon: (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4,20 Q12,10 20,4" />
                  </svg>
                )
              },
              {
                label: 'Cartoonist (Sketchy)',
                val: 2,
                icon: (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3,20 C10,15 14,9 21,4" />
                    <path d="M5,21 C11,14 13,8 19,3" />
                  </svg>
                )
              },
            ].map((preset) => (
              <div className="tooltip-container" key={preset.label}>
                <button
                  aria-label={preset.label}
                  className={`segment-btn ${Math.round(currentProperties.roughness) === preset.val ? 'active' : ''}`}
                  style={{ width: '100%' }}
                  onClick={() => updateAll({ roughness: preset.val })}
                >
                  {preset.icon}
                </button>
                <span className="tooltip-box">{preset.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Opacity */}
      {currentType !== 'eraser' && (
        <div className="prop-section">
          <span className="prop-label">
            Opacity
            <span style={{ float: 'right', fontWeight: 400 }}>{currentProperties.opacity}%</span>
          </span>
          <input
            type="range"
            className="prop-slider"
            min={10}
            max={100}
            step={5}
            value={currentProperties.opacity}
            onChange={(e) => updateAll({ opacity: parseInt(e.target.value) })}
          />
        </div>
      )}

      {/* Font Size (text only) */}
      {currentType === 'text' && (
        <div className="text-controls">
          <div className="prop-section">
            <span className="prop-label">Typography</span>
            <div className="text-font-row">
              <select aria-label="Font family" value={currentProperties.fontFamily || 'Virgil'} onChange={(event) => updateAll({ fontFamily: event.target.value })}>
                <option value="Virgil">Hand drawn</option>
                <option value="sans-serif">Sans serif</option>
                <option value="Cascadia">Monospace</option>
              </select>
              <input aria-label="Font size" type="number" min="8" max="160" value={currentProperties.fontSize || 20} onChange={(event) => updateAll({ fontSize: Math.max(8, Math.min(160, Number(event.target.value))) })} />
            </div>
            <div className="segmented-control text-style-buttons">
              <button className={`segment-btn ${currentProperties.fontWeight === 'bold' ? 'active' : ''}`} onClick={() => updateAll({ fontWeight: currentProperties.fontWeight === 'bold' ? 'normal' : 'bold' })} aria-label="Bold"><strong>B</strong></button>
              <button className={`segment-btn ${currentProperties.fontStyle === 'italic' ? 'active' : ''}`} onClick={() => updateAll({ fontStyle: currentProperties.fontStyle === 'italic' ? 'normal' : 'italic' })} aria-label="Italic"><em>I</em></button>
              <button className={`segment-btn ${currentProperties.textDecoration === 'underline' ? 'active' : ''}`} onClick={() => updateAll({ textDecoration: currentProperties.textDecoration === 'underline' ? 'none' : 'underline' })} aria-label="Underline"><u>U</u></button>
            </div>
          </div>
          <div className="prop-section"><span className="prop-label">Alignment</span><div className="segmented-control">{(['left','center','right'] as TextAlign[]).map((value) => <button key={value} className={`segment-btn ${currentProperties.textAlign === value ? 'active' : ''}`} onClick={() => updateAll({ textAlign: value })} aria-label={`Text align ${value}`}>{value}</button>)}</div><div className="segmented-control text-secondary-row">{(['top','middle','bottom'] as VerticalAlign[]).map((value) => <button key={value} className={`segment-btn ${currentProperties.verticalAlign === value ? 'active' : ''}`} onClick={() => updateAll({ verticalAlign: value })}>{value}</button>)}</div></div>
          <div className="prop-section"><label className="prop-label" htmlFor="line-height">Line height <span>{(currentProperties.lineHeight || 1.25).toFixed(2)}</span></label><input id="line-height" type="range" className="prop-slider" min="1" max="2" step="0.05" value={currentProperties.lineHeight || 1.25} onChange={(event) => updateAll({ lineHeight: Number(event.target.value) })} /></div>
          <div className="prop-section"><label className="prop-label" htmlFor="letter-spacing">Letter spacing <span>{currentProperties.letterSpacing || 0}px</span></label><input id="letter-spacing" type="range" className="prop-slider" min="-1" max="12" step="0.5" value={currentProperties.letterSpacing || 0} onChange={(event) => updateAll({ letterSpacing: Number(event.target.value) })} /></div>
          <div className="prop-section"><label className="prop-label" htmlFor="text-background">Text highlight</label><div className="text-highlight-row"><button className={currentProperties.textBackgroundColor === 'transparent' ? 'active' : ''} onClick={() => updateAll({ textBackgroundColor: 'transparent' })}>None</button><input id="text-background" type="color" value={currentProperties.textBackgroundColor === 'transparent' ? '#fff3bf' : currentProperties.textBackgroundColor || '#fff3bf'} onChange={(event) => updateAll({ textBackgroundColor: event.target.value })} /></div></div>
        </div>
      )}

      {currentType === 'rectangle' && <div className="prop-section"><label className="prop-label" htmlFor="corner-radius">Corner radius <span>{currentProperties.cornerRadius || 0}px</span></label><input id="corner-radius" type="range" className="prop-slider" min="0" max="60" value={currentProperties.cornerRadius || 0} onChange={(event) => updateAll({ cornerRadius: Number(event.target.value) })} /></div>}


    </div>
  );
}
