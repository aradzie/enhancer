import type { PixelImage } from '../core/types';

export interface DocumentImage { name: string; image: PixelImage; sample?: boolean }
export const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp';
const MAX_PIXELS = 40_000_000;

export function imageCanvas(image: PixelImage): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not create an image canvas.');
  ctx.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
  return canvas;
}

export async function decodeFile(file: File): Promise<DocumentImage> {
  if (!(ACCEPTED_TYPES.split(',').includes(file.type) || (!file.type && /\.(jpe?g|png|webp)$/i.test(file.name)))) {
    throw new Error('Please choose a JPEG, PNG, or WebP image. PDF files are not supported.');
  }
  if (file.size > 64 * 1024 * 1024) throw new Error('This file is too large. Choose an image smaller than 64 MB.');
  let decoded: ImageBitmap | HTMLImageElement;
  let url: string | undefined;
  try {
    if (typeof createImageBitmap === 'function') decoded = await createImageBitmap(file, { imageOrientation: 'from-image' });
    else {
      url = URL.createObjectURL(file);
      const image = new Image(); image.src = url; await image.decode(); decoded = image;
    }
    try {
      const width = decoded instanceof HTMLImageElement ? decoded.naturalWidth : decoded.width;
      const height = decoded instanceof HTMLImageElement ? decoded.naturalHeight : decoded.height;
      if (width < 1 || height < 1 || width * height > MAX_PIXELS) throw new Error('Choose an image with valid dimensions, up to 40 megapixels.');
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Your browser could not create an image canvas.');
      ctx.drawImage(decoded, 0, 0);
      return { name: file.name || 'clipboard-image.png', image: { width, height, data: ctx.getImageData(0, 0, width, height).data } };
    } finally { if ('close' in decoded) decoded.close(); }
  } catch (error) {
    if (error instanceof Error && /megapixels|canvas/.test(error.message)) throw error;
    throw new Error('This image could not be decoded. It may be damaged or use an unsupported format.');
  } finally { if (url) URL.revokeObjectURL(url); }
}

/** A locally drawn example, with faint strokes and deliberate uneven paper illumination. */
export function sampleDocument(): DocumentImage {
  const canvas = document.createElement('canvas'); canvas.width = 1240; canvas.height = 1754;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  ctx.fillStyle = '#e1ded1'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#55564f'; ctx.font = '19px sans-serif';
  ctx.fillText('FIELDNOTES', 125, 135); ctx.textAlign = 'right'; ctx.fillText('RESEARCH SERIES  /  024', 1115, 135); ctx.textAlign = 'left';
  ctx.strokeStyle = '#85847a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(125, 170); ctx.lineTo(1115, 170); ctx.stroke();
  ctx.fillStyle = '#42433d'; ctx.font = '66px Georgia, serif'; ctx.fillText('Small observations.', 125, 298); ctx.fillText('Clearer thinking.', 125, 378);
  ctx.fillStyle = '#73736b'; ctx.font = '22px sans-serif'; ctx.fillText('Notes on the everyday things that make a difference.', 127, 444);
  ctx.font = 'bold 18px sans-serif'; ctx.fillStyle = '#55564f'; ctx.fillText('01   THE VALUE OF A FRESH PERSPECTIVE', 125, 562);
  ctx.font = '25px Georgia, serif';
  const lines = [
    'A good idea often begins with a small observation. A detail',
    'in the margin, a passing thought, a question worth keeping.',
    'Put it on paper. Give it a little space. Come back to it.',
    '',
    'Clarity is less about adding something new and more about',
    'making room for what is already there. Remove the noise,',
    'keep the essentials, and let the important things stand out.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, 125, 620 + i * 43));
  ctx.strokeStyle = '#8c8b80'; ctx.beginPath(); ctx.moveTo(125, 976); ctx.lineTo(1115, 976); ctx.stroke();
  ctx.font = 'bold 18px sans-serif'; ctx.fillText('02   A SIMPLE PROCESS', 125, 1040);
  const boxes = [{ x: 130, label: 'Observe', n: '01' }, { x: 480, label: 'Refine', n: '02' }, { x: 830, label: 'Make', n: '03' }];
  boxes.forEach(({ x, label, n }) => {
    ctx.strokeStyle = '#8b8b80'; ctx.lineWidth = 1.5; ctx.strokeRect(x, 1090, 270, 170);
    ctx.font = '18px sans-serif'; ctx.fillStyle = '#8b8b80'; ctx.fillText(n, x + 28, 1130);
    ctx.font = '32px Georgia, serif'; ctx.fillStyle = '#57584e'; ctx.fillText(label, x + 28, 1215);
  });
  ctx.font = '27px sans-serif'; ctx.fillStyle = '#8b8b80'; ctx.fillText('→', 428, 1185); ctx.fillText('→', 778, 1185);
  ctx.font = 'italic 25px Georgia, serif'; ctx.fillStyle = '#929184'; ctx.fillText('“Keep what matters. Make it a little clearer.”', 125, 1385);
  ctx.strokeStyle = '#929184'; ctx.lineWidth = 0.75; ctx.beginPath(); ctx.moveTo(125, 1530); ctx.lineTo(1115, 1530); ctx.stroke();
  ctx.font = '17px sans-serif'; ctx.fillText('A WORKING DOCUMENT · NOVEMBER 2026', 125, 1580); ctx.textAlign = 'right'; ctx.fillText('01 / 01', 1115, 1580);
  const shadow = ctx.createLinearGradient(0, 0, 1240, 700); shadow.addColorStop(0, 'rgba(45,39,24,.30)'); shadow.addColorStop(0.6, 'rgba(45,39,24,.02)'); shadow.addColorStop(1, 'rgba(45,39,24,0)');
  ctx.fillStyle = shadow; ctx.fillRect(0, 0, 1240, 1754);
  return { name: 'fieldnotes-scan.png', sample: true, image: { width: canvas.width, height: canvas.height, data: ctx.getImageData(0, 0, canvas.width, canvas.height).data } };
}
