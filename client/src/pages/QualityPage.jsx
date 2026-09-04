import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

const SEVERITY_CHIP = { low: 'chip-neutral', medium: 'chip-warning', high: 'chip-danger', critical: 'chip-danger' };
const STATUS_CHIP = { open: 'chip-neutral', investigating: 'chip-accent', corrective_action: 'chip-accent', closed: 'chip-neutral' };

export function QualityPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [ncrs, setNcrs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);

  const SOURCE_LABEL = {
    customer_complaint: t('quality.customerComplaint'), internal_inspection: t('quality.internalInspection'),
    supplier_defect: t('quality.supplierDefect'), production_defect: t('quality.productionDefect'), other: t('quality.other'),
  };

  function load() {
    setLoading(true);
    const query = statusFilter ? `?status=${statusFilter}` : '';
    Promise.all([
      api.get(`/quality/ncrs${query}`),
      api.get('/quality/ncrs/summary'),
    ]).then(([n, s]) => { setNcrs(n); setSummary(s); }).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [statusFilter]);

  if (selected) {
    return <NCRDetail ncrId={selected} onBack={() => { setSelected(null); load(); }} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow mb-1">{t('quality.eyebrow')}</p>
          <p className="page-title">{t('quality.title')}</p>
          <p className="text-sm text-ink-muted mt-1">{t('quality.subtitle')}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>{t('quality.newNcr')}</button>
      </div>

      {summary && summary.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
          <div className="card p-3">
            <p className="eyebrow">{t('quality.open')}</p>
            <p className="font-display text-2xl font-bold text-ink mt-1">{summary.byStatus.open || 0}</p>
          </div>
          <div className="card p-3">
            <p className="eyebrow">{t('quality.critical')}</p>
            <p className="font-display text-2xl font-bold text-danger mt-1">{summary.bySeverity.critical || 0}</p>
          </div>
          <div className="card p-3">
            <p className="eyebrow">{t('quality.closed')}</p>
            <p className="font-display text-2xl font-bold text-ink mt-1">{summary.byStatus.closed || 0}</p>
          </div>
          <div className="card p-3">
            <p className="eyebrow">{t('quality.avgDaysToClose')}</p>
            <p className="font-display text-2xl font-bold text-ink mt-1">{summary.avgDaysToClose ?? '-'}</p>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-rule">
        {[['', t('quality.all')], ['open', t('quality.open')], ['investigating', t('quality.investigating')], ['corrective_action', t('quality.correctiveAction')], ['closed', t('quality.closed')]].map(([key, label]) => (
          <button key={key} onClick={() => setStatusFilter(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 transition-colors ${statusFilter === key ? 'border-accent text-accent-strong font-semibold' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading && <Loading />}
      {!loading && ncrs.length === 0 && (
        <EmptyState title={t('quality.noNcrs')} description={t('quality.noNcrsDescription')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('quality.logAnNcr')}</button>} />
      )}
      {!loading && ncrs.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-rule bg-surface-sunken/60">
                  <th className="px-5 py-3 eyebrow font-medium">{t('quality.ncrNumber')}</th>
                  <th className="px-5 py-3 eyebrow font-medium">{t('quality.titleColumn')}</th>
                  <th className="px-5 py-3 eyebrow font-medium">{t('quality.source')}</th>
                  <th className="px-5 py-3 eyebrow font-medium">{t('quality.severity')}</th>
                  <th className="px-5 py-3 eyebrow font-medium">{t('quality.status')}</th>
                  <th className="px-5 py-3 eyebrow font-medium">{t('quality.reported')}</th>
                  <th className="px-5 py-3 eyebrow font-medium text-center">{t('quality.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {ncrs.map((n) => (
                  <tr key={n._id} className="group align-top cursor-pointer hover:bg-accent-soft/30 transition-colors" onClick={() => setSelected(n._id)}>
                    <td className="px-5 py-4 num text-accent">{n.ncrNumber}</td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-ink group-hover:text-accent transition-colors">{n.title}</p>
                      <p className="text-ink-muted text-xs mt-0.5">{n.description}</p>
                    </td>
                    <td className="px-5 py-4 text-ink-muted">{SOURCE_LABEL[n.source] || n.source}</td>
                    <td className="px-5 py-4"><span className={SEVERITY_CHIP[n.severity]}>{n.severity}</span></td>
                    <td className="px-5 py-4"><span className={STATUS_CHIP[n.status]}>{n.status.replace('_', ' ')}</span></td>
                    <td className="px-5 py-4 text-ink-muted">{formatDate(n.createdAt)}</td>
                    <td className="px-5 py-4 text-center">
                      <button
                        className="btn-ghost !text-accent opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); setSelected(n._id); }}
                      >
                        {t('quality.openAction')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && <NCRForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function NCRForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ branchId: '', title: '', description: '', source: 'internal_inspection', severity: 'medium' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/quality/ncrs', form);
      toast(t('quality.ncrLogged'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg font-bold text-ink mb-4">{t('quality.logNonConformance')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('quality.branch')}</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">{t('quality.select')}</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('quality.titleColumn')}</label>
            <input required className="field-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="field-label">{t('quality.description')}</label>
            <textarea required rows={3} className="field-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="field-label">{t('quality.source')}</label>
            <select className="field-input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              <option value="customer_complaint">{t('quality.customerComplaint')}</option>
              <option value="internal_inspection">{t('quality.internalInspection')}</option>
              <option value="supplier_defect">{t('quality.supplierDefect')}</option>
              <option value="production_defect">{t('quality.productionDefect')}</option>
              <option value="other">{t('quality.other')}</option>
            </select>
          </div>
          <div>
            <label className="field-label">{t('quality.severity')}</label>
            <select className="field-input" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
              <option value="low">{t('quality.low')}</option>
              <option value="medium">{t('quality.medium')}</option>
              <option value="high">{t('quality.high')}</option>
              <option value="critical">{t('quality.critical')}</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('quality.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('quality.logging') : t('quality.logNcr')}</button>
        </div>
      </form>
    </div>
  );
}

function NCRDetail({ ncrId, onBack }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [ncr, setNcr] = useState(null);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rootCause, setRootCause] = useState('');
  const [showActionForm, setShowActionForm] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      api.get(`/quality/ncrs/${ncrId}`),
      api.get(`/quality/ncrs/${ncrId}/actions`),
    ]).then(([n, a]) => { setNcr(n); setRootCause(n.rootCause || ''); setActions(a); }).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [ncrId]);

  async function saveRootCause() {
    if (!rootCause.trim()) return;
    try {
      await api.post(`/quality/ncrs/${ncrId}/root-cause`, { rootCause });
      toast(t('quality.rootCauseSaved'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function advanceStatus(status) {
    try {
      await api.post(`/quality/ncrs/${ncrId}/status`, { status });
      toast(t('quality.statusUpdated'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  if (loading) return <Loading />;
  if (!ncr) return null;

  const nextStatus = { open: 'investigating', investigating: 'corrective_action', corrective_action: 'closed' }[ncr.status];
  const NEXT_STATUS_LABEL = { investigating: t('quality.investigating'), corrective_action: t('quality.correctiveAction'), closed: t('quality.closed') };

  return (
    <div className="flex flex-col gap-6">
      <button className="btn-ghost self-start" onClick={onBack}>{t('quality.backToNcrs')}</button>

      <div className="card overflow-hidden">
        <div className="bg-surface-sunken/60 px-5 py-4 border-b border-rule flex items-start justify-between">
          <div>
            <p className="eyebrow text-accent mb-1">{ncr.ncrNumber}</p>
            <p className="font-display text-xl font-bold text-ink">{ncr.title}</p>
            <p className="text-ink-muted text-sm mt-1">{ncr.description}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={SEVERITY_CHIP[ncr.severity]}>{ncr.severity}</span>
            <span className={STATUS_CHIP[ncr.status]}>{ncr.status.replace('_', ' ')}</span>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="field-label">{t('quality.rootCause')}</label>
            <textarea rows={2} className="field-input" placeholder={t('quality.rootCausePlaceholder')} value={rootCause} onChange={(e) => setRootCause(e.target.value)} />
            <button className="btn-secondary mt-2" onClick={saveRootCause} disabled={!rootCause.trim()}>{t('quality.saveRootCause')}</button>
          </div>

          {nextStatus && (
            <div className="border-t border-rule pt-4">
              <button className="btn-primary" onClick={() => advanceStatus(nextStatus)}>
                {nextStatus === 'closed' ? t('quality.closeNcr') : t('quality.moveTo', { status: NEXT_STATUS_LABEL[nextStatus] })}
              </button>
              {nextStatus === 'closed' && (
                <p className="text-xs text-ink-muted mt-2">{t('quality.closeNcrRequirement')}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-end justify-between mb-3">
          <p className="page-title !text-lg">{t('quality.correctivePreventiveActions')}</p>
          <button className="btn-secondary" onClick={() => setShowActionForm(true)}>{t('quality.addAction')}</button>
        </div>

        {actions.length === 0 && <EmptyState title={t('quality.noActionsYet')} description={t('quality.noActionsDescription')} />}
        {actions.length > 0 && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-rule bg-surface-sunken/60">
                    <th className="px-5 py-3 eyebrow font-medium">{t('quality.type')}</th>
                    <th className="px-5 py-3 eyebrow font-medium">{t('quality.description')}</th>
                    <th className="px-5 py-3 eyebrow font-medium">{t('quality.due')}</th>
                    <th className="px-5 py-3 eyebrow font-medium">{t('quality.status')}</th>
                    <th className="px-5 py-3 eyebrow font-medium text-right">{t('quality.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {actions.map((a) => <ActionRow key={a._id} action={a} onChanged={load} />)}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showActionForm && <ActionForm ncrId={ncrId} onClose={() => setShowActionForm(false)} onSaved={() => { setShowActionForm(false); load(); }} />}
    </div>
  );
}

function ActionRow({ action, onChanged }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [effectivenessNote, setEffectivenessNote] = useState('');
  const [editing, setEditing] = useState(false);

  async function advance(status, extra) {
    try {
      await api.post(`/quality/actions/${action._id}/status`, { status, ...extra });
      toast(t('quality.actionUpdated'), 'success');
      setEditing(false);
      onChanged();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <tr className="align-top">
      <td className="px-5 py-4 text-ink-muted">{action.actionType}</td>
      <td className="px-5 py-4 text-ink">{action.description}</td>
      <td className="px-5 py-4 text-ink-muted">{action.dueDate ? formatDate(action.dueDate) : '-'}</td>
      <td className="px-5 py-4"><span className="chip-neutral">{action.status.replace('_', ' ')}</span></td>
      <td className="px-5 py-4 text-right">
        {action.status === 'open' && !editing && (
          <button className="btn-ghost !text-accent" onClick={() => advance('in_progress')}>{t('quality.start')}</button>
        )}
        {action.status === 'in_progress' && !editing && (
          <button className="btn-ghost !text-accent" onClick={() => setEditing('complete')}>{t('quality.complete')}</button>
        )}
        {editing === 'complete' && (
          <div className="flex gap-1 justify-end items-center">
            <input className="field-input !py-1 !text-xs" placeholder={t('quality.completionNotePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn-ghost !text-accent" onClick={() => advance('completed', { note })} disabled={!note.trim()}>{t('quality.save')}</button>
          </div>
        )}
        {action.status === 'completed' && !editing && (
          <button className="btn-ghost !text-accent" onClick={() => setEditing('verify')}>{t('quality.verify')}</button>
        )}
        {editing === 'verify' && (
          <div className="flex gap-1 justify-end items-center">
            <input className="field-input !py-1 !text-xs" placeholder={t('quality.effectivenessNotePlaceholder')} value={effectivenessNote} onChange={(e) => setEffectivenessNote(e.target.value)} />
            <button className="btn-ghost !text-accent" onClick={() => advance('verified', { effectivenessNote })} disabled={!effectivenessNote.trim()}>{t('quality.save')}</button>
          </div>
        )}
        {action.status === 'verified' && <span className="chip-accent">{t('quality.verified')}</span>}
      </td>
    </tr>
  );
}

function ActionForm({ ncrId, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({ actionType: 'corrective', description: '', dueDate: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/quality/ncrs/${ncrId}/actions`, form);
      toast(t('quality.correctiveActionAdded'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg font-bold text-ink mb-4">{t('quality.addCorrectivePreventiveAction')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('quality.type')}</label>
            <select className="field-input" value={form.actionType} onChange={(e) => setForm({ ...form, actionType: e.target.value })}>
              <option value="corrective">{t('quality.corrective')}</option>
              <option value="preventive">{t('quality.preventive')}</option>
            </select>
          </div>
          <div>
            <label className="field-label">{t('quality.description')}</label>
            <textarea required rows={3} className="field-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="field-label">{t('quality.due')}</label>
            <input type="date" className="field-input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('quality.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('quality.saving') : t('quality.addAction')}</button>
        </div>
      </form>
    </div>
  );
}
