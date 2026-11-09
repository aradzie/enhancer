import { useEffect, useRef, useState } from 'react';
import type { PixelImage } from '../core/types';
import { Icon } from './Icon';

export type ViewMode = 'enhanced' | 'split' | 'original';
export function Preview({ image, original, width, height, comparing, processing, onZoomChange, onOpen, filename, sample }: {
  image: PixelImage | null; original: PixelImage | null; width: number; height: number;
  comparing: boolean; processing: boolean; onZoomChange: (value: number) => void; onOpen: () => void; filename?: string; sample?: boolean;
}) {
  const viewport = useRef<HTMLDivElement>(null), afterCanvas = useRef<HTMLCanvasElement>(null), beforeCanvas = useRef<HTMLCanvasElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 800 });
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState<ViewMode>('enhanced');
  const [split, setSplit] = useState(50);
  const dragging = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const fit = Math.min((viewportSize.width - 100) / width, (viewportSize.height - 94) / height, 1.25);
  const actualZoom = zoom === 'fit' ? Math.max(0.02, fit) : zoom;
  const displayMode = comparing ? 'original' : mode;
  useEffect(() => { onZoomChange(actualZoom); }, [actualZoom, onZoomChange]);
  useEffect(() => { setPan({ x: 0, y: 0 }); setZoom('fit'); }, [width, height, filename]);
  useEffect(() => {
    if (!viewport.current) return;
    const element = viewport.current;
    const measure = () => setViewportSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure); observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    for (const [canvas, pixels] of [[afterCanvas.current, image], [beforeCanvas.current, original]] as const) {
      if (!canvas || !pixels) continue;
      canvas.width = pixels.width; canvas.height = pixels.height;
      canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
    }
  }, [image, original]);
  const changeZoom = (next: number | 'fit') => { setZoom(next); if (next === 'fit') setPan({ x: 0, y: 0 }); };

  return <section className="preview-panel" aria-label="Document preview">
    <div className="preview-toolbar">
      <div className="file-label"><Icon name="document" size={17} /><span title={filename}>{filename || 'Your workspace'}</span>{sample && <span className="badge">SAMPLE</span>}</div>
      <div className="view-tabs" aria-label="Preview comparison">
        {(['original', 'split', 'enhanced'] as const).map(value => <button key={value} aria-pressed={displayMode === value} onClick={() => setMode(value)} title={value === 'split' ? 'Compare before and after' : `Show ${value}`}>
          {value === 'split' && <Icon name="compare" size={14} />}{value === 'split' ? 'Compare' : value === 'original' ? 'Original' : 'Enhanced'}
        </button>)}
      </div>
    </div>
    <div className="canvas-viewport" ref={viewport}
      onPointerDown={event => {
        if ((event.target as HTMLElement).closest('button, input')) return;
        dragging.current = { x: event.clientX, y: event.clientY, originX: pan.x, originY: pan.y };
        event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.classList.add('panning');
      }}
      onPointerMove={event => { if (dragging.current) setPan({ x: dragging.current.originX + event.clientX - dragging.current.x, y: dragging.current.originY + event.clientY - dragging.current.y }); }}
      onPointerUp={event => { dragging.current = null; event.currentTarget.classList.remove('panning'); }}
      onPointerCancel={event => { dragging.current = null; event.currentTarget.classList.remove('panning'); }}>
      {image ? <>
        <div className="paper" style={{ width: width * actualZoom, height: height * actualZoom, transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))` }}>
          <canvas ref={afterCanvas} aria-label="Enhanced document" style={{ visibility: displayMode === 'original' ? 'hidden' : 'visible' }} />
          <canvas ref={beforeCanvas} aria-label="Original document" className="original-canvas" style={{ visibility: displayMode === 'enhanced' ? 'hidden' : 'visible', clipPath: displayMode === 'split' ? `inset(0 ${100 - split}% 0 0)` : 'none' }} />
          {displayMode === 'split' && <>
            <span className="paper-badge">BEFORE</span>
            <span className="paper-badge after-badge">AFTER</span>
            <div className="comparison-line" style={{ left: `${split}%` }}><span><Icon name="compare" size={16} /></span></div>
            <input type="range" className="comparison-range" min="0" max="100" value={split} onChange={e => setSplit(Number(e.target.value))} aria-label="Comparison split" title="Drag to compare" />
          </>}
        </div>
      </> : <div className="empty-state"><h2>Open an image</h2><p>Drop a scan or document photo into your workspace.</p><button className="button primary" onClick={onOpen}><Icon name="folder" />Open a document</button><span>JPEG, PNG or WebP · or paste an image</span></div>}
      {processing && <div className="processing-pill" role="status"><span className="spinner" />Updating preview</div>}
      <div className="zoom-toolbar" aria-label="Zoom controls">
        <button onClick={() => changeZoom(Math.max(0.05, actualZoom / 1.25))} aria-label="Zoom out" title="Zoom out"><Icon name="minus" size={16} /></button>
        <button className="zoom-value" onClick={() => changeZoom(1)} title="View at 100%">{Math.round(actualZoom * 100)}%</button>
        <button onClick={() => changeZoom(Math.min(8, actualZoom * 1.25))} aria-label="Zoom in" title="Zoom in"><Icon name="plus" size={16} /></button>
        <span className="toolbar-divider" />
        <button onClick={() => changeZoom('fit')} className={zoom === 'fit' ? 'selected' : ''} aria-label="Fit to window" title="Fit to window"><Icon name="fit" size={16} /><span>Fit</span></button>
        <button onClick={() => changeZoom(1)} className={zoom === 1 ? 'selected' : ''} aria-label="100% zoom" title="100% zoom">1:1</button>
      </div>
    </div>
    <div className="preview-footer"><span><Icon name="eye" size={14} />Hold <kbd>Space</kbd> to see the original</span><span>Drag to pan<span className="small-dot" />Full resolution on export</span></div>
  </section>;
}
