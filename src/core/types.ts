export interface PixelImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface ProcessingSettings {
  grayscale: boolean;
  brightness: number;
  contrast: number;
  blackPoint: number;
  whitePoint: number;
  gamma: number;
  normalize: boolean;
  normalizationStrength: number;
  backgroundRadius: number;
  thresholdMode: 'off' | 'global' | 'adaptive';
  threshold: number;
  adaptiveWindow: number;
  adaptiveOffset: number;
}

/** Crop coordinates refer to the immutable source, before clockwise rotation. */
export interface Geometry {
  rotation: 0 | 90 | 180 | 270;
  crop: { x: number; y: number; width: number; height: number };
}

export interface PrintSettings {
  paper: 'A4' | 'Letter';
  orientation: 'portrait' | 'landscape';
  margin: number;
  fit: boolean;
}

export type PresetId = 'clean' | 'shadows' | 'bw' | 'details';
