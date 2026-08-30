import { useEffect, useState } from 'react';
import { Plus, Trash2, ExternalLink, BarChart3 } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';

const FIELD_TYPES = ['text', 'email', 'phone', 'textarea'];

// The public landing page lives at /f/:slug — see client/src/App.jsx and
// client/src/public/FunnelLandingPage.jsx. This page only manages the
// authenticated staff side (create/edit/publish/analytics).
function publicUrl(slug) {
  return `${window.location.origin}/f/${slug}`;
}

export function FunnelsPage() {
  const [funnels, setFunnels] = useState(null);
  const [selected, setSelected] = useState(null); // funnel being edited, or 'new'
  const toast = useToast();

  async function load() {
    try {
      setFunnels(await api.get('/funnels'));
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  useEffect(() => { load(); }, []);

  if (selected) {
    return (
      <FunnelEditor
        funnel={selected === 'new' ? null : selected}
        onClose={() => setSelected(null)}
        onSaved={() => { setSelected(null); load(); }}
      />
    );
  }

  return (
    <div>
      <div className="mb-4">
        <p className="eyebrow mb-1">Marketing</p>
        <div className="flex items-center justify-between">
          <p className="page-title">Funnels</p>
          <button className="btn-primary" onClick={() => setSelected('new')}>
            <Plus size={16} /> New funnel
          </button>
        </div>
        <p className="text-sm text-ink-muted mt-1">Lead-capture landing pages (headline, body text, and a short form) published at a public URL.</p>
      </div>

      {funnels === null ? (
        <Loading />
      ) : funnels.length === 0 ? (
        <EmptyState
          title="No funnels yet"
          description="Create a simple lead-capture landing page (headline, body text, and a short form) that anyone can submit without logging in."
          action={<button className="btn-primary" onClick={() => setSelected('new')}>Create your first funnel</button>}
        />
      ) : (
        <div className="grid gap-3">
          {funnels.map((f) => (
            <FunnelRow key={f._id} funnel={f} onEdit={() => setSelected(f)} onChanged={load} toast={toast} />
          ))}
        </div>
      )}
    </div>
  );
}

function FunnelRow({ funnel, onEdit, onChanged, toast }) {
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [stats, setStats] = useState(null);

  async function togglePublish() {
    try {
      await api.post(`/funnels/${funnel._id}/publish`, { publish: funnel.status !== 'published' });
      toast(funnel.status === 'published' ? 'Funnel unpublished.' : 'Funnel published.', 'success');
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function toggleAnalytics() {
    if (!showAnalytics && !stats) {
      try {
        setStats(await api.get(`/funnels/${funnel._id}/analytics`));
      } catch (err) {
        toast(err.message, 'error');
        return;
      }
    }
    setShowAnalytics((s) => !s);
  }

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <button className="font-display font-bold text-ink hover:text-accent transition-colors" onClick={onEdit}>{funnel.name}</button>
          <p className="text-xs text-ink-muted mt-1 flex items-center gap-2">
            <span className={funnel.status === 'published' ? 'chip-accent' : 'chip-neutral'}>{funnel.status}</span>
            {funnel.submitCount || 0} submission{funnel.submitCount === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {funnel.status === 'published' && (
            <a href={publicUrl(funnel.slug)} target="_blank" rel="noreferrer" className="text-xs text-accent font-semibold flex items-center gap-1 hover:text-accent-strong">
              <ExternalLink size={13} /> Preview
            </a>
          )}
          <button className="text-xs text-ink-muted font-semibold flex items-center gap-1 hover:text-ink" onClick={toggleAnalytics}>
            <BarChart3 size={13} /> Analytics
          </button>
          <button className="btn-secondary !px-2.5 !py-1.5 text-xs" onClick={togglePublish}>
            {funnel.status === 'published' ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>

      {showAnalytics && stats && (
        <div className="mt-3 pt-3 border-t border-rule grid grid-cols-3 gap-3">
          <div>
            <p className="eyebrow mb-1">Submissions</p>
            <p className="font-display font-bold num text-ink">{stats.totalSubmissions}</p>
          </div>
          <div>
            <p className="eyebrow mb-1">Converted to lead</p>
            <p className="font-display font-bold num text-ink">{stats.convertedToLead}</p>
          </div>
          <div>
            <p className="eyebrow mb-1">Conversion rate</p>
            <p className="font-display font-bold num text-ink">{stats.conversionRate}%</p>
          </div>
        </div>
      )}
    </div>
  );
}

function FunnelEditor({ funnel, onClose, onSaved }) {
  const isNew = !funnel;
  const [name, setName] = useState(funnel?.name || '');
  const [slug, setSlug] = useState(funnel?.slug || '');
  const [headline, setHeadline] = useState(funnel?.headline || '');
  const [bodyContent, setBodyContent] = useState(funnel?.bodyContent || '');
  const [formFields, setFormFields] = useState(
    funnel?.formFields?.length ? funnel.formFields : [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
    ]
  );
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  function updateField(idx, patch) {
    setFormFields((fields) => fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }
  function addField() {
    setFormFields((fields) => [...fields, { key: '', label: '', type: 'text', required: false }]);
  }
  function removeField(idx) {
    setFormFields((fields) => fields.filter((_, i) => i !== idx));
  }

  async function save() {
    setSaving(true);
    try {
      const payload = { name, headline, bodyContent, formFields };
      if (isNew) {
        if (slug) payload.slug = slug;
        await api.post('/funnels', payload);
        toast('Funnel created.', 'success');
      } else {
        await api.put(`/funnels/${funnel._id}`, { ...payload, slug });
        toast('Funnel saved.', 'success');
      }
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="eyebrow mb-1">Funnels</p>
          <p className="page-title">{isNew ? 'New funnel' : `Edit: ${funnel.name}`}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="card p-5 grid gap-4">
        <div>
          <label className="field-label">Internal name</label>
          <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer Sale Landing Page" />
        </div>

        {!isNew && (
          <div>
            <label className="field-label">Slug (public URL)</label>
            <input className="field-input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="summer-sale" />
            {funnel && <p className="text-xs text-ink-muted mt-1 num">{publicUrl(funnel.slug)}</p>}
          </div>
        )}

        <div>
          <label className="field-label">Headline</label>
          <input className="field-input" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Get 20% off your first order" />
        </div>

        <div>
          <label className="field-label">Body content (plain text)</label>
          <textarea className="field-input" rows={5} value={bodyContent} onChange={(e) => setBodyContent(e.target.value)}
            placeholder="Tell visitors what they're signing up for. Plain text or simple markdown, this is a lead-capture page, not a drag-and-drop builder." />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="field-label mb-0">Form fields</label>
            <button className="text-xs text-accent font-semibold flex items-center gap-1 hover:text-accent-strong" onClick={addField}><Plus size={13} /> Add field</button>
          </div>
          <div className="grid gap-2">
            {formFields.map((f, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-surface-sunken border border-rule rounded-lg p-2">
                <input className="field-input flex-1" placeholder="key (e.g. email)" value={f.key}
                  onChange={(e) => updateField(idx, { key: e.target.value })} />
                <input className="field-input flex-1" placeholder="Label" value={f.label}
                  onChange={(e) => updateField(idx, { label: e.target.value })} />
                <select className="field-input" value={f.type} onChange={(e) => updateField(idx, { type: e.target.value })}>
                  {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <label className="text-xs text-ink-muted flex items-center gap-1 shrink-0">
                  <input type="checkbox" checked={!!f.required} onChange={(e) => updateField(idx, { required: e.target.checked })} />
                  Required
                </label>
                <button className="text-danger hover:opacity-70" onClick={() => removeField(idx)}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
