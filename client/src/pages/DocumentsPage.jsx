import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';

// Documents module UI — attaches an arbitrary file (invoice, contract, ID
// scan, license, ...) to any entity in the app. There is no cloud storage
// configured here, so a selected file is read client-side (FileReader) into
// a base64 data-URI and sent inline as `fileData`, exactly the pattern
// ProductsPage already uses for product images, generalized to any file
// type instead of images only. A document can't be recompressed the way an
// image can, so files over the server's 10MB cap are rejected up front
// with a clear message rather than silently failing later.
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ENTITY_TYPES = ['PurchaseOrder', 'Employee', 'FixedAsset', 'Supplier', 'Company', 'Contract'];

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
  // data: URIs open fine directly in a new tab/window — no external fetch
  // involved, so there's no CSP concern the way there would be loading a
  // remote resource.
  window.open(version.fileData || version.fileUrl, '_blank', 'noopener,noreferrer');
}

export function DocumentsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [versioningFor, setVersioningFor] = useState(null);
  const [filterEntityType, setFilterEntityType] = useState('');

  function load() {
    setLoading(true);
    api.get(`/documents${filterEntityType ? `?entityType=${filterEntityType}` : ''}`)
      .then(setDocuments)
      .catch((err) => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }
  useEffect(load, [filterEntityType]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="flex justify-between items-end flex-wrap gap-4 mb-6">
        <div>
          <p className="page-title">{t('documents.title')}</p>
          <p className="text-sm text-ink-muted mt-1">{t('documents.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="field-input" value={filterEntityType} onChange={(e) => setFilterEntityType(e.target.value)}>
            <option value="">{t('documents.allTypes')}</option>
            {ENTITY_TYPES.map((et) => <option key={et} value={et}>{et}</option>)}
          </select>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <span className="material-symbols-outlined text-sm">upload</span>
            {t('documents.uploadDocument')}
          </button>
        </div>
      </div>

      {loading && <Loading />}
      {!loading && documents.length === 0 && (
        <EmptyState title={t('documents.emptyTitle')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('documents.uploadOne')}</button>} />
      )}

      {!loading && documents.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-rule flex justify-between items-center bg-surface-sunken/40">
            <p className="font-display text-lg font-semibold text-ink">{t('documents.documentRegister')}</p>
            <span className="eyebrow">{t('documents.documentCount', { count: documents.length })}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-rule bg-surface-sunken/60">
                  <th className="py-3 px-5 eyebrow font-medium">{t('documents.file')}</th>
                  <th className="py-3 px-5 eyebrow font-medium">{t('documents.category')}</th>
                  <th className="py-3 px-5 eyebrow font-medium">{t('documents.attachedTo')}</th>
                  <th className="py-3 px-5 eyebrow font-medium">{t('documents.version')}</th>
                  <th className="py-3 px-5 eyebrow font-medium">{t('documents.expiry')}</th>
                  <th className="py-3 px-5 eyebrow font-medium text-right">{t('documents.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {documents.map((doc) => {
                  const v = currentVersion(doc);
                  return (
                    <tr key={doc._id} className="hover:bg-accent-soft/30 transition-colors">
                      <td className="py-3 px-5">
                        <div className="font-medium text-ink">{v?.fileName}</div>
                        <div className="text-xs text-ink-muted">{v?.mimeType || ''} {v?.fileSizeBytes ? `· ${formatBytes(v.fileSizeBytes)}` : ''}</div>
                      </td>
                      <td className="py-3 px-5">{doc.category}</td>
                      <td className="py-3 px-5 text-ink-muted">{doc.entityType} <span className="text-xs">#{String(doc.entityId).slice(-6)}</span></td>
                      <td className="py-3 px-5">v{v?.versionNumber}</td>
                      <td className="py-3 px-5 text-ink-muted">{doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : '—'}</td>
                      <td className="py-3 px-5 text-right whitespace-nowrap">
                        <button className="btn-secondary text-xs px-3 py-1.5" onClick={() => openDocument(v)}>{t('documents.open')}</button>
                        <button className="btn-secondary text-xs px-3 py-1.5 ml-2" onClick={() => setVersioningFor(doc)}>{t('documents.newVersion')}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && <UploadForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {versioningFor && <UploadForm existingDoc={versioningFor} onClose={() => setVersioningFor(null)} onSaved={() => { setVersioningFor(null); load(); }} />}
    </div>
  );
}

function UploadForm({ existingDoc, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [entityType, setEntityType] = useState(existingDoc?.entityType || ENTITY_TYPES[0]);
  const [entityId, setEntityId] = useState(existingDoc?.entityId || '');
  const [category, setCategory] = useState(existingDoc?.category || '');
  const [expiryDate, setExpiryDate] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null); // { fileName, mimeType, fileSizeBytes, fileData }
  const [saving, setSaving] = useState(false);

  async function handleFileChange(e) {
    const selected = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!selected) return;
    if (selected.size > MAX_FILE_BYTES) {
      toast(t('documents.fileTooLarge', { name: selected.name, size: (selected.size / (1024 * 1024)).toFixed(1), limit: MAX_FILE_BYTES / (1024 * 1024) }), 'error');
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
    if (!file) { toast(t('documents.chooseFile'), 'error'); return; }
    setSaving(true);
    try {
      if (existingDoc) {
        await api.post(`/documents/${existingDoc._id}/versions`, { ...file, note });
        toast(t('documents.newVersionUploaded'), 'success');
      } else {
        if (!entityId.trim()) { toast(t('documents.entityIdRequired'), 'error'); setSaving(false); return; }
        await api.post('/documents', { entityType, entityId: entityId.trim(), category, expiryDate: expiryDate || null, note, ...file });
        toast(t('documents.documentUploaded'), 'success');
      }
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4 py-8 overflow-y-auto">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto">
        <p className="font-display text-lg mb-4">{existingDoc ? t('documents.newVersionFor', { category: existingDoc.category }) : t('documents.uploadADocument')}</p>
        <div className="space-y-3">
          {!existingDoc && (
            <>
              <div>
                <label className="field-label">{t('documents.attachedToType')}</label>
                <select className="field-input" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
                  {ENTITY_TYPES.map((et) => <option key={et} value={et}>{et}</option>)}
                </select>
              </div>
              <input required className="field-input" placeholder={t('documents.entityIdPlaceholder')} value={entityId} onChange={(e) => setEntityId(e.target.value)} />
              <input required className="field-input" placeholder={t('documents.categoryPlaceholder')} value={category} onChange={(e) => setCategory(e.target.value)} />
              <div>
                <label className="field-label">{t('documents.expiryDateOptional')}</label>
                <input type="date" className="field-input" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
              </div>
            </>
          )}
          <div>
            <label className="field-label">{t('documents.fileFieldLabel', { limit: MAX_FILE_BYTES / (1024 * 1024) })}</label>
            <input type="file" className="field-input" onChange={handleFileChange} />
            {file && (
              <p className="text-xs text-ink-muted mt-1">{file.fileName} · {formatBytes(file.fileSizeBytes)}</p>
            )}
          </div>
          <input className="field-input" placeholder={t('documents.noteOptional')} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('documents.cancel')}</button>
          <button type="submit" disabled={saving || !file} className="btn-primary">{saving ? t('documents.uploading') : t('documents.upload')}</button>
        </div>
      </form>
    </div>
  );
}
