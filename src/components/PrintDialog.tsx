import { printLayout } from '../io/print';
import type { PrintSettings } from '../core/types';
import { Toggle } from './Controls';
import { Modal } from './Modal';
import { Icon } from './Icon';

export function PrintDialog({ settings, onChange, onClose, onPrint, busy }: { settings: PrintSettings; onChange: (settings: PrintSettings) => void; onClose: () => void; onPrint: () => void; busy: boolean }) {
  const layout = printLayout(settings);
  return <Modal title="Ready for paper." onClose={onClose}>
    <p className="modal-intro">Print your enhanced document at full resolution.</p>
    <div className="print-options">
      <label>Paper size<select disabled={busy} value={settings.paper} onChange={e => onChange({ ...settings, paper: e.target.value as PrintSettings['paper'] })}><option>A4</option><option>Letter</option></select></label>
      <label>Orientation<select disabled={busy} value={settings.orientation} onChange={e => onChange({ ...settings, orientation: e.target.value as PrintSettings['orientation'] })}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
    </div>
    <label className="margin-label">Margins <span><input disabled={busy} type="number" min="0" max="40" value={settings.margin} onChange={e => { const value = Number(e.target.value); if (Number.isFinite(value)) onChange({ ...settings, margin: Math.max(0, Math.min(40, value)) }); }} /> mm</span></label>
    <Toggle label="Fit document to one page" disabled={busy} checked={settings.fit} onChange={fit => onChange({ ...settings, fit })} hint="Scale to fit the printable area while preserving aspect ratio." />
    <div className="print-info"><Icon name="document" size={19}/><span>{layout.width} × {layout.height} mm · {settings.margin} mm margins<br/><small>{settings.fit ? 'Aspect ratio is preserved. Only the document is printed.' : 'Actual size at 96 dpi. Oversized images may extend beyond the page.'}</small></span></div>
    <p className="section-note">Match the paper size and orientation in your browser’s print dialog. Disable its headers and footers for a clean page.</p>
    <div className="modal-actions"><button className="button" onClick={onClose} disabled={busy}>Cancel</button><button className="button primary" onClick={onPrint} disabled={busy}>{busy ? <span className="spinner" /> : <Icon name="print" />}{busy ? 'Preparing document…' : 'Print document'}</button></div>
  </Modal>;
}
