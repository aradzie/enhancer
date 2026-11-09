import { resizeForPreview, transformGeometry } from '../core/geometry';
import { presetSettings } from '../core/presets';
import { renderDocument } from '../core/render';
import type { Geometry, PixelImage, PresetId, ProcessingSettings } from '../core/types';
import type { WorkerRequest, WorkerResult } from './protocol';

type RenderResult = Extract<WorkerResult, { type: 'render' }>;
type PresetResult = Extract<WorkerResult, { type: 'preset' }>;
export class ProcessingClient {
  private worker: Worker | null = null;
  private source: PixelImage | null = null;
  private sourceId = 0;
  private id = 0;
  private pending = new Map<number, { resolve: (value: WorkerResult) => void; reject: (error: Error) => void }>();
  readonly usesWorker: boolean;

  constructor() {
    try {
      if (typeof Worker !== 'undefined') {
        this.worker = new Worker(new URL('./processor.worker.ts', import.meta.url), { type: 'module' });
        this.worker.onmessage = ({ data }: MessageEvent<WorkerResult>) => {
          const job = this.pending.get(data.id);
          if (!job) return;
          this.pending.delete(data.id);
          if (data.sourceId !== this.sourceId) job.reject(new Error('The source document has changed.'));
          else if (data.type === 'error') job.reject(new Error(data.error));
          else job.resolve(data);
        };
        this.worker.onerror = () => {
          this.worker?.terminate(); this.worker = null;
          this.rejectPending('The image worker stopped. Please retry; processing will continue in the browser.');
        };
      }
    } catch { this.worker = null; }
    this.usesWorker = Boolean(this.worker);
  }

  private rejectPending(message: string) {
    for (const job of this.pending.values()) job.reject(new Error(message));
    this.pending.clear();
  }

  setSource(source: PixelImage) {
    this.rejectPending('The source document has changed.');
    this.source = source; this.sourceId++;
    if (this.worker) {
      const copy = { ...source, data: new Uint8ClampedArray(source.data) };
      this.worker.postMessage({ type: 'source', source: copy, sourceId: this.sourceId } satisfies WorkerRequest, [copy.data.buffer]);
    }
  }

  private request(request: Exclude<WorkerRequest, { type: 'source' }>): Promise<WorkerResult> {
    if (!this.source) return Promise.reject(new Error('Open a document first.'));
    if (this.worker) return new Promise((resolve, reject) => { this.pending.set(request.id, { resolve, reject }); this.worker!.postMessage(request); });
    const source = this.source, sourceId = this.sourceId;
    // Yield before the fallback so loading indicators can paint.
    return new Promise((resolve, reject) => setTimeout(() => {
      try {
        if (sourceId !== this.sourceId) throw new Error('The source document has changed.');
        if (request.type === 'render') resolve({ type: 'render', id: request.id, sourceId, ...renderDocument(source, request.settings, request.geometry, request.maxDimension) });
        else {
          const { image, scale } = resizeForPreview(transformGeometry(source, request.geometry), 1400);
          resolve({ type: 'preset', id: request.id, sourceId, settings: presetSettings(request.preset, image, scale) });
        }
      } catch (error) { reject(error); }
    }, 0));
  }

  render(settings: ProcessingSettings, geometry: Geometry, maxDimension?: number): Promise<RenderResult> {
    return this.request({ type: 'render', id: ++this.id, sourceId: this.sourceId, settings, geometry, maxDimension }) as Promise<RenderResult>;
  }
  preset(preset: PresetId, geometry: Geometry): Promise<PresetResult> {
    return this.request({ type: 'preset', id: ++this.id, sourceId: this.sourceId, preset, geometry }) as Promise<PresetResult>;
  }
  dispose() { this.worker?.terminate(); this.rejectPending('Image processing closed.'); }
}
