import { describe, expect, it } from 'vitest';
import { adaptiveThreshold, automaticLevels, buildToneLut, flattenAlpha, globalThreshold, histogram, normalizeBackground, processPixels, toGrayscale } from '../src/core/processing';
import { presetSettings } from '../src/core/presets';
import { DEFAULT_SETTINGS, validateGeometry, validateSettings } from '../src/core/settings';
import { at, grayBackground, grayImage, grayValues, grayscaleDiagram, largeDarkRegion, lowContrastText, synthetic, thinLines, unevenIllumination } from './fixtures';

describe('grayscale and alpha', () => {
  it('uses Rec. 709 luminance for primary colors and leaves source untouched', () => {
    const image = { width: 3, height: 1, data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]) };
    const before = image.data.slice();
    expect(grayValues(toGrayscale(image))).toEqual([54, 182, 18]);
    expect(image.data).toEqual(before);
  });
  it('composites transparent and partially transparent pixels on white paper', () => {
    const image = { width: 3, height: 1, data: new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 128, 80, 80, 80, 255]) };
    expect(grayValues(toGrayscale(image))).toEqual([255, 127, 80]);
    const result = processPixels(image, DEFAULT_SETTINGS);
    expect([result.data[3], result.data[7], result.data[11]]).toEqual([255, 255, 255]);
    expect(histogram(image)[255]).toBe(1);
  });
  it('can preserve color without thresholding', () => {
    const image = { width: 1, height: 1, data: new Uint8ClampedArray([120, 60, 30, 255]) };
    expect([...processPixels(image, { ...DEFAULT_SETTINGS, grayscale: false }).data]).toEqual([120, 60, 30, 255]);
  });
});

describe('composed tone lookup table', () => {
  it('has exactly 256 entries and is identity with neutral settings', () => {
    expect([...buildToneLut(DEFAULT_SETTINGS)]).toEqual(Array.from({ length: 256 }, (_, i) => i));
  });
  it('adds brightness and clips the endpoints', () => {
    const lut = buildToneLut({ ...DEFAULT_SETTINGS, brightness: 10 });
    expect(lut[128]).toBe(154); expect(lut[255]).toBe(255);
    expect(buildToneLut({ ...DEFAULT_SETTINGS, brightness: -10 })[0]).toBe(0);
  });
  it('increases contrast around the midpoint and reduces contrast consistently', () => {
    const increased = buildToneLut({ ...DEFAULT_SETTINGS, contrast: 50 });
    expect(increased[64]).toBeLessThan(64); expect(increased[192]).toBeGreaterThan(192);
    const reduced = buildToneLut({ ...DEFAULT_SETTINGS, contrast: -50 });
    expect(reduced[64]).toBe(96); expect(reduced[192]).toBe(160);
    expect(buildToneLut({ ...DEFAULT_SETTINGS, contrast: -100 })[15]).toBe(128);
  });
  it('maps black/white points and interpolates linearly', () => {
    const lut = buildToneLut({ ...DEFAULT_SETTINGS, blackPoint: 50, whitePoint: 200 });
    expect([lut[0], lut[50], lut[125], lut[200], lut[255]]).toEqual([0, 0, 128, 255, 255]);
  });
  it('defines gamma > 1 as lighter midtones, preserving black and white', () => {
    const lut = buildToneLut({ ...DEFAULT_SETTINGS, gamma: 2 });
    expect(lut[64]).toBe(128); expect(lut[0]).toBe(0); expect(lut[255]).toBe(255);
    expect(buildToneLut({ ...DEFAULT_SETTINGS, gamma: 0.5 })[128]).toBe(64);
  });
  it('composes levels, gamma, brightness, contrast before rounding', () => {
    const lut = buildToneLut({ ...DEFAULT_SETTINGS, blackPoint: 20, whitePoint: 220, gamma: 1.5, brightness: 5, contrast: 10 });
    const expected = Math.round(((255 * ((100 - 20) / 200) ** (1 / 1.5) + 5 * 2.55) - 127.5) / (1 - 10 / 101) + 127.5);
    expect(lut[100]).toBe(expected);
  });
});

