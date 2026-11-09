import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_GEOMETRY, DEFAULT_SETTINGS } from '../src/core/settings';
import { renderDocument } from '../src/core/render';
import { useEditor } from '../src/state/useEditor';
import { ProcessingClient } from '../src/worker/client';
import { decodeFile, type DocumentImage } from '../src/io/images';
import { grayBackground } from './fixtures';

vi.mock('../src/io/images', async () => {
  const { grayBackground } = await import('./fixtures');
  return { sampleDocument: () => ({ name: 'sample.png', image: grayBackground(), sample: true }), decodeFile: vi.fn() };
});

beforeEach(() => { vi.mocked(decodeFile).mockReset(); });
describe('editor processing lifecycle', () => {
  it('actual preset actions populate editable settings and reset restores neutral settings', async () => {
    const { result } = renderHook(() => useEditor());
    await waitFor(() => expect(result.current.preview).not.toBeNull());
    await act(() => result.current.applyPreset('bw'));
    expect(result.current.state.settings.normalize).toBe(true);
    expect(result.current.state.settings.thresholdMode).toBe('adaptive');
    act(() => result.current.adjust({ adaptiveOffset: 3 }));
    expect(result.current.state.settings.adaptiveOffset).toBe(3); expect(result.current.state.preset).toBe(null);
    act(() => result.current.reset());
    expect(result.current.state.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('does not allow stale preview results to replace newer results', async () => {
    const completions: ((value: Awaited<ReturnType<ProcessingClient['render']>>) => void)[] = [];
    const spy = vi.spyOn(ProcessingClient.prototype, 'render').mockImplementation(() => new Promise(resolve => completions.push(resolve)));
    const { result } = renderHook(() => useEditor());
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    act(() => result.current.adjust({ brightness: 20 }));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    const newer = { type: 'render' as const, id: 2, sourceId: 1, ...renderDocument(grayBackground(), { ...DEFAULT_SETTINGS, brightness: 20 }, DEFAULT_GEOMETRY) };
    await act(async () => { completions[1](newer); });
    expect(result.current.preview?.id).toBe(2);
    await act(async () => { completions[0]({ type: 'render', id: 1, sourceId: 1, ...renderDocument(grayBackground(), DEFAULT_SETTINGS, DEFAULT_GEOMETRY) }); });
    expect(result.current.preview?.id).toBe(2);
  });

  it('does not let a delayed preset overwrite subsequent manual changes', async () => {
    let finish!: (value: Awaited<ReturnType<ProcessingClient['preset']>>) => void;
    vi.spyOn(ProcessingClient.prototype, 'preset').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const { result } = renderHook(() => useEditor());
    let applying!: Promise<void>;
    act(() => { applying = result.current.applyPreset('clean'); });
    act(() => result.current.adjust({ brightness: 35 }));
    await act(async () => { finish({ type: 'preset', id: 1, sourceId: 1, settings: { ...DEFAULT_SETTINGS, brightness: 0, contrast: 8 } }); await applying; });
    expect(result.current.state.settings.brightness).toBe(35); expect(result.current.state.preset).toBe(null);
  });

  it('keeps the latest file when decodes complete out of order', async () => {
    const completions: ((value: DocumentImage) => void)[] = [];
    vi.mocked(decodeFile).mockImplementation(() => new Promise(resolve => completions.push(resolve)));
    const { result } = renderHook(() => useEditor());
    let first!: Promise<void>, second!: Promise<void>;
    act(() => { first = result.current.openFile(new File(['a'], 'first.png')); second = result.current.openFile(new File(['b'], 'second.png')); });
    await act(async () => { completions[1]({ name: 'second.png', image: grayBackground() }); await second; });
    await act(async () => { completions[0]({ name: 'first.png', image: grayBackground() }); await first; });
    expect(result.current.document?.name).toBe('second.png'); expect(result.current.loading).toBe(false);
  });
});
