/// <reference lib="webworker" />
import { resizeForPreview, transformGeometry } from '../core/geometry';
import { presetSettings } from '../core/presets';
import { renderDocument } from '../core/render';
import type { PixelImage } from '../core/types';
import type { WorkerRequest, WorkerResult } from './protocol';

let source: PixelImage | null = null;
let currentSource = 0;
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request.type === 'source') { source = request.source; currentSource = request.sourceId; return; }
  try {
    if (!source || request.sourceId !== currentSource) throw new Error('The source document has changed. Please try again.');
    if (request.type === 'preset') {
      const { image, scale } = resizeForPreview(transformGeometry(source, request.geometry), 1400);
      self.postMessage({ type: 'preset', id: request.id, sourceId: currentSource, settings: presetSettings(request.preset, image, scale) } satisfies WorkerResult);
    } else {
      const rendered = renderDocument(source, request.settings, request.geometry, request.maxDimension);
      // Final outputs do not need a comparison raster. Never transfer the retained source.
      const original = request.maxDimension === undefined ? null : rendered.original.data.buffer === source.data.buffer
        ? { ...rendered.original, data: new Uint8ClampedArray(rendered.original.data) } : rendered.original;
      const result: WorkerResult = { type: 'render', id: request.id, sourceId: currentSource, ...rendered, original };
      self.postMessage(result, original ? [result.image.data.buffer, original.data.buffer, result.histogram.buffer] : [result.image.data.buffer, result.histogram.buffer]);
    }
  } catch (error) {
    self.postMessage({ type: 'error', id: request.id, sourceId: request.sourceId, error: error instanceof Error ? error.message : 'Image processing failed.' } satisfies WorkerResult);
  }
};
