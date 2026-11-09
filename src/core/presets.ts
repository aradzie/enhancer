import { automaticLevels, histogram, normalizeBackground, toGrayscale } from './processing';
import { DEFAULT_SETTINGS } from './settings';
import type { PixelImage, PresetId, ProcessingSettings } from './types';

export const PRESETS: { id: PresetId; name: string; description: string; icon: 'scan' | 'sun' | 'contrast' | 'feather' }[] = [
  { id: 'clean', name: 'Clean Scan', description: 'Crisp text, brighter paper', icon: 'scan' },
  { id: 'shadows', name: 'Remove Shadows', description: 'Even out uneven lighting', icon: 'sun' },
  { id: 'bw', name: 'Black & White', description: 'Pure black ink on white', icon: 'contrast' },
  { id: 'details', name: 'Preserve Details', description: 'A softer touch for diagrams', icon: 'feather' },
];

/** Presets return ordinary, fully editable settings; no hidden per-preset operations. */
export function presetSettings(id: PresetId, source: PixelImage, spatialScale = 1): ProcessingSettings {
  const normalize = id === 'shadows' || id === 'bw';
  let image = toGrayscale(source);
  if (normalize) image = normalizeBackground(image, 85, Math.max(1, Math.round(DEFAULT_SETTINGS.backgroundRadius * spatialScale)));
  const levels = automaticLevels(histogram(image), id === 'details' ? 0 : 0.005, id === 'details' ? 1 : 0.995);
  if (id === 'details') {
    levels.blackPoint = Math.max(0, levels.blackPoint - 15);
    levels.whitePoint = Math.min(255, levels.whitePoint + 10);
  }
  return { ...DEFAULT_SETTINGS, ...levels, normalize, contrast: id === 'clean' ? 8 : 0, thresholdMode: id === 'bw' ? 'adaptive' : 'off' };
}
