import { useEffect, useRef, useState } from 'react';
import { geometryDimensions } from './core/geometry';
import { Adjustments } from './components/Adjustments';
import { Icon } from './components/Icon';
import { Modal } from './components/Modal';
import { Preview } from './components/Preview';
import { PrintDialog } from './components/PrintDialog';
import { downloadPng, fullResolutionOutput } from './io/export';
import { ACCEPTED_TYPES } from './io/images';
import { printDocument } from './io/print';
import { useEditor } from './state/useEditor';

const isEditing = (target: EventTarget | null) => target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
const openShortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ O' : 'Ctrl O';
export default function App() {
  const editor = useEditor();
  const { state, document: source, preview, processing, loading, error, setError } = editor;
  const fileInput = useRef<HTMLInputElement>(null);
  const [comparing, setComparing] = useState(false), [zoom, setZoom] = useState(1);
  const [printOpen, setPrintOpen] = useState(false), [helpOpen, setHelpOpen] = useState(false);
  const [busy, setBusy] = useState<'export' | 'print' | null>(null);
  const [toast, setToast] = useState('');
  const [dragging, setDragging] = useState(false);
  const dragCount = useRef(0);
  const dimensions = source ? geometryDimensions(source.image, state.geometry) : null;
  const open = () => fileInput.current?.click();
  const blocked = !source || loading || busy !== null;

  const exportImage = async () => {
    if (!source || busy || loading) return;
    setBusy('export'); setError(null);
    try {
      const output = await fullResolutionOutput(editor.client, state.settings, state.geometry);
      await downloadPng(output, source.name); setToast('Your enhanced PNG is ready.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Export failed. Please try again.'); }
    finally { setBusy(null); }
  };
  const print = async () => {
    if (!source || busy || loading) return;
    setBusy('print'); setError(null);
    try {
      const output = await fullResolutionOutput(editor.client, state.settings, state.geometry);
      await printDocument(output, state.print); setPrintOpen(false);
    } catch (cause) { setPrintOpen(false); setError(cause instanceof Error ? cause.message : 'Printing failed. Please try again.'); }
    finally { setBusy(null); }
  };
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4000); return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'o') { e.preventDefault(); if (!busy) open(); }
        if (key === 's') { e.preventDefault(); void exportImage(); }
        if (key === 'p') { e.preventDefault(); if (!blocked) setPrintOpen(true); }
      }
      if (e.code === 'Space' && !isEditing(e.target) && !printOpen && !helpOpen && !(e.target instanceof HTMLElement && e.target.closest('button, summary, a'))) { e.preventDefault(); setComparing(true); }
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setComparing(false); };
    const blur = () => setComparing(false);
    const paste = (e: ClipboardEvent) => {
      if (isEditing(e.target) || busy) return;
      const item = Array.from(e.clipboardData?.items || []).find(item => item.kind === 'file' && item.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (file) { e.preventDefault(); void editor.openFile(file); }
    };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur); window.addEventListener('paste', paste);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); window.removeEventListener('paste', paste); };
  });

  return <div className="app-shell"
    onDragEnter={e => { if (Array.from(e.dataTransfer.types).includes('Files')) { e.preventDefault(); dragCount.current++; setDragging(true); } }}
    onDragOver={e => { if (Array.from(e.dataTransfer.types).includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = busy ? 'none' : 'copy'; } }}
    onDragLeave={e => { e.preventDefault(); dragCount.current = Math.max(0, dragCount.current - 1); if (!dragCount.current) setDragging(false); }}
    onDrop={e => { e.preventDefault(); dragCount.current = 0; setDragging(false); if (!busy && e.dataTransfer.files[0]) void editor.openFile(e.dataTransfer.files[0]); }}>
    <header className="app-header">
      <a className="brand" href="#" aria-label="Document Enhancer home" onClick={e => e.preventDefault()}><span>document<span className="brand-light">enhancer</span></span></a>
      <nav className="main-actions" aria-label="Document actions">
        <input ref={fileInput} className="sr-only" type="file" accept={ACCEPTED_TYPES} disabled={Boolean(busy)} aria-label="Open image file" onChange={e => { const file = e.target.files?.[0]; if (file) void editor.openFile(file); e.target.value = ''; }} />
        <button className="button" onClick={open} disabled={Boolean(busy)} title="Open an image (Ctrl+O)"><Icon name="folder" /><span>Open</span><kbd>{openShortcut}</kbd></button>
        <button className="button quiet" onClick={editor.reset} disabled={blocked} title="Reset all document adjustments"><Icon name="reset" /><span>Reset</span></button>
        <span className="header-divider" />
        <button className="button" onClick={() => setPrintOpen(true)} disabled={blocked} title="Print document (Ctrl+P)"><Icon name="print" /><span>Print</span></button>
        <button className="button primary" onClick={() => void exportImage()} disabled={blocked} title="Export full-resolution PNG (Ctrl+S)">{busy === 'export' ? <span className="spinner" /> : <Icon name="download" />}<span>{busy === 'export' ? 'Exporting…' : 'Export PNG'}</span></button>
      </nav>
    </header>
    {source?.sample && <div className="sample-banner"><span>Sample document</span><button onClick={open} disabled={Boolean(busy)}>Open your document <Icon name="arrow" size={15} /></button></div>}
    {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => setError(null)} aria-label="Dismiss error"><Icon name="close" size={16} /></button></div>}
    <main className="workspace">
      <Preview image={preview?.image || null} original={preview?.original || null} width={dimensions?.outputWidth || 1240} height={dimensions?.outputHeight || 1754} comparing={comparing} processing={processing || loading} onZoomChange={setZoom} onOpen={open} filename={source?.name} sample={source?.sample} />
      <Adjustments settings={state.settings} geometry={state.geometry} preset={state.preset} onAdjust={editor.adjust} onPreset={preset => void editor.applyPreset(preset)} onGeometry={editor.geometry} onReset={editor.reset} disabled={blocked} bins={preview?.histogram} />
    </main>
    <footer className="status-bar"><div><span className={`status-dot ${processing || loading || busy ? 'working' : ''}`} /><span role="status">{loading ? 'Opening document…' : busy === 'export' ? 'Exporting full resolution…' : busy === 'print' ? 'Preparing print…' : processing ? 'Processing…' : source ? 'Ready' : 'Open a document to begin'}</span><span className="status-divider" />{dimensions && <span>{dimensions.outputWidth.toLocaleString()} × {dimensions.outputHeight.toLocaleString()} px</span>}<span className="status-divider" /><span>{Math.round(zoom * 100)}%</span></div><div><button onClick={() => setHelpOpen(true)} className="help-button" aria-label="Help and keyboard shortcuts"><Icon name="help" size={16} /><span>Shortcuts & help</span></button></div></footer>
    {dragging && <div className="drop-overlay"><div><Icon name="upload" size={42}/><h2>Drop image to open</h2><p>Drop a JPEG, PNG, or WebP to open it.</p></div></div>}
    {toast && <div className="toast" role="status"><Icon name="check" size={17} />{toast}</div>}
    {printOpen && <PrintDialog settings={state.print} onChange={print => editor.dispatch({ type: 'print', print })} onClose={() => { if (!busy) setPrintOpen(false); }} onPrint={() => void print()} busy={busy === 'print'} />}
    {helpOpen && <Modal title="Keyboard shortcuts" onClose={() => setHelpOpen(false)}><dl className="shortcuts"><dt>Open a document</dt><dd><kbd>Ctrl / ⌘</kbd> + <kbd>O</kbd></dd><dt>Export PNG</dt><dd><kbd>Ctrl / ⌘</kbd> + <kbd>S</kbd></dd><dt>Print document</dt><dd><kbd>Ctrl / ⌘</kbd> + <kbd>P</kbd></dd><dt>Paste an image</dt><dd><kbd>Ctrl / ⌘</kbd> + <kbd>V</kbd></dd><dt>See original temporarily</dt><dd>Hold <kbd>Space</kbd></dd><dt>Move around the page</dt><dd>Click and drag</dd></dl><p className="help-copy">Open JPEG, PNG, or WebP files, up to 40 megapixels / 64 MB. Your source stays untouched. Reset restores neutral adjustments and the full page. Exports are lossless PNGs at full resolution.</p><p className="help-copy">Presets fill in ordinary controls. For faded text, try Preserve Details or lower the adaptive offset. Broad dark artwork can affect background estimation; disable uneven lighting removal when you want to preserve its original tones.</p><p className="help-copy">Only adjustment and print preferences are saved on this device. Your images stay in memory and are never uploaded or saved by the app.</p></Modal>}
  </div>;
}
