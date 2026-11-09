import type { Geometry, PrintSettings, ProcessingSettings } from './types';

export const DEFAULT_SETTINGS: Readonly<ProcessingSettings> = Object.freeze({
  grayscale: true, brightness: 0, contrast: 0,
  blackPoint: 0, whitePoint: 255, gamma: 1,
  normalize: false, normalizationStrength: 85, backgroundRadius: 60,
  thresholdMode: 'off', threshold: 128, adaptiveWindow: 51, adaptiveOffset: 10,
});
export const DEFAULT_GEOMETRY: Geometry = { rotation: 0, crop: { x: 0, y: 0, width: 1, height: 1 } };
export const DEFAULT_PRINT: PrintSettings = { paper: 'A4', orientation: 'portrait', margin: 12, fit: true };

const finiteRange = (value: number, min: number, max: number) => Number.isFinite(value) && value >= min && value <= max;
export function validateSettings(s: ProcessingSettings): void {
  if (!s || typeof s.grayscale !== 'boolean' || typeof s.normalize !== 'boolean'
    || !finiteRange(s.brightness, -100, 100) || !finiteRange(s.contrast, -100, 100)
    || !finiteRange(s.blackPoint, 0, 254) || !finiteRange(s.whitePoint, 1, 255)
    || s.blackPoint >= s.whitePoint || !finiteRange(s.gamma, 0.1, 5)
    || !finiteRange(s.normalizationStrength, 0, 100) || !finiteRange(s.backgroundRadius, 8, 300)
    || !['off', 'global', 'adaptive'].includes(s.thresholdMode)
    || !finiteRange(s.threshold, 0, 255) || !finiteRange(s.adaptiveOffset, -50, 50)
    || !Number.isInteger(s.adaptiveWindow) || s.adaptiveWindow < 3 || s.adaptiveWindow > 301 || s.adaptiveWindow % 2 === 0) {
    throw new Error('Invalid processing settings. Black point must be below white point; adaptive window must be odd.');
  }
}

export function validateGeometry(g: Geometry): void {
  const c = g?.crop;
  if (!g || ![0, 90, 180, 270].includes(g.rotation) || !c
    || !finiteRange(c.x, 0, 1) || !finiteRange(c.y, 0, 1)
    || !finiteRange(c.width, 0.001, 1) || !finiteRange(c.height, 0.001, 1)
    || c.x + c.width > 1.000001 || c.y + c.height > 1.000001) throw new Error('Invalid crop or rotation.');
}

export function isPrintSettings(value: unknown): value is PrintSettings {
  if (!value || typeof value !== 'object') return false;
  const p = value as PrintSettings;
  return ['A4', 'Letter'].includes(p.paper) && ['portrait', 'landscape'].includes(p.orientation)
    && finiteRange(p.margin, 0, 40) && typeof p.fit === 'boolean';
}
