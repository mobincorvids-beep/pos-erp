import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, ExternalLink, BarChart3, ChevronUp, ChevronDown } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';

const FIELD_TYPES = ['text', 'email', 'phone', 'textarea'];

function newPage(order) {
  return { order, headline: '', bodyContent: '', ctaText: 'Continue', ctaAction: 'next_step', externalUrl: '', appointmentConfig: { branchId: '', staffUserId: '', serviceName: '', durationMinutes: 30 } };
}

// The public landing page lives at /f/:slug — see client/src/App.jsx and
// client/src/public/FunnelLandingPage.jsx. This page only manages the
// authenticated staff side (create/edit/publish/analytics).
function publicUrl(slug) {
  return `${window.location.origin}/f/${slug}`;
}

export function FunnelsPage() {
  const { t } = useTranslation();
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
        <p className="eyebrow mb-1">{t('funnels.marketing')}</p>
        <div className="flex items-center justify-between">
          <p className="page-title">{t('funnels.funnels')}</p>
          <button className="btn-primary" onClick={() => setSelected('new')}>
            <Plus size={16} /> {t('funnels.newFunnel')}
          </button>
        </div>
        <p className="text-sm text-ink-muted mt-1">{t('funnels.subtitle')}</p>
      </div>

      {funnels === null ? (
        <Loading />
      ) : funnels.length === 0 ? (
        <EmptyState
          title={t('funnels.noFunnelsYet')}
          description={t('funnels.noFunnelsDescription')}
          action={<button className="btn-primary" onClick={() => setSelected('new')}>{t('funnels.createYourFirstFunnel')}</button>}
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
  const { t } = useTranslation();
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [stats, setStats] = useState(null);

  async function togglePublish() {
    try {
      await api.post(`/funnels/${funnel._id}/publish`, { publish: funnel.status !== 'published' });
      toast(funnel.status === 'published' ? t('funnels.funnelUnpublished') : t('funnels.funnelPublished'), 'success');
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
            {t('funnels.submissionsCount', { count: funnel.submitCount || 0 })}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {funnel.status === 'published' && (
            <a href={publicUrl(funnel.slug)} target="_blank" rel="noreferrer" className="text-xs text-accent font-semibold flex items-center gap-1 hover:text-accent-strong">
              <ExternalLink size={13} /> {t('funnels.preview')}
            </a>
          )}
          <button className="text-xs text-ink-muted font-semibold flex items-center gap-1 hover:text-ink" onClick={toggleAnalytics}>
            <BarChart3 size={13} /> {t('funnels.analytics')}
          </button>
          <button className="btn-secondary !px-2.5 !py-1.5 text-xs" onClick={togglePublish}>
            {funnel.status === 'published' ? t('funnels.unpublish') : t('funnels.publish')}
          </button>
        </div>
      </div>

      {showAnalytics && stats && (
        <div className="mt-3 pt-3 border-t border-rule grid grid-cols-3 gap-3">
          <div>
            <p className="eyebrow mb-1">{t('funnels.submissions')}</p>
            <p className="font-display font-bold num text-ink">{stats.totalSubmissions}</p>
          </div>
          <div>
            <p className="eyebrow mb-1">{t('funnels.convertedToLead')}</p>
            <p className="font-display font-bold num text-ink">{stats.convertedToLead}</p>
          </div>
          <div>
            <p className="eyebrow mb-1">{t('funnels.conversionRate')}</p>
            <p className="font-display font-bold num text-ink">{stats.conversionRate}%</p>
          </div>
        </div>
      )}
    </div>
  );
}

function FunnelEditor({ funnel, onClose, onSaved }) {
  const { t } = useTranslation();
  const CTA_ACTIONS = [
    { value: 'next_step', label: t('funnels.goToNextStep') },
    { value: 'submit_form', label: t('funnels.submitTheForm') },
    { value: 'external_url', label: t('funnels.linkOutToAUrl') },
    { value: 'book_appointment', label: t('funnels.bookAnAppointment') },
  ];
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
  const [pages, setPages] = useState(funnel?.pages?.length ? funnel.pages : []);
  const [branches, setBranches] = useState([]);
  const [staff, setStaff] = useState([]);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/users').then(setStaff).catch(() => {});
  }, []);

  function addPage() {
    setPages((ps) => [...ps, newPage(ps.length)]);
  }
  function updatePage(idx, patch) {
    setPages((ps) => ps.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }
  function updatePageAppointmentConfig(idx, patch) {
    setPages((ps) => ps.map((p, i) => (i === idx ? { ...p, appointmentConfig: { ...p.appointmentConfig, ...patch } } : p)));
  }
  function removePage(idx) {
    setPages((ps) => ps.filter((_, i) => i !== idx).map((p, i) => ({ ...p, order: i })));
  }
  function movePage(idx, dir) {
    setPages((ps) => {
      const next = ps.slice();
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= next.length) return ps;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next.map((p, i) => ({ ...p, order: i }));
    });
  }

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
      const payload = { name, headline, bodyContent, formFields, pages };
      if (isNew) {
        if (slug) payload.slug = slug;
        await api.post('/funnels', payload);
        toast(t('funnels.funnelCreated'), 'success');
      } else {
        await api.put(`/funnels/${funnel._id}`, { ...payload, slug });
        toast(t('funnels.funnelSaved'), 'success');
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
          <p className="eyebrow mb-1">{t('funnels.funnels')}</p>
          <p className="page-title">{isNew ? t('funnels.newFunnel') : t('funnels.editColon', { name: funnel.name })}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={onClose}>{t('funnels.cancel')}</button>
          <button className="btn-primary" onClick={save} disabled={saving || !name.trim()}>
            {saving ? t('funnels.savingEllipsis') : t('funnels.save')}
          </button>
        </div>
      </div>

      <div className="card p-5 grid gap-4">
        <div>
          <label className="field-label">{t('funnels.internalName')}</label>
          <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('funnels.internalNamePlaceholder')} />
        </div>

        {!isNew && (
          <div>
            <label className="field-label">{t('funnels.slugPublicUrl')}</label>
            <input className="field-input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={t('funnels.slugPlaceholder')} />
            {funnel && <p className="text-xs text-ink-muted mt-1 num">{publicUrl(funnel.slug)}</p>}
          </div>
        )}

        <div>
          <label className="field-label">{t('funnels.headline')} {pages.length > 0 && <span className="text-ink-muted font-normal">{t('funnels.unusedHasStepsBelow')}</span>}</label>
          <input className="field-input" value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder={t('funnels.headlinePlaceholder')} />
        </div>

        <div>
          <label className="field-label">{t('funnels.bodyContentPlainText')}</label>
          <textarea className="field-input" rows={5} value={bodyContent} onChange={(e) => setBodyContent(e.target.value)}
            placeholder={t('funnels.bodyContentPlaceholder')} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="field-label mb-0">{t('funnels.formFields')}</label>
            <button className="text-xs text-accent font-semibold flex items-center gap-1 hover:text-accent-strong" onClick={addField}><Plus size={13} /> {t('funnels.addField')}</button>
          </div>
          <div className="grid gap-2">
            {formFields.map((f, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-surface-sunken border border-rule rounded-lg p-2">
                <input className="field-input flex-1" placeholder={t('funnels.keyPlaceholder')} value={f.key}
                  onChange={(e) => updateField(idx, { key: e.target.value })} />
                <input className="field-input flex-1" placeholder={t('funnels.label')} value={f.label}
                  onChange={(e) => updateField(idx, { label: e.target.value })} />
                <select className="field-input" value={f.type} onChange={(e) => updateField(idx, { type: e.target.value })}>
                  {FIELD_TYPES.map((ft) => <option key={ft} value={ft}>{ft}</option>)}
                </select>
                <label className="text-xs text-ink-muted flex items-center gap-1 shrink-0">
                  <input type="checkbox" checked={!!f.required} onChange={(e) => updateField(idx, { required: e.target.checked })} />
                  {t('funnels.required')}
                </label>
                <button className="text-danger hover:opacity-70" onClick={() => removeField(idx)}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <label className="field-label mb-0">{t('funnels.stepsMultiPageFunnel')}</label>
              <p className="text-xs text-ink-muted mt-0.5">{t('funnels.stepsDescription')}</p>
            </div>
            <button className="text-xs text-accent font-semibold flex items-center gap-1 hover:text-accent-strong" onClick={addPage}><Plus size={13} /> {t('funnels.addStep')}</button>
          </div>
          <div className="grid gap-3">
            {pages.map((p, idx) => (
              <div key={idx} className="bg-surface-sunken border border-rule rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-ink-muted">{t('funnels.step', { number: idx + 1 })}</p>
                  <div className="flex items-center gap-1">
                    <button className="btn-ghost !px-1.5 !py-1" disabled={idx === 0} onClick={() => movePage(idx, -1)}><ChevronUp size={14} /></button>
                    <button className="btn-ghost !px-1.5 !py-1" disabled={idx === pages.length - 1} onClick={() => movePage(idx, 1)}><ChevronDown size={14} /></button>
                    <button className="text-danger hover:opacity-70 ml-1" onClick={() => removePage(idx)}><Trash2 size={15} /></button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <input className="field-input" placeholder={t('funnels.headline')} value={p.headline} onChange={(e) => updatePage(idx, { headline: e.target.value })} />
                  <textarea className="field-input" rows={2} placeholder={t('funnels.bodyContent')} value={p.bodyContent} onChange={(e) => updatePage(idx, { bodyContent: e.target.value })} />
                  <div className="flex gap-2">
                    <input className="field-input flex-1" placeholder={t('funnels.ctaButtonText')} value={p.ctaText} onChange={(e) => updatePage(idx, { ctaText: e.target.value })} />
                    <select className="field-input flex-1" value={p.ctaAction} onChange={(e) => updatePage(idx, { ctaAction: e.target.value })}>
                      {CTA_ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  </div>

                  {p.ctaAction === 'external_url' && (
                    <input className="field-input" placeholder="https://…" value={p.externalUrl} onChange={(e) => updatePage(idx, { externalUrl: e.target.value })} />
                  )}

                  {p.ctaAction === 'book_appointment' && (
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-rule">
                      <select className="field-input" value={p.appointmentConfig?.branchId || ''} onChange={(e) => updatePageAppointmentConfig(idx, { branchId: e.target.value })}>
                        <option value="">{t('funnels.branchEllipsis')}</option>
                        {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                      </select>
                      <select className="field-input" value={p.appointmentConfig?.staffUserId || ''} onChange={(e) => updatePageAppointmentConfig(idx, { staffUserId: e.target.value })}>
                        <option value="">{t('funnels.staffMemberEllipsis')}</option>
                        {staff.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
                      </select>
                      <input className="field-input" placeholder={t('funnels.serviceNamePlaceholder')} value={p.appointmentConfig?.serviceName || ''} onChange={(e) => updatePageAppointmentConfig(idx, { serviceName: e.target.value })} />
                      <input type="number" min="5" step="5" className="field-input" placeholder={t('funnels.durationMinutesPlaceholder')} value={p.appointmentConfig?.durationMinutes || 30} onChange={(e) => updatePageAppointmentConfig(idx, { durationMinutes: Number(e.target.value) })} />
                    </div>
                  )}
                </div>
              </div>
            ))}
            {pages.length === 0 && <p className="text-xs text-ink-muted">{t('funnels.noStepsYet')}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
