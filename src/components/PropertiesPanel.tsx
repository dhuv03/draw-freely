// ──────────────────────────────────────────────
// DrawFreely — Properties Panel (Right Side)
// ──────────────────────────────────────────────

import { useAppContext } from '../AppContext';
import { STROKE_COLORS, FILL_COLORS, STROKE_WIDTHS } from '../constants';
import type { StrokeStyle, FillStyle } from '../types';

export function PropertiesPanel() {
  const { state, dispatch } = useAppContext();
  const { elements, selectedElementIds } = state;

  if (selectedElementIds.length === 0) return null;

  const selectedElements = elements.filter((el) =>
    selectedElementIds.includes(el.id),
  );
  if (selectedElements.length === 0) return null;

  // Use first selected element's properties as the "current" values
  const first = selectedElements[0];

  const updateAll = (updates: Record<string, any>) => {
    dispatch({ type: 'SNAPSHOT' });
    for (const id of selectedElementIds) {
      dispatch({ type: 'UPDATE_ELEMENT', id, updates });
    }
  };

  return (
    <div className="properties-panel glass-panel" role="complementary" aria-label="Element properties">
      {/* Stroke Color */}
      <div className="prop-section">
        <span className="prop-label">Stroke</span>
        <div className="color-swatches">
          {STROKE_COLORS.map((color) => (
            <button
              key={color}
              className={`color-swatch ${first.strokeColor === color ? 'active' : ''}`}
              style={{ background: color }}
              onClick={() => updateAll({ strokeColor: color })}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* Fill Color */}
      {first.type !== 'line' && first.type !== 'arrow' && first.type !== 'freedraw' && (
        <div className="prop-section">
          <span className="prop-label">Fill</span>
          <div className="color-swatches">
            {FILL_COLORS.map((color) => (
              <button
                key={color}
                className={`color-swatch ${color === 'transparent' ? 'transparent-swatch' : ''} ${first.fillColor === color ? 'active' : ''}`}
                style={color !== 'transparent' ? { background: color } : undefined}
                onClick={() => updateAll({ fillColor: color })}
                title={color === 'transparent' ? 'None' : color}
              />
            ))}
          </div>
        </div>
      )}

      {/* Stroke Width */}
      <div className="prop-section">
        <span className="prop-label">Stroke Width</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {STROKE_WIDTHS.map((w) => (
            <button
              key={w}
              className={`width-btn ${first.strokeWidth === w ? 'active' : ''}`}
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

      {/* Stroke Style */}
      <div className="prop-section">
        <span className="prop-label">Stroke Style</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['solid', 'dashed', 'dotted'] as StrokeStyle[]).map((style) => (
            <button
              key={style}
              className={`style-btn ${first.strokeStyle === style ? 'active' : ''}`}
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

      {/* Fill Style (only for filled shapes) */}
      {first.fillColor !== 'transparent' && !['line', 'arrow', 'freedraw', 'text'].includes(first.type) && (
        <div className="prop-section">
          <span className="prop-label">Fill Style</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['hachure', 'solid', 'cross-hatch'] as FillStyle[]).map((fs) => (
              <button
                key={fs}
                className={`fill-style-btn ${first.fillStyle === fs ? 'active' : ''}`}
                onClick={() => updateAll({ fillStyle: fs })}
                style={{ fontSize: 11, textTransform: 'capitalize' }}
              >
                {fs === 'cross-hatch' ? 'X-Hatch' : fs}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Roughness */}
      <div className="prop-section">
        <span className="prop-label">
          Roughness
          <span style={{ float: 'right', fontWeight: 400 }}>{first.roughness}</span>
        </span>
        <input
          type="range"
          className="prop-slider"
          min={0}
          max={3}
          step={0.5}
          value={first.roughness}
          onChange={(e) => updateAll({ roughness: parseFloat(e.target.value) })}
        />
      </div>

      {/* Opacity */}
      <div className="prop-section">
        <span className="prop-label">
          Opacity
          <span style={{ float: 'right', fontWeight: 400 }}>{first.opacity}%</span>
        </span>
        <input
          type="range"
          className="prop-slider"
          min={10}
          max={100}
          step={5}
          value={first.opacity}
          onChange={(e) => updateAll({ opacity: parseInt(e.target.value) })}
        />
      </div>

      {/* Font Size (text only) */}
      {first.type === 'text' && (
        <div className="prop-section">
          <span className="prop-label">Font Size</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[16, 20, 28, 36].map((size) => (
              <button
                key={size}
                className={`width-btn ${first.fontSize === size ? 'active' : ''}`}
                onClick={() => updateAll({ fontSize: size })}
                style={{ fontSize: 11 }}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
