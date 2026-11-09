import type { Geometry, PixelImage, PresetId, ProcessingSettings } from '../core/types';

export type WorkerRequest =
  | { type: 'source'; source: PixelImage; sourceId: number }
  | { type: 'render'; id: number; sourceId: number; settings: ProcessingSettings; geometry: Geometry; maxDimension?: number }
  | { type: 'preset'; id: number; sourceId: number; preset: PresetId; geometry: Geometry };
export type WorkerResult =
  | { type: 'render'; id: number; sourceId: number; image: PixelImage; original: PixelImage | null; histogram: Uint32Array; scale: number }
  | { type: 'preset'; id: number; sourceId: number; settings: ProcessingSettings }
  | { type: 'error'; id: number; sourceId: number; error: string };
