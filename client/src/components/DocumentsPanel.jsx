import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from './Toast';
import { Loading } from './Loading';

// Reusable "documents attached to one entity" panel — same upload/list
// pattern DocumentsPage.jsx already established (inline base64 fileData,
// no cloud storage), factored out so any entity's detail view (Employee
// here; a FixedAsset or Supplier detail view could reuse it too) gets the
// same upload/list/download/delete behavior without re-implementing it.
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function formatBytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function currentVersion(doc) {
  return doc.versions?.[doc.versions.length - 1];
}

function readFileAsDataUri(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
}

function openDocument(version) {
  if (!version) return;
  window.open(version.fileData || version.fileUrl, '_blank', 'noopener,noreferrer');
}

export function DocumentsPanel({ entityType, entityId, canManage = true }) {
  const toast = useToast();
  const [documents, setDocuments] = useState(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    api.get(`/documents?entityType=${entityType}&entityId=${entityId}`)
      .then(setDocuments)
      .catch((err) => toast(err.message, 'error'));
  }
  useEffect(load, [entityType, entityId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove(doc) {
    if (!window.confirm(`Delete "${currentVersion(doc)?.fileName}"? This can't be undone.`)) return;
    try {
      await api.del(`/documents/${doc._id}`);
      toast('Document deleted.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  if (documents === null) return <Loading />;

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm text-ink-muted">{documents.length} document{documents.length === 1 ? '' : 's'}</p>
        {canManage && (
          <button className="btn-secondary text-xs px-3 py-1.5" onClick={() => setShowForm(true)}>
            <span className="material-symbols-outlined text-sm align-middle mr-1">upload</span>
            Upload
          </button>
        )}
      </div>

      {documents.length === 0 && <p className="text-sm text-ink-muted">No documents attached yet.</p>}

      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((doc) => {
            const v = currentVersion(doc);
            return (
              <div key={doc._id} className="flex items-center justify-between border border-line-muted rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{v?.fileName}</p>
                  <p className="text-xs text-ink-muted">{doc.category} · v{v?.versionNumber}{v?.fileSizeBytes ? ` · ${formatBytes(v.fileSizeBytes)}` : ''}{doc.expiryDate ? ` · expires ${new Date(doc.expiryDate).toLocaleDateString()}` : ''}</p>
                </div>
                <div className="flex gap-2 shrink-0 ml-3">
                  <button className="btn-ghost !text-accent !px-0 text-xs" onClick={() => openDocument(v)}>Open</button>
                  {canManage && <button className="btn-ghost !text-danger !px-0 text-xs" onClick={() => remove(doc)}>Delete</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <UploadDocumentForm
          entityType={entityType}
          entityId={entityId}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function UploadDocumentForm({ entityType, entityId, onClose, onSaved }) {
  const toast = useToast();
  const [category, setCategory] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleFileChange(e) {
    const selected = e.target.files?.[0];
    e.target.value = '';
    if (!selected) return;
    if (selected.size > MAX_FILE_BYTES) {
      toast(`"${selected.name}" is ${(selected.size / (1024 * 1024)).toFixed(1)}MB — the limit is ${MAX_FILE_BYTES / (1024 * 1024)}MB per document.`, 'error');
      return;
    }
    try {
      const fileData = await readFileAsDataUri(selected);
      setFile({ fileName: selected.name, mimeType: selected.type || 'application/octet-stream', fileSizeBytes: selected.size, fileData });
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) { toast('Choose a file to upload.', 'error'); return; }
    setSaving(true);
    try {
      await api.post('/documents', { entityType, entityId, category, expiryDate: expiryDate || null, note, ...file });
      toast('Document uploaded.', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-50 px-4 py-8 overflow-y-auto">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto">
        <p className="font-display text-lg mb-4">Upload a document</p>
        <div className="space-y-3">
          <input required className="field-input" placeholder="Category (ID Copy, Contract, Certificate...)" value={category} onChange={(e) => setCategory(e.target.value)} />
          <div>
            <label className="field-label">Expiry date (optional)</label>
            <input type="date" className="field-input" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>
          <div>
            <label className="field-label">File (any type, up to {MAX_FILE_BYTES / (1024 * 1024)}MB)</label>
            <input type="file" className="field-input" onChange={handleFileChange} />
            {file && <p className="text-xs text-ink-muted mt-1">{file.fileName} · {formatBytes(file.fileSizeBytes)}</p>}
          </div>
          <input className="field-input" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving || !file} className="btn-primary">{saving ? 'Uploading…' : 'Upload'}</button>
        </div>
      </form>
    </div>
  );
}
