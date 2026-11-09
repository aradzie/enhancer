import { isPrintSettings } from '../core/settings';
import type { PixelImage, PrintSettings } from '../core/types';
import { pngBlob } from './export';

export function printLayout(settings: PrintSettings) {
  if (!isPrintSettings(settings)) throw new Error('Invalid print settings.');
  let [width, height] = settings.paper === 'A4' ? [210, 297] : [215.9, 279.4];
  if (settings.orientation === 'landscape') [width, height] = [height, width];
  return { width, height, contentWidth: width - 2 * settings.margin, contentHeight: height - 2 * settings.margin };
}

/** A separate same-origin frame prints only the full-resolution document. */
export async function printDocument(image: PixelImage, settings: PrintSettings): Promise<void> {
  const layout = printLayout(settings), blob = await pngBlob(image), url = URL.createObjectURL(blob);
  const frame = document.createElement('iframe');
  frame.title = 'Print enhanced document'; frame.className = 'print-frame';
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0;';
  document.body.append(frame);
  const cleanup = () => { frame.remove(); URL.revokeObjectURL(url); };
  try {
    const doc = frame.contentDocument, target = frame.contentWindow;
    if (!doc || !target) throw new Error('The print window could not be opened.');
    const style = doc.createElement('style');
    style.textContent = `@page { size: ${layout.width}mm ${layout.height}mm; margin: ${settings.margin}mm; }
      html, body { margin: 0; padding: 0; background: white; }
      body { width: ${layout.contentWidth}mm; }
      img { display: block; object-fit: contain; object-position: top center; break-inside: avoid;
        ${settings.fit ? `width: ${layout.contentWidth}mm; height: ${layout.contentHeight - 0.5}mm;` : `width: ${image.width}px; height: ${image.height}px; max-width: none;`} }
      * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }`;
    doc.head.append(style); doc.title = 'Enhanced document';
    const img = doc.createElement('img'); img.alt = 'Enhanced document'; img.src = url; doc.body.append(img);
    await img.decode();
    target.addEventListener('afterprint', cleanup, { once: true });
    // Let the decoded image participate in layout before opening the print dialog.
    await new Promise(resolve => setTimeout(resolve, 100));
    target.focus(); target.print();
    // Some engines omit afterprint; retain the frame long enough for their print renderer.
    setTimeout(cleanup, 300_000);
  } catch (error) { cleanup(); throw error; }
}