describe('histogram and automatic levels', () => {
  it('counts luminance bins exactly', () => {
    const bins = histogram(grayImage([0, 0, 42, 128, 255]));
    expect(bins[0]).toBe(2); expect(bins[42]).toBe(1); expect(bins[128]).toBe(1); expect(bins[255]).toBe(1);
    expect(bins.reduce((a, b) => a + b)).toBe(5);
  });
  it('ignores sparse outliers with percentile clipping', () => {
    const bins = new Uint32Array(256); bins[0] = 1; bins[40] = 50; bins[210] = 948; bins[255] = 1;
    expect(automaticLevels(bins)).toEqual({ blackPoint: 40, whitePoint: 210 });
  });
  it('handles empty and near-flat images without inventing contrast', () => {
    expect(automaticLevels(new Uint32Array(256))).toEqual({ blackPoint: 0, whitePoint: 255 });
    expect(automaticLevels(histogram(grayImage([180, 182, 183])))).toEqual({ blackPoint: 0, whitePoint: 255 });
  });
});

describe('thresholds', () => {
  it('applies an inclusive global cutoff', () => {
    expect(grayValues(globalThreshold(grayImage([0, 127, 128, 129, 255]), 128))).toEqual([0, 0, 0, 255, 255]);
  });
  it('adaptive output matches an independent brute-force local-mean reference including edges', () => {
    const width = 7, height = 5, values = Array.from({ length: width * height }, (_, i) => (i * 47 + 83) % 256);
    const image = grayImage(values, width), radius = 2, offset = 8;
    const expected = values.map((value, p) => {
      const x = p % width, y = Math.floor(p / width); let sum = 0, count = 0;
      for (let cy = Math.max(0, y - radius); cy <= Math.min(height - 1, y + radius); cy++) {
        for (let cx = Math.max(0, x - radius); cx <= Math.min(width - 1, x + radius); cx++) { sum += values[cy * width + cx]; count++; }
      }
      return value <= Math.max(0, Math.min(255, sum / count - offset)) ? 0 : 255;
    });
    expect(grayValues(adaptiveThreshold(image, 5, offset))).toEqual(expected);
  });
  it('keeps blank paper white, and thin strokes black', () => {
    const result = adaptiveThreshold(thinLines(), 15, 10);
    expect(at(result, 64, 20)).toBe(0); expect(at(result, 20, 48)).toBe(0); expect(at(result, 20, 20)).toBe(255);
    expect(grayValues(adaptiveThreshold(synthetic(20, 20, () => 190), 15, 10)).every(v => v === 255)).toBe(true);
  });
  it('detects text on both sides of uneven illumination', () => {
    const result = adaptiveThreshold(unevenIllumination(), 15, 10);
    expect(at(result, 20, 40)).toBe(0); expect(at(result, 110, 40)).toBe(0);
    expect(at(result, 20, 20)).toBe(255); expect(at(result, 110, 20)).toBe(255);
  });
  it('does not punch white holes into uniform pure-black ink', () => {
    expect(grayValues(adaptiveThreshold(synthetic(20, 20, () => 0), 15, 10)).every(v => v === 0)).toBe(true);
    const source = largeDarkRegion(), settings = presetSettings('bw', source);
    expect(at(processPixels(source, settings), 64, 48)).toBe(0);
  });
});

describe('local background normalization', () => {
  it('brightens paper while preserving dark text and its contrast', () => {
    const result = normalizeBackground(grayBackground(), 100, 8);
    expect(at(result, 30, 20)).toBe(255);
    expect(at(result, 30, 24)).toBeLessThan(65);
    expect(at(result, 30, 20) - at(result, 30, 24)).toBeGreaterThan(180);
  });
  it('reduces paper illumination differences across the document', () => {
    const source = unevenIllumination(), result = normalizeBackground(source, 100, 8);
    const before = at(source, 110, 20) - at(source, 10, 20), after = at(result, 110, 20) - at(result, 10, 20);
    expect(Math.abs(after)).toBeLessThan(before / 4);
    expect(at(result, 20, 40)).toBeLessThan(85);
  });
  it('does not remove faint single-pixel strokes', () => {
    const result = normalizeBackground(lowContrastText(), 100, 8);
    expect(at(result, 30, 20) - at(result, 30, 24)).toBeGreaterThan(35);
    const thin = normalizeBackground(thinLines(), 100, 8);
    expect(at(thin, 64, 20)).toBeLessThan(125);
  });
  it('guards against bleaching the interior of large dark artwork', () => {
    expect(at(normalizeBackground(largeDarkRegion(), 100, 8), 64, 48)).toBe(24);
  });
  it('is identity at zero strength and never modifies its input', () => {
    const source = grayBackground(), before = source.data.slice();
    expect(normalizeBackground(source, 0, 8)).toEqual(source);
    normalizeBackground(source, 100, 8); expect(source.data).toEqual(before);
  });
});

