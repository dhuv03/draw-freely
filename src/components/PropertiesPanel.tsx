// ──────────────────────────────────────────────
// DrawFreely — Properties Panel (Right Side)
// ──────────────────────────────────────────────

import { useAppContext } from '../AppContext';
import { STROKE_COLORS, FILL_COLORS, STROKE_WIDTHS } from '../constants';
import type { StrokeStyle, FillStyle } from '../types';

export function PropertiesPanel() {
  const { state, dispatch } = useAppContext();
  const { elements, selectedElementIds } = state;

  const selectedElements = elements.filter((el) =>
    selectedElementIds.includes(el.id) && !el.isDeleted
  );
  const hasSelection = selectedElements.length > 0;

  // If no selection and no drawing tool is active, don't show the panel
  if (!hasSelection && ['select', 'hand', 'eraser'].includes(state.activeTool)) {
    return null;
  }

  // Current values to show in fields:
  // If there's a selection, use the first selected element.
  // Otherwise, use the default properties.
  const currentProperties = hasSelection ? selectedElements[0] : state.defaultElementProps;
  
  // Current active element type (for conditional sections):
  const currentType = hasSelection ? currentProperties.type : state.activeTool;

  const updateAll = (updates: Record<string, any>) => {
    if (hasSelection) {
      dispatch({ type: 'SNAPSHOT' });
      for (const id of selectedElementIds) {
        let finalUpdates = { ...updates };
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
      dispatch({ type: 'UPDATE_DEFAULT_PROPS', updates });
    }
  };

  return (
    <div className="properties-panel glass-panel" role="complementary" aria-label="Element properties">
      {/* Arrow Type (Straight, Curved, Elbow) */}
      {(currentType === 'arrow' || currentType === 'curvedarrow' || currentType === 'elbowarrow') && (
        <div className="prop-section">
          <span className="prop-label">Arrow Type</span>
          <div className="segmented-control">
            {[
              {
                label: 'Straight Arrow',
                typeVal: 'arrow',
                arrowTypeVal: 'straight',
                icon: (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="19" x2="19" y2="5" />
                    <polyline points="12,5 19,5 19,12" />
                  </svg>
                )
              },
              {
                label: 'Curved Arrow',
                typeVal: 'curvedarrow',
                arrowTypeVal: 'curved',
                icon: (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4,20 C10,12 12,8 20,4" />
                    <polyline points="14,4 20,4 20,10" />
                  </svg>
                )
              },
              {
                label: 'Elbow Arrow',
                typeVal: 'elbowarrow',
                arrowTypeVal: 'elbow',
                icon: (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4,18 L12,18 L12,6 L20,6" />
                    <polyline points="16,2 20,6 16,10" />
                  </svg>
                )
              },
            ].map((opt) => {
              const isActive = hasSelection
                ? currentProperties.type === opt.typeVal
                : state.defaultElementProps.arrowType === opt.arrowTypeVal;
              return (
                <div className="tooltip-container" key={opt.label}>
                  <button
                    className={`segment-btn ${isActive ? 'active' : ''}`}
                    style={{ width: '100%' }}
                    onClick={() => {
                      if (hasSelection) {
                        updateAll({ type: opt.typeVal });
                      } else {
                        updateAll({ arrowType: opt.arrowTypeVal });
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
          <div className="color-swatches">
            {STROKE_COLORS.map((color) => (
              <button
                key={color}
                className={`color-swatch ${currentProperties.strokeColor === color ? 'active' : ''}`}
                style={{ background: color }}
                onClick={() => updateAll({ strokeColor: color })}
                title={color}
              />
            ))}
          </div>
        </div>
      )}

      {/* Fill Color */}
      {!['line', 'arrow', 'curvedarrow', 'elbowarrow', 'freedraw', 'text', 'eraser'].includes(currentType) && (
        <div className="prop-section">
          <span className="prop-label">Fill</span>
          <div className="color-swatches">
            {FILL_COLORS.map((color) => (
              <button
                key={color}
                className={`color-swatch ${color === 'transparent' ? 'transparent-swatch' : ''} ${currentProperties.fillColor === color ? 'active' : ''}`}
                style={color !== 'transparent' ? { background: color } : undefined}
                onClick={() => updateAll({ fillColor: color })}
                title={color === 'transparent' ? 'None' : color}
              />
            ))}
          </div>
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
        <div className="prop-section">
          <span className="prop-label">Font Size</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[16, 20, 28, 36].map((size) => (
              <button
                key={size}
                className={`width-btn ${currentProperties.fontSize === size ? 'active' : ''}`}
                onClick={() => updateAll({ fontSize: size })}
                style={{ fontSize: 11 }}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Font Family (text only) */}
      {currentType === 'text' && (
        <div className="prop-section">
          <span className="prop-label">Font Family</span>
          <div className="segmented-control">
            {[
              { label: 'Hand-drawn', val: 'Virgil' },
              { label: 'Normal', val: 'sans-serif' },
              { label: 'Code', val: 'Cascadia' },
            ].map((font) => (
              <button
                key={font.label}
                className={`segment-btn ${currentProperties.fontFamily === font.val ? 'active' : ''}`}
                onClick={() => updateAll({ fontFamily: font.val })}
              >
                {font.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
