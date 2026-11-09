import { validateGeometry } from './settings';
import type { Geometry, PixelImage } from './types';

export function validateImage(image: PixelImage): void {
  if (!Number.isInteger(image.width) || !Number.isInteger(image.height) || image.width < 1 || image.height < 1
    || !(image.data instanceof Uint8ClampedArray) || image.data.length !== image.width * image.height * 4) {
    throw new Error('Invalid image data.');
  }
}

export function geometryDimensions(image: Pick<PixelImage, 'width' | 'height'>, geometry: Geometry) {
  validateGeometry(geometry);
  const x = Math.min(image.width - 1, Math.round(geometry.crop.x * image.width));
  const y = Math.min(image.height - 1, Math.round(geometry.crop.y * image.height));
  const width = Math.max(1, Math.min(image.width - x, Math.round(geometry.crop.width * image.width)));
  const height = Math.max(1, Math.min(image.height - y, Math.round(geometry.crop.height * image.height)));
  return { x, y, width, height, outputWidth: geometry.rotation % 180 ? height : width, outputHeight: geometry.rotation % 180 ? width : height };
}

/** Exact pixel remapping: no interpolation or accumulated rotation artifacts. */
export function transformGeometry(source: PixelImage, geometry: Geometry): PixelImage {
  validateImage(source);
  const { x, y, width, height, outputWidth, outputHeight } = geometryDimensions(source, geometry);
  if (x === 0 && y === 0 && width === source.width && height === source.height && geometry.rotation === 0) return source;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let cy = 0; cy < height; cy++) for (let cx = 0; cx < width; cx++) {
    let dx = cx, dy = cy;
    if (geometry.rotation === 90) { dx = height - 1 - cy; dy = cx; }
    if (geometry.rotation === 180) { dx = width - 1 - cx; dy = height - 1 - cy; }
    if (geometry.rotation === 270) { dx = cy; dy = width - 1 - cx; }
    const from = ((cy + y) * source.width + cx + x) * 4;
    data.set(source.data.subarray(from, from + 4), (dy * outputWidth + dx) * 4);
  }
  return { width: outputWidth, height: outputHeight, data };
}

/** Area averaging preserves thin lines better than nearest-neighbor preview sampling.
 * Alpha is composited on paper white before averaging, matching full-size processing. */
export function resizeForPreview(source: PixelImage, maxDimension?: number): { image: PixelImage; scale: number } {
  if (maxDimension !== undefined && (!Number.isFinite(maxDimension) || maxDimension < 1)) throw new Error('Invalid preview size.');
  if (maxDimension === undefined || Math.max(source.width, source.height) <= maxDimension) return { image: source, scale: 1 };
  const scale = maxDimension / Math.max(source.width, source.height);
  const width = Math.max(1, Math.round(source.width * scale)), height = Math.max(1, Math.round(source.height * scale));
  const data = new Uint8ClampedArray(width * height * 4);
  const sx = source.width / width, sy = source.height / height;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const left = x * sx, right = (x + 1) * sx, top = y * sy, bottom = (y + 1) * sy;
    let r = 0, g = 0, b = 0, weight = 0;
    for (let iy = Math.floor(top); iy < Math.ceil(bottom) && iy < source.height; iy++) {
      for (let ix = Math.floor(left); ix < Math.ceil(right) && ix < source.width; ix++) {
        const w = (Math.min(right, ix + 1) - Math.max(left, ix)) * (Math.min(bottom, iy + 1) - Math.max(top, iy));
        const i = (iy * source.width + ix) * 4, a = source.data[i + 3] / 255;
        r += (source.data[i] * a + 255 * (1 - a)) * w;
        g += (source.data[i + 1] * a + 255 * (1 - a)) * w;
        b += (source.data[i + 2] * a + 255 * (1 - a)) * w;
        weight += w;
      }
    }
    const i = (y * width + x) * 4;
    data[i] = r / weight; data[i + 1] = g / weight; data[i + 2] = b / weight; data[i + 3] = 255;
  }
  return { image: { width, height, data }, scale };
}
