import { validateImage } from './geometry';
import { validateSettings } from './settings';
import type { PixelImage, ProcessingSettings } from './types';

export const luminance = (r: number, g: number, b: number) => Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

/** Transparent areas are paper: composite on white, and return opaque pixels. */
export function flattenAlpha(image: PixelImage): PixelImage {
  validateImage(image);
  const data = new Uint8ClampedArray(image.data.length);
  for (let i = 0; i < data.length; i += 4) {
    const a = image.data[i + 3] / 255;
    for (let c = 0; c < 3; c++) data[i + c] = image.data[i + c] * a + 255 * (1 - a);
    data[i + 3] = 255;
  }
  return { ...image, data };
}

export function toGrayscale(image: PixelImage): PixelImage {
  const output = flattenAlpha(image);
  for (let i = 0; i < output.data.length; i += 4) {
    const gray = luminance(output.data[i], output.data[i + 1], output.data[i + 2]);
    output.data[i] = output.data[i + 1] = output.data[i + 2] = gray;
  }
  return output;
}

/** Levels → gamma → brightness → contrast, composed once with a single rounding.
 * Gamma > 1 lightens midtones. Brightness adds ±255. Contrast is linear around 127.5;
 * positive values approach a factor of 101 at +100 and -100 produces flat gray. */
export function buildToneLut(settings: ProcessingSettings): Uint8ClampedArray {
  validateSettings(settings);
  const { blackPoint, whitePoint, gamma, brightness, contrast } = settings;
  const factor = contrast >= 0 ? 1 / (1 - contrast / 101) : 1 + contrast / 100;
  return Uint8ClampedArray.from({ length: 256 }, (_, input) => {
    const level = Math.max(0, Math.min(1, (input - blackPoint) / (whitePoint - blackPoint)));
    const adjusted = 255 * level ** (1 / gamma) + brightness * 2.55;
    return clamp((adjusted - 127.5) * factor + 127.5);
  });
}

export function histogram(image: PixelImage): Uint32Array {
  validateImage(image);
  const bins = new Uint32Array(256);
  // Composite on the fly instead of allocating a full image just to count bins.
  for (let i = 0; i < image.data.length; i += 4) {
    const a = image.data[i + 3] / 255;
    const r = Math.round(image.data[i] * a + 255 * (1 - a));
    const g = Math.round(image.data[i + 1] * a + 255 * (1 - a));
    const b = Math.round(image.data[i + 2] * a + 255 * (1 - a));
    bins[luminance(r, g, b)]++;
  }
  return bins;
}

export function automaticLevels(bins: Uint32Array, lowPercentile = 0.005, highPercentile = 0.995): { blackPoint: number; whitePoint: number } {
  if (bins.length !== 256 || !Number.isFinite(lowPercentile) || !Number.isFinite(highPercentile)
    || lowPercentile < 0 || highPercentile > 1 || lowPercentile >= highPercentile) throw new Error('Invalid histogram percentiles.');
  const total = bins.reduce((sum, count) => sum + count, 0);
  if (total === 0) return { blackPoint: 0, whitePoint: 255 };
  let sum = 0, blackPoint = -1, whitePoint = 255;
  for (let i = 0; i < 256; i++) {
    sum += bins[i];
    if (blackPoint === -1 && sum > total * lowPercentile) blackPoint = i;
    if (sum >= total * highPercentile) { whitePoint = i; break; }
  }
  // Never stretch a near-flat field into harsh noise.
  return whitePoint - blackPoint < 8 ? { blackPoint: 0, whitePoint: 255 } : { blackPoint: Math.max(0, blackPoint), whitePoint };
}

/** Separable sliding-window maximum: O(width × height), independent of radius. */
function localMaximum(input: Float32Array, width: number, height: number, radius: number): Float32Array {
  const horizontal = new Float32Array(input.length), output = new Float32Array(input.length);
  function pass(src: Float32Array, dst: Float32Array, lines: number, size: number, stride: number, lineStride: number) {
    const deque = new Int32Array(size);
    for (let line = 0; line < lines; line++) {
      let head = 0, tail = 0, next = 0;
      const base = line * lineStride;
      for (let p = 0; p < size; p++) {
        const end = Math.min(size - 1, p + radius);
        while (next <= end) {
          while (tail > head && src[base + deque[tail - 1] * stride] <= src[base + next * stride]) tail--;
          deque[tail++] = next++;
        }
        while (tail > head && deque[head] < p - radius) head++;
        dst[base + p * stride] = src[base + deque[head] * stride];
      }
    }
  }
  pass(input, horizontal, height, width, 1, width);
  pass(horizontal, output, width, height, width, 1);
  return output;
}

