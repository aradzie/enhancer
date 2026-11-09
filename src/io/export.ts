import type { Geometry, PixelImage, ProcessingSettings } from '../core/types';
import type { ProcessingClient } from '../worker/client';
import { imageCanvas } from './images';

export function enhancedFilename(filename: string): string {
  return `${filename.replace(/\.[^.]+$/, '') || 'document'}-enhanced.png`;
}

/** No preview dimension is passed, so a downsampled preview can never be exported. */
export async function fullResolutionOutput(client: Pick<ProcessingClient, 'render'>, settings: ProcessingSettings, geometry: Geometry): Promise<PixelImage> {
  return (await client.render(settings, geometry)).image;
}

export async function pngBlob(image: PixelImage): Promise<Blob> {
  const canvas = imageCanvas(image);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encoding failed. Please try a smaller image.')), 'image/png'));
}

export async function downloadPng(image: PixelImage, originalName: string): Promise<void> {
  const blob = await pngBlob(image), url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = enhancedFilename(originalName);
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
