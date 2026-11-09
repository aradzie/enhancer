import { describe, expect, it, vi } from 'vitest';
import { resizeForPreview, transformGeometry } from '../src/core/geometry';
import { renderDocument } from '../src/core/render';
import { DEFAULT_GEOMETRY, DEFAULT_PRINT, DEFAULT_SETTINGS } from '../src/core/settings';
import { presetSettings } from '../src/core/presets';
import { enhancedFilename, fullResolutionOutput } from '../src/io/export';
import { printLayout } from '../src/io/print';
import { editorReducer, initialEditorState, loadPreferences, savePreferences, STORAGE_KEY } from '../src/state/editor';
import { ProcessingClient } from '../src/worker/client';
import { grayBackground, grayImage, grayValues, synthetic, unevenIllumination } from './fixtures';

describe('preview and output integration', () => {
  it.each(['clean', 'shadows', 'bw', 'details'] as const)('preview and export are pixel-identical at the same resolution for %s', id => {
    const source = unevenIllumination(), settings = presetSettings(id, source);
    const preview = renderDocument(source, settings, DEFAULT_GEOMETRY, 128);
    const output = renderDocument(source, settings, DEFAULT_GEOMETRY);
    expect(preview.image).toEqual(output.image); expect(preview.scale).toBe(1);
  });
  it('export requests full-resolution source instead of reusing the preview', async () => {
    const client = new ProcessingClient(), source = synthetic(1800, 20, (x, y) => (x + y) % 256);
    client.setSource(source);
    const preview = await client.render(DEFAULT_SETTINGS, DEFAULT_GEOMETRY, 1600);
    expect(preview.image.width).toBe(1600);
    const render = vi.spyOn(client, 'render');
    const exported = await fullResolutionOutput(client, DEFAULT_SETTINGS, DEFAULT_GEOMETRY);
    expect(render).toHaveBeenCalledWith(DEFAULT_SETTINGS, DEFAULT_GEOMETRY);
    expect(exported.width).toBe(1800); expect(exported.height).toBe(20);
    expect(source.data.byteLength).toBe(1800 * 20 * 4);
    client.dispose();
  });
  it('crop and clockwise rotation change final dimensions and pixels exactly', () => {
    const source = grayImage([0, 1, 2, 3, 4, 5], 3);
    const rotated = transformGeometry(source, { ...DEFAULT_GEOMETRY, rotation: 90 });
    expect([rotated.width, rotated.height]).toEqual([2, 3]); expect(grayValues(rotated)).toEqual([3, 0, 4, 1, 5, 2]);
    const cropped = renderDocument(source, DEFAULT_SETTINGS, { rotation: 90, crop: { x: 1 / 3, y: 0, width: 2 / 3, height: 1 } });
    expect([cropped.image.width, cropped.image.height]).toEqual([2, 2]); expect(grayValues(cropped.image)).toEqual([4, 1, 5, 2]);
    expect(grayValues(source)).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it('area averages a single-pixel line rather than dropping it during downsampling', () => {
    const source = grayImage([255, 0, 255, 255, 255, 0, 255, 255], 4);
    expect(grayValues(resizeForPreview(source, 2).image)).toEqual([128, 255]);
  });
  it('scales spatial windows to match an independently configured preview pipeline', () => {
    const source = synthetic(200, 100, (x, y) => (x % 20 === 0 || y % 20 === 0) ? 60 : 180 + x / 4);
    const settings = { ...DEFAULT_SETTINGS, normalize: true, backgroundRadius: 40, thresholdMode: 'adaptive' as const, adaptiveWindow: 101 };
    const preview = renderDocument(source, settings, DEFAULT_GEOMETRY, 100);
    const resized = resizeForPreview(source, 100).image;
    const expected = renderDocument(resized, { ...settings, backgroundRadius: 20, adaptiveWindow: 51 }, DEFAULT_GEOMETRY);
    expect(preview.image).toEqual(expected.image);
  });
  it('always derives the next preview from immutable source data', () => {
    const source = grayBackground(), before = source.data.slice();
    renderDocument(source, { ...DEFAULT_SETTINGS, brightness: 90 }, DEFAULT_GEOMETRY);
    const reset = renderDocument(source, DEFAULT_SETTINGS, DEFAULT_GEOMETRY);
    expect(reset.image.data).toEqual(before); expect(source.data).toEqual(before);
  });
});

describe('editor state', () => {
  it('reset restores default adjustments and geometry while preserving print preferences', () => {
    let state = initialEditorState();
    state = editorReducer(state, { type: 'adjust', patch: { brightness: 50, gamma: 2, normalize: true } });
    state = editorReducer(state, { type: 'geometry', geometry: { ...DEFAULT_GEOMETRY, rotation: 90 } });
    state = editorReducer(state, { type: 'print', print: { ...DEFAULT_PRINT, paper: 'Letter' } });
    state = editorReducer(state, { type: 'reset' });
    expect(state.settings).toEqual(DEFAULT_SETTINGS); expect(state.geometry).toEqual(DEFAULT_GEOMETRY); expect(state.preset).toBe(null); expect(state.print.paper).toBe('Letter');
  });
  it('preset selection populates ordinary settings; manual edits clear the preset indicator', () => {
    let state = initialEditorState();
    const preset = presetSettings('bw', grayBackground());
    state = editorReducer(state, { type: 'preset', preset: 'bw', settings: preset });
    expect(state.settings).toEqual(preset); expect(state.settings.thresholdMode).toBe('adaptive'); expect(state.preset).toBe('bw');
    state = editorReducer(state, { type: 'adjust', patch: { adaptiveOffset: 4 } });
    expect(state.settings.adaptiveOffset).toBe(4); expect(state.preset).toBe(null);
  });
  it('new documents reset image-specific geometry', () => {
    const state = editorReducer({ ...initialEditorState(), geometry: { ...DEFAULT_GEOMETRY, rotation: 90 } }, { type: 'new-document' });
    expect(state.geometry).toEqual(DEFAULT_GEOMETRY);
  });
  it('saves only settings and print preferences, and rejects corrupt stored settings', () => {
    const state = initialEditorState(); state.settings.brightness = 15; savePreferences(state);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(Object.keys(stored).sort()).toEqual(['print', 'settings']); expect(loadPreferences().settings.brightness).toBe(15);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings: { gamma: 0 }, image: 'secret' }));
    expect(loadPreferences().settings).toEqual(DEFAULT_SETTINGS);
    localStorage.setItem(STORAGE_KEY, 'not json'); expect(loadPreferences()).toEqual(initialEditorState());
  });
});

describe('output conventions', () => {
  it('creates lossless PNG names with enhanced suffix', () => {
    expect(enhancedFilename('My.scan.JPEG')).toBe('My.scan-enhanced.png'); expect(enhancedFilename('clipboard')).toBe('clipboard-enhanced.png');
  });
  it('calculates A4 and Letter printable areas and orientation in millimeters', () => {
    expect(printLayout(DEFAULT_PRINT)).toEqual({ width: 210, height: 297, contentWidth: 186, contentHeight: 273 });
    const letter = printLayout({ ...DEFAULT_PRINT, paper: 'Letter', orientation: 'landscape', margin: 10 });
    expect(letter.width).toBe(279.4); expect(letter.height).toBe(215.9); expect(letter.contentWidth).toBeCloseTo(259.4);
    expect(() => printLayout({ ...DEFAULT_PRINT, margin: NaN })).toThrow();
  });
});
