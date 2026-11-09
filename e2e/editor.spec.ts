import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function fixture(page: Page, width = 2400, height = 1800, mime = 'image/png') {
  const base64 = await page.evaluate(({ width, height, mime }) => {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, width, 0); gradient.addColorStop(0, '#aaaaaa'); gradient.addColorStop(1, '#eeeeee');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#333333'; ctx.font = '50px serif'; ctx.fillText('A document worth keeping.', 50, 100);
    ctx.strokeStyle = '#888888'; ctx.lineWidth = 1; ctx.strokeRect(50, 150, 100, 100);
    return canvas.toDataURL(mime).split(',')[1];
  }, { width, height, mime });
  return Buffer.from(base64, 'base64');
}
async function ready(page: Page) {
  await expect(page.getByRole('status').filter({ hasText: /^Ready$/ })).toBeVisible();
}
async function openFixture(page: Page, width = 2400, height = 1800) {
  const buffer = await fixture(page, width, height);
  await page.getByLabel('Open image file').setInputFiles({ name: 'test-scan.png', mimeType: 'image/png', buffer });
  await expect(page.getByText('test-scan.png', { exact: true })).toBeVisible(); await ready(page);
  return buffer;
}

test.beforeEach(async ({ page }) => { await page.goto('./'); await ready(page); });

test('sample, all presets, manual numeric edits, reset, and comparison work in the real worker', async ({ page }) => {
  await expect(page.getByLabel('Enhanced document')).toBeVisible();
  await expect(page.getByText('1,240 × 1,754 px')).toBeVisible();
  for (const name of ['Clean Scan', 'Remove Shadows', 'Black & White', 'Preserve Details']) {
    const button = page.getByRole('button', { name: new RegExp(name) });
    await button.click(); await expect(button).toHaveAttribute('aria-pressed', 'true'); await ready(page);
  }
  await page.getByLabel('Brightness value', { exact: true }).fill('25'); await ready(page);
  await expect(page.getByLabel('Brightness value', { exact: true })).toHaveValue('25');
  await page.getByRole('button', { name: 'Reset', exact: true }).click(); await ready(page);
  await expect(page.getByLabel('Brightness value', { exact: true })).toHaveValue('0');
  await expect(page.getByLabel('Black point value', { exact: true })).toHaveValue('0');
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await expect(page.getByLabel('Comparison split')).toBeVisible();
  await page.getByLabel('Comparison split').fill('70');
  await page.getByRole('button', { name: 'Enhanced', exact: true }).click();
  await page.locator('body').click({ position: { x: 2, y: 180 } });
  await page.keyboard.down('Space'); await expect(page.getByRole('button', { name: 'Original', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.up('Space'); await expect(page.getByRole('button', { name: 'Enhanced', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
});

test('uploads, exports full-size PNG, and applies crop and rotation to output', async ({ page }) => {
  await openFixture(page);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PNG', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('test-scan-enhanced.png');
  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(1, 4).toString()).toBe('PNG'); expect(bytes.readUInt32BE(16)).toBe(2400); expect(bytes.readUInt32BE(20)).toBe(1800);
  await page.getByText('Crop & rotate', { exact: true }).click();
  await page.getByLabel('Crop left', { exact: true }).fill('10');
  await page.getByLabel('Crop right', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Apply crop', exact: true }).click(); await ready(page);
  await page.getByRole('button', { name: '0°', exact: true }).click(); await ready(page);
  await expect(page.getByText('1,800 × 1,920 px')).toBeVisible();
  const croppedPromise = page.waitForEvent('download'); await page.keyboard.press('Control+s');
  const cropped = await croppedPromise, croppedBytes = await readFile((await cropped.path())!);
  expect(croppedBytes.readUInt32BE(16)).toBe(1800); expect(croppedBytes.readUInt32BE(20)).toBe(1920);
  await page.getByRole('button', { name: 'Reset', exact: true }).click(); await ready(page);
  await expect(page.getByText('2,400 × 1,800 px')).toBeVisible();
  await expect(page.getByLabel('Crop left', { exact: true })).toHaveValue('0');
});

test('accepts JPEG and WebP and reports unsupported or damaged files without losing the current image', async ({ page }) => {
  for (const [mime, ext] of [['image/jpeg', 'jpg'], ['image/webp', 'webp']]) {
    await page.getByLabel('Open image file').setInputFiles({ name: `photo.${ext}`, mimeType: mime, buffer: await fixture(page, 400, 300, mime) });
    await expect(page.getByText(`photo.${ext}`, { exact: true })).toBeVisible(); await ready(page);
  }
  await page.getByLabel('Open image file').setInputFiles({ name: 'file.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not an image') });
  await expect(page.getByRole('alert')).toContainText('JPEG, PNG, or WebP');
  await expect(page.getByText('photo.webp', { exact: true })).toBeVisible();
  await page.getByLabel('Open image file').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('broken') });
  await expect(page.getByRole('alert')).toContainText('could not be decoded');
});

test('drag-and-drop and clipboard paste load images', async ({ page }) => {
  const buffer = await fixture(page, 600, 800), encoded = buffer.toString('base64');
  await page.evaluate(encoded => {
    const data = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    const transfer = new DataTransfer(); transfer.items.add(new File([data], 'dropped.png', { type: 'image/png' }));
    document.querySelector('.app-shell')!.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, encoded);
  await expect(page.getByText('dropped.png', { exact: true })).toBeVisible(); await ready(page);
  await page.evaluate(encoded => {
    const data = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    const transfer = new DataTransfer(); transfer.items.add(new File([data], 'pasted.png', { type: 'image/png' }));
    window.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: transfer }));
  }, encoded);
  await expect(page.getByText('pasted.png', { exact: true })).toBeVisible(); await ready(page);
});

test('print frame contains only the full-resolution document and selected paper layout', async ({ page }) => {
  await openFixture(page);
  // Substitute the native print dialog so its prepared frame can be inspected deterministically.
  await page.evaluate(() => {
    const original = document.createElement.bind(document);
    document.createElement = ((tag: string, options?: ElementCreationOptions) => {
      const element = original(tag, options);
      if (tag === 'iframe') {
        const originalAppend = document.body.append.bind(document.body);
        document.body.append = (...nodes) => {
          originalAppend(...nodes);
          const frame = element as HTMLIFrameElement;
          if (nodes.includes(frame) && frame.contentWindow) frame.contentWindow.print = () => { frame.dataset.printed = 'true'; };
        };
      }
      return element;
    }) as typeof document.createElement;
  });
  await page.keyboard.press('Control+p');
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  await dialog.getByLabel('Paper size').selectOption('Letter'); await dialog.getByLabel('Orientation').selectOption('landscape');
  await dialog.getByLabel('Margins').fill('8');
  await dialog.getByRole('button', { name: 'Print document', exact: true }).click();
  const frame = page.locator('iframe.print-frame'); await expect(frame).toHaveAttribute('data-printed', 'true');
  const image = page.frameLocator('iframe.print-frame').getByRole('img');
  await expect(image).toBeAttached(); expect(await image.evaluate((el: HTMLImageElement) => [el.naturalWidth, el.naturalHeight])).toEqual([2400, 1800]);
  await expect(page.frameLocator('iframe.print-frame').locator('button')).toHaveCount(0);
  expect(await page.frameLocator('iframe.print-frame').locator('style').textContent()).toContain('size: 279.4mm 215.9mm; margin: 8mm');
});

test('zoom, pan, and persisted settings work without persisting uploaded images', async ({ page }) => {
  await page.getByRole('button', { name: '100% zoom', exact: true }).click();
  await expect(page.locator('.zoom-value')).toHaveText('100%');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click(); await expect(page.locator('.zoom-value')).toHaveText('125%');
  const paper = page.locator('.paper'), before = await paper.getAttribute('style');
  await page.mouse.move(450, 500); await page.mouse.down(); await page.mouse.move(500, 530); await page.mouse.up();
  expect(await paper.getAttribute('style')).not.toBe(before);
  await page.getByRole('button', { name: 'Fit to window', exact: true }).click();
  await openFixture(page, 800, 600);
  await page.getByLabel('Brightness value', { exact: true }).fill('20'); await ready(page);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('document-enhancer.preferences.v1')!));
  expect(Object.keys(stored).sort()).toEqual(['print', 'settings']);
  await page.reload(); await ready(page);
  await expect(page.getByLabel('Brightness value', { exact: true })).toHaveValue('20');
  await expect(page.getByText('fieldnotes-scan.png', { exact: true })).toBeVisible();
});