export function integralImage(input: Float32Array, width: number, height: number): Float64Array {
  const stride = width + 1, integral = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += input[y * width + x];
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + row;
    }
  }
  return integral;
}

function localMeans(input: Float32Array, width: number, height: number, radius: number): Float32Array {
  const integral = integralImage(input, width, height), stride = width + 1, output = new Float32Array(input.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const left = Math.max(0, x - radius), right = Math.min(width, x + radius + 1);
    const top = Math.max(0, y - radius), bottom = Math.min(height, y + radius + 1);
    output[y * width + x] = (integral[bottom * stride + right] - integral[top * stride + right]
      - integral[bottom * stride + left] + integral[top * stride + left]) / ((right - left) * (bottom - top));
  }
  return output;
}

function intensities(image: PixelImage): Float32Array {
  return Float32Array.from({ length: image.width * image.height }, (_, p) => luminance(image.data[p * 4], image.data[p * 4 + 1], image.data[p * 4 + 2]));
}

/** Estimate paper using a local max filter followed by a box mean of radius r/2.
 * The max excludes narrow dark strokes from the estimate; smoothing softens tile-like edges.
 * Divide each channel by estimated paper / 255, blending by strength.
 * Never lift a near-black background estimate: broad dark artwork stays dark.
 * A radius wider than text strokes but narrower than shadows works best. */
export function normalizeBackground(image: PixelImage, strength: number, radius: number): PixelImage {
  if (!Number.isFinite(strength) || strength < 0 || strength > 100 || !Number.isFinite(radius) || radius < 1) throw new Error('Invalid background normalization parameters.');
  const flat = flattenAlpha(image);
  if (strength === 0) return flat;
  const light = intensities(flat), r = Math.max(1, Math.round(radius));
  const background = localMeans(localMaximum(light, image.width, image.height, r), image.width, image.height, Math.max(1, Math.round(r / 2)));
  for (let p = 0; p < light.length; p++) {
    const paper = background[p];
    const confidence = Math.max(0, Math.min(1, (paper - 40) / 60));
    const factor = 1 + (255 / Math.max(40, paper) - 1) * (strength / 100) * confidence;
    for (let c = 0; c < 3; c++) flat.data[p * 4 + c] = clamp(flat.data[p * 4 + c] * factor);
  }
  return flat;
}

export function globalThreshold(image: PixelImage, threshold: number): PixelImage {
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 255) throw new Error('Invalid global threshold.');
  const flat = toGrayscale(image);
  for (let i = 0; i < flat.data.length; i += 4) flat.data[i] = flat.data[i + 1] = flat.data[i + 2] = flat.data[i] <= threshold ? 0 : 255;
  return flat;
}

/** Mean adaptive threshold, O(N) using a Float64 summed-area table.
 * Pixel <= local mean minus offset becomes black. Clamp the cutoff to [0,255] so
 * a negative local cutoff cannot punch white holes into uniform pure-black ink. */
export function adaptiveThreshold(image: PixelImage, windowSize: number, offset: number): PixelImage {
  if (!Number.isInteger(windowSize) || windowSize < 3 || windowSize % 2 === 0 || !Number.isFinite(offset) || offset < -50 || offset > 50) throw new Error('Invalid adaptive threshold parameters.');
  const flat = toGrayscale(image), values = intensities(flat);
  const means = localMeans(values, image.width, image.height, Math.floor(windowSize / 2));
  for (let p = 0; p < values.length; p++) flat.data[p * 4] = flat.data[p * 4 + 1] = flat.data[p * 4 + 2] = values[p] <= Math.max(0, Math.min(255, means[p] - offset)) ? 0 : 255;
  return flat;
}

/** Input is never mutated. SpatialScale relates preview pixels to full-resolution pixels. */
export function processPixels(source: PixelImage, settings: ProcessingSettings, spatialScale = 1): PixelImage {
  validateSettings(settings);
  if (!Number.isFinite(spatialScale) || spatialScale <= 0 || spatialScale > 1) throw new Error('Invalid spatial scale.');
  let image = settings.grayscale || settings.thresholdMode !== 'off' ? toGrayscale(source) : flattenAlpha(source);
  if (settings.normalize) image = normalizeBackground(image, settings.normalizationStrength, Math.max(1, Math.round(settings.backgroundRadius * spatialScale)));
  const lut = buildToneLut(settings);
  for (let i = 0; i < image.data.length; i += 4) for (let c = 0; c < 3; c++) image.data[i + c] = lut[image.data[i + c]];
  if (settings.thresholdMode === 'global') return globalThreshold(image, settings.threshold);
  if (settings.thresholdMode === 'adaptive') {
    const window = Math.max(3, Math.round(settings.adaptiveWindow * spatialScale) | 1);
    return adaptiveThreshold(image, window, settings.adaptiveOffset);
  }
  return image;
}
