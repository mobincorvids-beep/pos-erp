import { useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';

/**
 * Generic "upload a CSV, see a created/updated/failed summary" modal.
 * Reused for product import — `endpoint` is the multipart POST target,
 * `templateHeaders` builds a downloadable sample CSV so users don't have
 * to guess the expected columns.
 */
export function ImportCsvModal({ endpoint, title, templateHeaders, templateFilename, onClose, onImported }) {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState(null);

  function downloadTemplate() {
    const sampleRow = templateHeaders.map((h) => {
      if (h === 'name') return 'Lays Chips 40g';
      if (h === 'sku') return 'SNK-001';
      if (h === 'barcode') return '8964000123456';
      if (h === 'category') return 'Snacks & Confectionery';
      if (h === 'subcategory') return 'Chips & Crisps';
      if (h === 'unit') return 'Piece';
      if (h === 'costPrice') return '60';
      if (h === 'sellingPrice') return '80';
      if (h === 'openingStock') return '100';
      if (h === 'minStock') return '10';
      if (h === 'reorderLevel') return '20';
      return '';
    });
    const csv = `${templateHeaders.join(',')}\n${sampleRow.join(',')}\n`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = templateFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setSummary(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await api.upload(endpoint, formData);
      setSummary(result);
      if (result.failed === 0) {
        toast(`Imported: ${result.created} created, ${result.updated} updated.`, 'success');
      } else {
        toast(`Imported with ${result.failed} row error(s) — see details below.`, 'error');
      }
      onImported?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <p className="font-display text-lg font-semibold text-ink mb-1">{title}</p>
        <p className="text-xs text-ink-muted mb-4">
          Columns: {templateHeaders.join(', ')}. Rows with problems are reported below — the rest still import.
        </p>

        <button type="button" className="btn-ghost !text-xs mb-3" onClick={downloadTemplate}>
          <span className="font-icon text-[16px] leading-none">download</span>
          Download sample CSV
        </button>

        <div className="border border-dashed border-rule-strong rounded-lg p-4 text-center mb-4">
          <input
            type="file" accept=".csv,text/csv"
            onChange={(e) => { setFile(e.target.files?.[0] || null); setSummary(null); }}
            className="text-sm"
          />
          {file && <p className="text-xs text-ink-muted mt-2">{file.name}</p>}
        </div>

        {summary && (
          <div className="mb-4">
            <div className="flex gap-2 mb-2">
              <span className="chip-accent">Created {summary.created}</span>
              <span className="chip-neutral">Updated {summary.updated}</span>
              {summary.failed > 0 && <span className="chip-danger">Failed {summary.failed}</span>}
            </div>
            {summary.errors?.length > 0 && (
              <div className="max-h-40 overflow-y-auto border border-rule rounded-lg">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surface-sunken text-left">
                      <th className="px-3 py-1.5 font-semibold text-ink-muted">Row</th>
                      <th className="px-3 py-1.5 font-semibold text-ink-muted">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.errors.map((e, i) => (
                      <tr key={i} className="border-t border-rule">
                        <td className="px-3 py-1.5 num">{e.row}</td>
                        <td className="px-3 py-1.5 text-danger">{e.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>{summary ? 'Close' : 'Cancel'}</button>
          <button type="button" className="btn-primary" disabled={!file || uploading} onClick={handleUpload}>
            {uploading ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