test('mobile workspace fits without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Export PNG', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  for (const button of ['Open', 'Reset', 'Print', 'Export PNG']) {
    const box = await page.getByRole('button', { name: button, exact: true }).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  }
  await page.getByRole('button', { name: /Clean Scan/ }).click(); await ready(page);
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
});

test('numeric fields accept signed and decimal typing and recover from invalid drafts', async ({ page }) => {
  const brightness = page.getByLabel('Brightness value', { exact: true });
  await brightness.fill(''); await brightness.pressSequentially('-15'); await brightness.press('Tab'); await ready(page);
  await expect(brightness).toHaveValue('-15');
  const gamma = page.getByLabel('Gamma value', { exact: true });
  await gamma.fill(''); await gamma.pressSequentially('0.75'); await gamma.press('Enter'); await ready(page);
  await expect(gamma).toHaveValue('0.75');
  await gamma.fill(''); await gamma.press('Tab'); await expect(gamma).toHaveValue('0.75');
});

test('desktop stays within its window and reloads without contacting external services', async ({ page }) => {
  const external: string[] = [];
  page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:5173/')) external.push(request.url()); });
  await page.reload(); await ready(page); await page.evaluate(() => document.fonts.ready);
  expect(external).toEqual([]);
  const metrics = await page.evaluate(() => ({ viewport: innerHeight, height: document.documentElement.scrollHeight }));
  expect(metrics.height).toBe(metrics.viewport);
});