describe('presets and image quality fixtures', () => {
  it('Clean Scan turns gray paper white and dark text black with editable levels', () => {
    const image = grayBackground(), settings = presetSettings('clean', image), result = processPixels(image, settings);
    expect(settings.blackPoint).toBe(45); expect(settings.whitePoint).toBe(210); expect(settings.contrast).toBe(8);
    expect(at(result, 30, 20)).toBe(255); expect(at(result, 30, 24)).toBe(0);
  });
  it('Remove Shadows explicitly enables normalization without thresholding', () => {
    const settings = presetSettings('shadows', unevenIllumination());
    expect(settings.normalize).toBe(true); expect(settings.thresholdMode).toBe('off'); validateSettings(settings);
  });
  it('Black & White explicitly enables the editable adaptive threshold', () => {
    const settings = presetSettings('bw', grayBackground());
    expect(settings.thresholdMode).toBe('adaptive'); expect(settings.normalize).toBe(true); expect(settings.adaptiveWindow).toBe(51);
  });
  it('Preserve Details retains multiple gray tones and thin lines', () => {
    const diagram = grayscaleDiagram(), settings = presetSettings('details', diagram), result = processPixels(diagram, settings);
    expect(settings.thresholdMode).toBe('off'); expect(settings.normalize).toBe(false);
    expect(new Set(grayValues(result)).size).toBe(8);
    const lineImage = thinLines(), lineSettings = presetSettings('details', lineImage), output = processPixels(lineImage, lineSettings);
    expect(at(output, 64, 20)).toBeLessThan(at(output, 63, 20) - 100);
  });
  it('all presets produce valid, independent configurations', () => {
    for (const id of ['clean', 'shadows', 'bw', 'details'] as const) {
      const settings = presetSettings(id, grayBackground()); validateSettings(settings);
      settings.brightness = 20; expect(DEFAULT_SETTINGS.brightness).toBe(0);
    }
  });
});

describe('invalid parameters', () => {
  it.each([
    { brightness: NaN }, { brightness: 101 }, { contrast: Infinity }, { gamma: 0 }, { gamma: 6 },
    { blackPoint: 255 }, { blackPoint: 200, whitePoint: 100 }, { whitePoint: 256 }, { normalize: 'yes' },
    { normalizationStrength: -1 }, { backgroundRadius: 0 }, { thresholdMode: 'magic' }, { threshold: 300 },
    { adaptiveWindow: 4 }, { adaptiveWindow: 0 }, { adaptiveWindow: 303 }, { adaptiveOffset: 51 },
  ])('rejects %j', patch => { expect(() => validateSettings({ ...DEFAULT_SETTINGS, ...patch } as never)).toThrow(); });
  it('rejects corrupt pixel buffers and invalid threshold/background parameters', () => {
    expect(() => flattenAlpha({ width: 2, height: 1, data: new Uint8ClampedArray(4) })).toThrow();
    expect(() => normalizeBackground(grayImage([1]), 101, 8)).toThrow();
    expect(() => globalThreshold(grayImage([1]), -1)).toThrow();
    expect(() => adaptiveThreshold(grayImage([1]), 4, 2)).toThrow();
    expect(() => automaticLevels(new Uint32Array(255))).toThrow();
    expect(() => automaticLevels(new Uint32Array(256), 0.5, 0.1)).toThrow();
    expect(() => processPixels(grayImage([1]), DEFAULT_SETTINGS, 0)).toThrow();
    expect(() => validateGeometry({ rotation: 90, crop: { x: .9, y: 0, width: .5, height: 1 } })).toThrow();
  });
});
