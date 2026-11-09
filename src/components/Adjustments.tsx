import { useEffect, useState } from 'react';
import { DEFAULT_GEOMETRY, DEFAULT_SETTINGS } from '../core/settings';
import { PRESETS } from '../core/presets';
import type { Geometry, PresetId, ProcessingSettings } from '../core/types';
import { Slider, Toggle } from './Controls';
import { Icon } from './Icon';

type NumericSetting = { [K in keyof ProcessingSettings]: ProcessingSettings[K] extends number ? K : never }[keyof ProcessingSettings];
export function Adjustments({ settings, geometry, preset, onAdjust, onPreset, onGeometry, onReset, disabled, bins }: {
  settings: ProcessingSettings; geometry: Geometry; preset: PresetId | null; onAdjust: (patch: Partial<ProcessingSettings>) => void;
  onPreset: (preset: PresetId) => void; onGeometry: (geometry: Geometry) => void; onReset: () => void; disabled: boolean; bins?: Uint32Array;
}) {
  const [crop, setCrop] = useState({ left: 0, top: 0, right: 0, bottom: 0 });
  useEffect(() => {
    const c = geometry.crop;
    const percent = (value: number) => Number((value * 100).toFixed(2));
    setCrop({ left: percent(c.x), top: percent(c.y), right: percent(1 - c.x - c.width), bottom: percent(1 - c.y - c.height) });
  }, [geometry.crop]);
  function slider(key: NumericSetting, label: string, min: number, max: number, hint: string, step = 1, inactive = false, unit = '') {
    return <Slider key={key} label={label} value={settings[key]} min={min} max={max} step={step} hint={hint} unit={unit}
      disabled={disabled || inactive} onChange={value => onAdjust({ [key]: value })} onReset={() => onAdjust({ [key]: DEFAULT_SETTINGS[key] })} />;
  }
  const histogramMax = bins ? Math.max(...bins) : 1;
  const histogramPath = bins ? `M0,44 ${Array.from(bins, (n, i) => `L${i},${44 - 42 * Math.log1p(n) / Math.log1p(histogramMax || 1)}`).join(' ')} L255,44Z` : '';
  return <aside className="adjustments" aria-label="Document adjustments">
    <div className="sidebar-heading"><div><span className="eyebrow">MAKE IT PRINT-READY</span><h1>A little more clarity.</h1></div><Icon name="sliders" size={21} /></div>
    <section className="sidebar-section preset-section">
      <div className="section-heading"><h2>Start with a preset</h2><span className="muted-label">ONE CLICK</span></div>
      <div className="presets">{PRESETS.map(item => <button className={`preset ${preset === item.id ? 'active' : ''}`} key={item.id} onClick={() => onPreset(item.id)} disabled={disabled} aria-pressed={preset === item.id}>
        <span className={`preset-icon ${item.id}`}><Icon name={item.icon} size={20} /></span>
        <span><strong>{item.name}</strong><small>{item.description}</small></span>
        <span className="preset-radio">{preset === item.id && <Icon name="check" size={11} />}</span>
      </button>)}</div>
      <p className="section-note">A starting point. Every setting is yours to adjust.</p>
    </section>
    <section className="sidebar-section">
      <div className="section-heading"><h2>Fine-tune</h2><button className="text-button" onClick={onReset} disabled={disabled}>Reset all</button></div>
      <Toggle label="Grayscale" checked={settings.grayscale} disabled={disabled || settings.thresholdMode !== 'off'} onChange={grayscale => onAdjust({ grayscale })} hint="Convert color to Rec. 709 luminance. Thresholding always uses grayscale." />
      {slider('brightness', 'Brightness', -100, 100, 'Add an intensity offset of brightness × 2.55. Zero leaves brightness unchanged.')}
      {slider('contrast', 'Contrast', -100, 100, 'Stretch intensities around middle gray. Zero is neutral; negative values reduce contrast.')}
      <div className="levels-label"><span>Levels</span><span>SHADOWS → HIGHLIGHTS</span></div>
      <svg className="histogram" viewBox="0 0 255 46" preserveAspectRatio="none" role="img" aria-label="Output luminance histogram"><defs><linearGradient id="histogram-fill"><stop stopColor="#809287"/><stop offset="1" stopColor="#bbc9bf"/></linearGradient></defs><path d={histogramPath} fill="url(#histogram-fill)"/><line x1="0" y1="45" x2="255" y2="45" stroke="#d8dcd7"/></svg>
      <div className="level-gradient" />
      {slider('blackPoint', 'Black point', 0, settings.whitePoint - 1, 'Input values at or below this point map to black; it must stay below white point.')}
      {slider('whitePoint', 'White point', settings.blackPoint + 1, 255, 'Input values at or above this point map to white; it must stay above black point.')}
      {slider('gamma', 'Gamma', 0.1, 5, 'Midtone correction: output = input^(1/gamma). Above 1 lightens midtones; below 1 darkens them.', 0.05)}
    </section>
    <section className="sidebar-section background-section">
      <Toggle label="Remove uneven lighting" checked={settings.normalize} disabled={disabled} onChange={normalize => onAdjust({ normalize })} hint="Estimate local paper brightness and divide out illumination. Does not sharpen or denoise." />
      {settings.normalize && slider('normalizationStrength', 'Strength', 0, 100, 'Blend illumination correction: 0% is unchanged; 100% fully corrects the estimated paper.', 1, false, '%')}
    </section>
    <details className="sidebar-section advanced-section">
      <summary><span><Icon name="sliders" size={15} />Advanced adjustments</span><Icon name="chevron" size={14} /></summary>
      <p className="section-note">Spatial sizes are in original document pixels and scale automatically in the preview.</p>
      {slider('backgroundRadius', 'Background radius', 8, 300, 'Local maximum radius in full-resolution pixels. Choose a radius wider than text strokes but smaller than lighting variations.', 1, !settings.normalize, 'px')}
      <label className="select-label" htmlFor="threshold-mode">Thresholding</label>
      <select id="threshold-mode" value={settings.thresholdMode} disabled={disabled} onChange={e => onAdjust({ thresholdMode: e.target.value as ProcessingSettings['thresholdMode'] })}>
        <option value="off">Off · preserve grayscale</option><option value="global">Global · single cutoff</option><option value="adaptive">Adaptive · local cutoff</option>
      </select>
      <p className="section-note">Thresholding produces pure black and white. Off retains faint grayscale detail.</p>
      {slider('threshold', 'Global threshold', 0, 255, 'Pixels at or below the cutoff become black; values above become white.', 1, settings.thresholdMode !== 'global')}
      {slider('adaptiveWindow', 'Adaptive window', 3, 301, 'Odd-sized local mean window in full-resolution pixels. Larger windows include more surrounding paper.', 2, settings.thresholdMode !== 'adaptive', 'px')}
      {slider('adaptiveOffset', 'Adaptive offset', -50, 50, 'Subtract this value from the local mean. Lower values keep more faint strokes; higher values remove more background.', 1, settings.thresholdMode !== 'adaptive')}
      <button className="text-button" onClick={() => onAdjust({ backgroundRadius: DEFAULT_SETTINGS.backgroundRadius, thresholdMode: 'off', threshold: DEFAULT_SETTINGS.threshold, adaptiveWindow: DEFAULT_SETTINGS.adaptiveWindow, adaptiveOffset: DEFAULT_SETTINGS.adaptiveOffset })} disabled={disabled}>Reset advanced settings</button>
    </details>
    <details className="sidebar-section geometry-section">
      <summary><span><Icon name="crop" size={15} />Crop & rotate</span><Icon name="chevron" size={14} /></summary>
      <div className="rotation-row"><span>Clockwise rotation</span><button className="button small" disabled={disabled} onClick={() => onGeometry({ ...geometry, rotation: ((geometry.rotation + 90) % 360) as Geometry['rotation'] })}><Icon name="rotate" size={15} />{geometry.rotation}°</button></div>
      <p className="section-note">Trim each edge as a percentage of the original image, before rotation. Apply to preview your crop.</p>
      <div className="crop-grid">{(['left', 'top', 'right', 'bottom'] as const).map(side => <label key={side}>{side}<span><input type="number" min="0" max="90" step="0.1" value={crop[side]} disabled={disabled} onChange={e => {
        const value = Number(e.target.value);
        if (Number.isFinite(value)) setCrop({ ...crop, [side]: Math.max(0, Math.min(90, value)) });
      }} aria-label={`Crop ${side}`} />%</span></label>)}</div>
      <div className="crop-actions"><button className="button small" disabled={disabled || crop.left + crop.right >= 99.9 || crop.top + crop.bottom >= 99.9} onClick={() => onGeometry({ ...geometry, crop: { x: crop.left / 100, y: crop.top / 100, width: 1 - (crop.left + crop.right) / 100, height: 1 - (crop.top + crop.bottom) / 100 } })}>Apply crop</button>
        <button className="text-button" disabled={disabled} onClick={() => { setCrop({ left: 0, top: 0, right: 0, bottom: 0 }); onGeometry(structuredClone(DEFAULT_GEOMETRY)); }}>Reset geometry</button></div>
      {(crop.left + crop.right >= 99.9 || crop.top + crop.bottom >= 99.9) && <p className="inline-error">Keep at least 0.1% of each dimension.</p>}
    </details>
    <div className="sidebar-footnote"><Icon name="shield" size={17} /><span>Your files stay with you.<br/><strong>Everything happens in your browser.</strong></span></div>
  </aside>;
}
