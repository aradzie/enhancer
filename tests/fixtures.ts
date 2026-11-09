import type { PixelImage } from '../src/core/types';

export function grayImage(values: number[], width = values.length): PixelImage {
  return { width, height: values.length / width, data: Uint8ClampedArray.from(values.flatMap(v => [v, v, v, 255])) };
}
export function synthetic(width: number, height: number, pixel: (x: number, y: number) => number): PixelImage {
  return grayImage(Array.from({ length: width * height }, (_, p) => pixel(p % width, Math.floor(p / width))), width);
}
export function grayBackground() { return synthetic(128, 96, (x, y) => y % 16 === 8 && x > 10 && x < 118 ? 45 : 210); }
export function lowContrastText() { return synthetic(128, 96, (x, y) => y % 16 === 8 && x > 10 && x < 118 ? 175 : 210); }
export function unevenIllumination() { return synthetic(128, 96, (x, y) => y === 40 && x > 10 && x < 118 ? 45 : 150 + x * 0.7); }
export function thinLines() { return synthetic(128, 96, (x, y) => x === 64 || y === 48 ? 100 : 220); }
export function grayscaleDiagram() { return synthetic(128, 96, x => 40 + Math.floor(x / 16) * 25); }
export function largeDarkRegion() { return synthetic(128, 96, (x, y) => x > 20 && x < 108 && y > 12 && y < 84 ? 24 : 220); }
export function at(image: PixelImage, x: number, y: number) { return image.data[(y * image.width + x) * 4]; }
export function grayValues(image: PixelImage) { return Array.from({ length: image.width * image.height }, (_, p) => image.data[p * 4]); }
