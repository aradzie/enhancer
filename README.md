# Document Enhancer

A browser-only workspace for cleaning scanned documents and smartphone photos before printing. Built with React, TypeScript, Vite, Canvas 2D, and a dedicated image-processing worker. No backend, accounts, analytics, or image uploads. Fonts are bundled locally.

## Run locally

Use **Node.js 24.15+ (LTS) or 26+** and npm.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). A locally generated sample is ready to experiment with. Use **Open**, drop a file anywhere in the editor, or paste a clipboard image to replace it. JPEG, PNG, and WebP are accepted. Browser decoding honors camera EXIF orientation. Limits are 64 MB and 40 megapixels to keep processing memory bounded; large files still need substantial available memory.

```sh
npm test              # Deterministic unit, integration, hook, and worker tests
npm run test:watch    # Interactive Vitest
npm run build        # Type-check and build static dist/
npm run preview      # Serve the production build locally
```

Optional Chromium end-to-end tests:

```sh
npx playwright install chromium
npm run test:browser

# Or reuse an installed Chromium:
CHROMIUM_PATH=/usr/bin/chromium-browser npm run test:browser
```

Playwright starts and stops its own local Vite server. It exercises actual Canvas and Web Worker processing, file import, clipboard/drop events, presets, controls, comparison, crop/rotate, PNG downloads, full-resolution print-frame preparation, saved preferences, and a narrow mobile layout. It checks PNG IHDR dimensions rather than trusting a filename or preview. Native printer output still depends on the browser, printer, and driver; tests inspect the prepared print document while substituting the native print dialog.

You can also run the same browser suite against a production build under a Pages-style subpath:

```sh
VITE_BASE_PATH=/enhancer/ npm run build
VITE_BASE_PATH=/enhancer/ PLAYWRIGHT_PRODUCTION=1 npm run test:browser
```

## Use the editor

1. Open a document. The source remains immutable in memory.
2. Choose a preset, then adjust its ordinary settings. Changing any adjustment clears the preset selection indicator.
3. Use **Original / Compare / Enhanced**, or hold **Space**, to compare. Drag to pan. Use **Fit**, **1:1**, and zoom buttons to inspect the page. The 100% view uses source pixel dimensions; its raster is still the performance preview.
4. Open **Advanced adjustments** for thresholds and spatial sizes. Open **Crop & rotate** to trim percentages from the original edges and rotate clockwise in 90° increments. Cropping precedes rotation. Click **Apply crop** to apply the trims.
5. **Export PNG** renders the current settings again at full source resolution (or explicitly cropped/rotated dimensions). Files are lossless and named `original-name-enhanced.png`.
6. **Print** lets you choose A4 or Letter, portrait or landscape, margins, and fit-to-page. Only a full-resolution document is sent to a separate print frame. Match these settings in the native print dialog and disable its headers and footers. Fit mode preserves aspect ratio. Actual-size mode uses 96 CSS pixels per inch; oversized pages may overflow or paginate.

**Reset** restores neutral tone settings, grayscale enabled, no normalization or thresholding, the full crop, and zero rotation. Each numeric adjustment has its own reset button; advanced settings and geometry also have grouped resets. Print preferences survive an editor reset.

Keyboard shortcuts work with Ctrl on Windows/Linux or Command on macOS:

| Shortcut | Action |
| --- | --- |
| Ctrl/Command+O | Open |
| Ctrl/Command+S | Export PNG |
| Ctrl/Command+P | Print settings |
| Ctrl/Command+V | Paste an image from the clipboard |
| Hold Space | Temporarily show the original, outside input fields and interactive controls |

The app stores only adjustment and print preferences in `localStorage`. It never persists uploaded images, source geometry, or exported files. A refresh restores preferences and the built-in sample, not the uploaded document. Storage failures do not prevent editing. After the app assets load, image processing needs no network connection; this is not an offline-installable PWA.

## Algorithms and parameter semantics

The deterministic processing pipeline is **crop → rotate → composite transparency on paper white → optional grayscale → optional illumination normalization → tone lookup table → optional threshold**. There is no sharpening, noise reduction, deskew, boundary detection, or perspective correction.

### Tone and levels

Grayscale uses rounded Rec. 709 luminance: `0.2126 R + 0.7152 G + 0.0722 B`. Images with alpha are first composited on white; output is opaque for predictable printing.

A single 256-entry lookup table composes levels, gamma, brightness, and contrast before rounding. For each input intensity `i`:

```text
level = clamp((i - blackPoint) / (whitePoint - blackPoint), 0, 1)
tone = 255 × level^(1 / gamma) + 2.55 × brightness
factor = contrast >= 0 ? 1 / (1 - contrast / 101) : 1 + contrast / 100
output = clamp(round((tone - 127.5) × factor + 127.5), 0, 255)
```

Without grayscale, the same table is applied independently to each RGB channel. Color correction is deliberately simple; it is not a color-management or photographic retouching tool.

