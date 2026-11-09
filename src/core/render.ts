import { resizeForPreview, transformGeometry } from './geometry';
import { histogram, processPixels } from './processing';
import type { Geometry, PixelImage, ProcessingSettings } from './types';

/** Preview and final output share exactly the same pipeline. Omit maxDimension for full size. */
export function renderDocument(source: PixelImage, settings: ProcessingSettings, geometry: Geometry, maxDimension?: number) {
  const transformed = transformGeometry(source, geometry);
  const { image: original, scale } = resizeForPreview(transformed, maxDimension);
  const image = processPixels(original, settings, scale);
  return { image, original, histogram: histogram(image), scale };
}
