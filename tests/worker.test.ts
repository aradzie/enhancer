import { describe, expect, it, vi } from 'vitest';
import { ProcessingClient } from '../src/worker/client';
import type { WorkerRequest, WorkerResult } from '../src/worker/protocol';
import { DEFAULT_GEOMETRY, DEFAULT_SETTINGS } from '../src/core/settings';
import { renderDocument } from '../src/core/render';
import { grayBackground } from './fixtures';

class FakeWorker {
  static instance: FakeWorker;
  messages: WorkerRequest[] = [];
  onmessage?: (event: { data: WorkerResult }) => void;
  onerror?: () => void;
  terminate = vi.fn();
  constructor() { FakeWorker.instance = this; }
  postMessage(message: WorkerRequest) { this.messages.push(message); }
}
describe('worker communication', () => {
  it('uses source copies and rejects stale jobs after replacing the source', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    try {
      const source = grayBackground(), client = new ProcessingClient(); client.setSource(source);
      const worker = FakeWorker.instance, request = worker.messages[0];
      expect(request.type).toBe('source');
      if (request.type === 'source') { expect(request.source.data).not.toBe(source.data); expect(request.source.data).toEqual(source.data); }
      const pending = client.render(DEFAULT_SETTINGS, DEFAULT_GEOMETRY, 1600);
      const rejection = expect(pending).rejects.toThrow('source document has changed');
      client.setSource(grayBackground()); await rejection; client.dispose();
    } finally { vi.unstubAllGlobals(); }
  });
  it('routes responses by request ID and surfaces processing errors', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    try {
      const client = new ProcessingClient(); client.setSource(grayBackground()); const worker = FakeWorker.instance;
      const pending = client.render(DEFAULT_SETTINGS, DEFAULT_GEOMETRY, 1600);
      const request = worker.messages.at(-1)!;
      if (request.type !== 'render') throw new Error('Expected render');
      worker.onmessage?.({ data: { type: 'render', id: request.id, sourceId: request.sourceId, ...renderDocument(grayBackground(), DEFAULT_SETTINGS, DEFAULT_GEOMETRY) } });
      expect((await pending).image.width).toBe(128);
      const failed = client.render(DEFAULT_SETTINGS, DEFAULT_GEOMETRY), rejection = expect(failed).rejects.toThrow('Out of memory');
      const next = worker.messages.at(-1)!;
      if (next.type !== 'render') throw new Error('Expected render');
      worker.onmessage?.({ data: { type: 'error', id: next.id, sourceId: next.sourceId, error: 'Out of memory' } });
      await rejection; client.dispose();
    } finally { vi.unstubAllGlobals(); }
  });
  it('surfaces worker crashes and can retry with the main-thread fallback', async () => {
    vi.stubGlobal('Worker', FakeWorker);
    try {
      const client = new ProcessingClient(); client.setSource(grayBackground()); const worker = FakeWorker.instance;
      const pending = client.render(DEFAULT_SETTINGS, DEFAULT_GEOMETRY), rejection = expect(pending).rejects.toThrow('worker stopped');
      worker.onerror?.(); await rejection;
      expect((await client.render(DEFAULT_SETTINGS, DEFAULT_GEOMETRY)).image.width).toBe(128); client.dispose();
    } finally { vi.unstubAllGlobals(); }
  });
});
