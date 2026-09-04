import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

const STATUS_CHIP = { open: 'chip-accent', closed: 'chip-danger' };

function StatusChip({ status }) {
  const cls = STATUS_CHIP[status] || 'chip-neutral';
  return (
    <span className={`${cls} gap-1.5 capitalize`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {status}
    </span>
  );
}

export function PeriodsPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const toast = useToast();
  const [fiscalYears, setFiscalYears] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFyForm, setShowFyForm] = useState(false);
  const [showPeriodForm, setShowPeriodForm] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([api.get('/accounting-periods/fiscal-years'), api.get('/accounting-periods/periods')])
      .then(([fy, p]) => { setFiscalYears(fy); setPeriods(p); })
      .catch((err) => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function toggle(id, action) {
    try {
      await api.post(`/accounting-periods/periods/${id}/${action}`, {});
      toast(action === 'close' ? t('periods.periodClosed') : t('periods.periodReopened'), 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div>
      <div className="flex justify-between items-end flex-wrap gap-4 mb-6">
        <div>
          <p className="page-title">{t('periods.title')}</p>
          <p className="text-sm text-ink-muted mt-1 max-w-2xl">{t('periods.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowFyForm(true)}>{t('periods.newFiscalYear')}</button>
          <button className="btn-primary" onClick={() => setShowPeriodForm(true)} disabled={fiscalYears.length === 0}>
            <span className="material-symbols-outlined text-sm">add</span>
            {t('periods.newPeriod')}
          </button>
        </div>
      </div>

      {loading && <Loading />}
      {!loading && periods.length === 0 && (
        <EmptyState title={t('periods.noPeriodsYet')} description={t('periods.noPeriodsDescription')} action={fiscalYears.length === 0 ? <button className="btn-secondary" onClick={() => setShowFyForm(true)}>{t('periods.newFiscalYear')}</button> : <button className="btn-primary" onClick={() => setShowPeriodForm(true)}>{t('periods.newPeriod')}</button>} />
      )}
      {!loading && periods.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-rule flex justify-between items-center bg-surface-sunken/40">
            <p className="font-display text-lg font-semibold text-ink">{t('periods.periods')}</p>
            <span className="eyebrow">{t('periods.periodsCount', { count: periods.length })}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead>
                <tr className="border-b border-rule bg-surface-sunken/60">
                  <th className="py-3 px-5 eyebrow font-medium">{t('periods.period')}</th>
                  <th className="py-3 px-5 eyebrow font-medium">{t('periods.fiscalYear')}</th>
                  <th className="py-3 px-5 eyebrow font-medium">{t('periods.dates')}</th>
                  <th className="py-3 px-5 eyebrow font-medium">{t('periods.status')}</th>
                  <th className="py-3 px-5 eyebrow font-medium text-right">{t('periods.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {periods.map((p) => (
                  <tr key={p._id} className="hover:bg-accent-soft/30 transition-colors">
                    <td className="py-3 px-5 text-sm font-semibold text-ink">{p.name}</td>
                    <td className="py-3 px-5 text-sm text-ink-muted">{p.fiscalYearId?.name || '-'}</td>
                    <td className="py-3 px-5 text-sm text-ink-muted num">{formatDate(p.startDate)} – {formatDate(p.endDate)}</td>
                    <td className="py-3 px-5"><StatusChip status={p.status} /></td>
                    <td className="py-3 px-5 text-right">
                      {can('reports.financial') && (
                        p.status === 'open'
                          ? <button className="btn-ghost !text-danger !px-0 text-xs" onClick={() => toggle(p._id, 'close')}>{t('periods.close')}</button>
                          : <button className="btn-ghost !text-accent !px-0 text-xs" onClick={() => toggle(p._id, 'reopen')}>{t('periods.reopen')}</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showFyForm && <FiscalYearForm onClose={() => setShowFyForm(false)} onSaved={() => { setShowFyForm(false); load(); }} />}
      {showPeriodForm && <PeriodForm fiscalYears={fiscalYears} onClose={() => setShowPeriodForm(false)} onSaved={() => { setShowPeriodForm(false); load(); }} />}
    </div>
  );
}

function FiscalYearForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/accounting-periods/fiscal-years', form);
      toast(t('periods.fiscalYearCreated'), 'success');
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
        <p className="font-display text-lg font-semibold text-accent mb-4">{t('periods.newFiscalYear')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('periods.name')}</label>
            <input required placeholder={t('periods.fiscalYearNamePlaceholder')} className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">{t('periods.startDate')}</label>
              <input type="date" required className="field-input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="field-label">{t('periods.endDate')}</label>
              <input type="date" required className="field-input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('periods.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('periods.creating') : t('periods.create')}</button>
        </div>
      </form>
    </div>
  );
}

function PeriodForm({ fiscalYears, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({ fiscalYearId: '', name: '', startDate: '', endDate: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/accounting-periods/periods', form);
      toast(t('periods.periodCreated'), 'success');
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
        <p className="font-display text-lg font-semibold text-accent mb-4">{t('periods.newPeriod')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('periods.fiscalYear')}</label>
            <select required className="field-input" value={form.fiscalYearId} onChange={(e) => setForm({ ...form, fiscalYearId: e.target.value })}>
              <option value="">{t('periods.selectEllipsis')}</option>
              {fiscalYears.map((fy) => <option key={fy._id} value={fy._id}>{fy.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('periods.name')}</label>
            <input required placeholder={t('periods.periodNamePlaceholder')} className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">{t('periods.startDate')}</label>
              <input type="date" required className="field-input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="field-label">{t('periods.endDate')}</label>
              <input type="date" required className="field-input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('periods.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('periods.creating') : t('periods.create')}</button>
        </div>
      </form>
    </div>
  );
}
