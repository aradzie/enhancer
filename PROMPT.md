# Build Document Enhancer

## Objective

Build a single-page web application for cleaning scanned documents and smartphone photographs before printing.

The application should provide automatic document enhancement and manual adjustments similar to GIMP's Levels, Brightness, and Contrast tools.

The primary goal is to transform documents with gray backgrounds, faded text, shadows, and uneven illumination into clean, readable, print-ready images.

The application must be simple to operate and run entirely in the browser.

## Technology

Use:

- Vite
- React
- TypeScript
- Canvas 2D API
- Web Workers for computationally expensive processing
- Vitest
- Plain CSS or CSS Modules
- GitHub Actions for GitHub Pages deployment

Avoid unnecessary dependencies and abstractions.

No backend, authentication, database, or cloud processing.

## Functional requirements

### 1. Import

Support:

- JPEG, PNG, WebP
- File selection
- Drag-and-drop
- Clipboard paste

Display image dimensions and filename.

Keep the original image immutable.

### 2. Automatic presets

Implement four presets:

**Clean Scan**

- Grayscale conversion.
- Automatic levels.
- Mild contrast enhancement.

**Remove Shadows**

- Grayscale conversion.
- Local background illumination estimation.
- Illumination normalization.
- Automatic levels.

**Black & White**

- Grayscale conversion.
- Background normalization where appropriate.
- Adaptive thresholding.

**Preserve Details**

- Conservative levels adjustment.
- Avoid aggressive thresholding.
- Preserve grayscale detail.

Preset selection must populate the ordinary processing settings.

Users must be able to modify any preset's parameters.

### 3. Manual adjustments

Provide controls for:

- Grayscale enable/disable.
- Brightness.
- Contrast.
- Black point.
- White point.
- Gamma.
- Background normalization enable/disable.
- Background normalization strength.
- Global threshold.
- Adaptive threshold.
- Adaptive threshold window size and offset.

Expose advanced parameters in a collapsible section.

All controls must have numeric values, sensible ranges, documented semantics, and reset functionality.

### 4. Image processing

Implement a non-destructive processing pipeline:

1. Crop and rotate.
2. Convert to grayscale when required.
3. Normalize uneven illumination when enabled.
4. Apply tone adjustments.
5. Apply optional thresholding.

Use pure TypeScript processing functions where practical.

Implement brightness, contrast, gamma, and levels using a composable 256-entry lookup table for grayscale intensity processing.

Implement histogram calculation and percentile-based automatic levels.

Implement background normalization using a documented local background-estimation technique.

Implement adaptive thresholding using an efficient algorithm, preferably integral images.

Preserve faint text and thin lines as much as possible.

Do not silently apply image sharpening or destructive noise reduction.

Do not repeatedly modify an already processed image. Always derive output from the immutable source and current settings.

### 5. Preview

Provide:

- Interactive live preview.
- Fit-to-window.
- 100% zoom.
- Zoom in/out.
- Pan.
- Before/after comparison.
- Loading and processing states.

Use a downsampled preview for performance.

Process images in a Web Worker where supported.

Prevent stale worker responses from overwriting newer preview results.

Ensure that spatial processing parameters scale appropriately between preview and full-resolution output.

### 6. Export

Export PNG files at the original image resolution, except where the user has explicitly cropped or rotated the document.

Use lossless output.

Name exported files using the original filename plus an `-enhanced` suffix.

Show an error message if processing fails.

### 7. Printing

Implement direct browser printing.

Requirements:

- Print the processed document only.
- Support A4 and Letter.
- Support portrait and landscape.
- Configurable margins.
- Fit-to-page mode.
- Preserve aspect ratio.
- Use full-resolution processed output.

Do not print the editor interface.

### 8. UI

Create a minimal desktop-oriented interface.

Layout:

- Top toolbar: Open, Reset, Print, Export.
- Main image preview.
- Right sidebar: Presets and adjustment controls.
- Bottom status bar: image dimensions, zoom, processing state.

Use a modern, restrained appearance.

Support keyboard shortcuts:

- Ctrl+O: Open
- Ctrl+S: Export
- Ctrl+P: Print
- Ctrl+V: Paste image
- Hold Space: temporarily compare with original, when not editing a text field

Make the interface usable on smaller screens, but prioritize desktop use.

### 9. Architecture

Separate:

- UI components
- Application state
- Image loading and decoding
- Geometry transformations
- Image-processing algorithms
- Worker communication
- Export
- Printing

Keep processing code independent of React.

Use TypeScript interfaces for processing configuration.

Avoid unnecessary global state-management libraries.

Store user preferences and last-used settings in localStorage.

Do not persist uploaded images.

### 10. Tests

Implement deterministic unit tests for:

- Grayscale conversion.
- Brightness and contrast.
- Black and white point mapping.
- Gamma.
- Histogram.
- Automatic levels.
- Global threshold.
- Adaptive threshold.
- Background normalization.
- Invalid parameters.
- Alpha handling.
- Preset configuration.

Add integration tests demonstrating that:

- Preview and export produce equivalent results at the same resolution.
- Reset restores default settings.
- Preset changes update the processing configuration.
- Export uses the full-resolution image.

Include synthetic test images representing:

- Gray background with dark text.
- Low-contrast text.
- Uneven illumination.
- Thin lines.
- Grayscale diagrams.
- Large dark regions.

Do not assert that a visually destructive algorithm is correct merely because it returns a valid image.

### 11. Deployment

Configure Vite for GitHub Pages.

Make the base path configurable.

Provide a GitHub Actions workflow that:

1. Installs dependencies.
2. Runs tests.
3. Builds the application.
4. Deploys to GitHub Pages.

Include a README explaining development, build, test, and deployment commands.

### 12. Out of scope

Do not implement:

- PDF import or export.
- Batch processing.
- OCR.
- Perspective correction.
- Automatic document boundary detection.
- Automatic deskew.
- AI-based enhancement.
- User accounts.
- Server-side processing.

### 13. Implementation quality

Prioritize correctness and maintainability.

Use well-defined mathematical transformations.

Keep the UI responsive.

Document algorithms and parameter semantics.

Avoid excessive dependencies.

Use semantic controls and accessible labels.

Provide meaningful error handling.

Verify the production build and tests.

## Delivery

Produce a complete, working application ready for GitHub Pages deployment.

Include:

- Source code.
- Tests.
- README.
- GitHub Actions configuration.
- Concise explanation of processing algorithms and architectural choices.

Implement the MVP completely before introducing additional features.