| Control | Range / neutral value | Meaning |
| --- | --- | --- |
| Brightness | −100…100 / 0 | Adds up to ±255 intensity units before contrast |
| Contrast | −100…100 / 0 | Linear stretch about 127.5; −100 produces flat gray; +100 is extreme |
| Black point | 0…254 / 0 | Input at or below this maps to black, before subsequent tone adjustments |
| White point | 1…255 / 255 | Input at or above this maps to white, before subsequent tone adjustments; must exceed black point |
| Gamma | 0.1…5 / 1 | Greater than 1 lightens midtones; less than 1 darkens them |
| Normalization strength | 0…100% / 85% when enabled | Blend between original and illumination-corrected pixels |
| Background radius | 8…300 px / 60 px | Local background-estimation radius, in full-resolution pixels |
| Global threshold | 0…255 / 128 | Intensity ≤ cutoff becomes black, otherwise white |
| Adaptive window | Odd values 3…301 px / 51 px | Local mean window, in full-resolution pixels |
| Adaptive offset | −50…50 / 10 | Pixel ≤ local mean minus offset becomes black; lowering retains more faint strokes |
| Crop trims | 0…90% per edge / 0 | Combined opposing trims must leave at least 0.1% of the source dimension |
| Rotation | 0°, 90°, 180°, 270° / 0° | Exact clockwise pixel remapping after crop |
| Print margin | 0…40 mm / 12 mm | All four paper margins |

Auto levels use a 256-bin luminance histogram with 0.5th and 99.5th percentiles, avoiding isolated extremes. A range narrower than eight intensity units is left alone to avoid exaggerating noise. Preset analysis uses a downsampled source (long edge ≤1,400 px), after geometry and, if applicable, normalization. Its computed black and white points populate the visible controls; they are fixed values shared by preview and export, not a hidden export-time auto adjustment.

### Illumination normalization

A separable sliding-window **maximum filter**, implemented using monotonic deques, estimates bright paper around narrow ink strokes. A local box mean of that estimate, with half the radius, smooths it. Each channel is multiplied by `255 / estimatedPaper`, blended by the selected strength. A gradual confidence guard between estimated intensities 40 and 100 avoids turning the interiors of large near-black regions white. Both passes take linear time in the number of pixels.

Choose a background radius wider than text strokes but smaller than illumination variations. Like any local paper estimate, it can alter broad dark or photographic regions and transitions around them; inspect the comparison and disable normalization for artwork when appropriate. It does not claim to recover clipped details. Faint text is safest with **Preserve Details**, or with thresholding disabled.

### Thresholding and presets

Adaptive thresholding uses a Float64 integral image for constant-time local means, with clipped windows at document edges. Pixels at or below `mean − offset` become black; others become white. The local cutoff is clamped to 0…255, so uniform pure-black ink remains black rather than acquiring white holes. It is useful for text but deliberately discards gray detail. Global thresholding uses one cutoff. Both force grayscale even if the grayscale setting was previously off.

- **Clean Scan:** grayscale, automatic levels, contrast +8, no normalization or thresholding.
- **Remove Shadows:** grayscale, 85% background normalization, automatic levels, no thresholding.
- **Black & White:** grayscale, normalization, automatic levels, adaptive threshold with 51 px window and offset 10.
- **Preserve Details:** grayscale and conservative levels from the full percentile range, with 15 units of black-side and 10 units of white-side headroom; no normalization or thresholding.

### Preview and performance

Previews are area-averaged down to a maximum 1,600 px long edge, helping retain thin strokes. Background radius and adaptive window are scaled by the preview/full-resolution ratio; the adaptive window remains odd and at least three pixels. Downsampling and nonlinear filters need not commute, so preview and export are an approximation at different resolutions, and exactly identical at the same resolution. Geometry is always calculated in source coordinates.

Every output comes from the immutable source and current configuration. The worker retains its own source copy, transfers result buffers, and responds with request and source IDs. The React hook debounces preview requests and ignores results from superseded settings or documents. Preset responses are also guarded so they cannot overwrite newer manual edits. Decode races retain the latest file. If Workers are unavailable, the same pure functions run on the main thread after yielding; this fallback can pause interaction on large images. A worker crash surfaces an error and subsequent requests use the fallback.

## Source structure

```text
src/core/        Pure image types, validation, geometry, algorithms, presets, rendering
src/worker/      Typed worker protocol, processing worker, request/response client
src/io/          Image decoding, sample generation, PNG encoding/download, print frame
src/state/       Reducer, validated preferences, document/processing lifecycle hook
src/components/  Accessible controls, sidebar, canvas preview, dialogs
src/App.tsx      Workspace composition and keyboard/import/output interactions
tests/          Deterministic synthetic-image, state, lifecycle, and worker tests
e2e/            Browser integration tests using real Canvas and worker APIs
```

Tests include gray paper, low-contrast text, uneven illumination, single-pixel lines, multi-tone diagrams, large dark artwork, and alpha. Quality assertions check paper/ink contrast, line preservation, grayscale retention, and the dark-region guard; threshold output is also compared against an independent brute-force reference.

## Deploy to GitHub Pages

1. Push this repository to GitHub using `main` or `master`.
2. In **Settings → Pages → Build and deployment**, select **GitHub Actions**.
3. The included workflow installs dependencies with `npm ci`, runs Vitest, type-checks and builds the app, uploads `dist/`, and deploys it. Pull requests run checks and builds without deploying. Manual workflow dispatch is also supported.

Vite defaults to a relative base (`./`), so assets and the worker work on both root and repository Pages URLs. Override the base locally if desired:

```sh
VITE_BASE_PATH=/your-repository/ npm run build
```

For CI, set the repository Actions variable `VITE_BASE_PATH` to the desired base, such as `/your-repository/`. No secrets, server, or runtime environment variables are required. The output is static and can also be hosted on any ordinary static web server.

PDF, OCR, batch processing, AI enhancement, automatic document detection, automatic deskew, and perspective correction are intentionally outside this app's scope.
