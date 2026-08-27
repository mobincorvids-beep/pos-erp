import { useEffect, useState } from 'react';
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
      toast(`Period ${action === 'close' ? 'closed' : 'reopened'}.`, 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div>
      <div className="flex justify-between items-end flex-wrap gap-4 mb-6">
        <div>
          <p className="page-title">Fiscal Years &amp; Periods</p>
          <p className="text-sm text-ink-muted mt-1 max-w-2xl">Closing a period is a real accounting control — once closed, no voucher can be posted with a date inside it, anywhere in the system, until it's reopened.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowFyForm(true)}>New fiscal year</button>
          <button className="btn-primary" onClick={() => setShowPeriodForm(true)} disabled={fiscalYears.length === 0}>
            <span className="material-symbols-outlined text-sm">add</span>
            New period
          </button>
        </div>
      </div>

      {loading && <Loading />}
      {!loading && periods.length === 0 && (
        <EmptyState title="No accounting periods yet" description="Create a fiscal year first, then periods inside it, to start locking finalized months." action={fiscalYears.length === 0 ? <button className="btn-secondary" onClick={() => setShowFyForm(true)}>New fiscal year</button> : <button className="btn-primary" onClick={() => setShowPeriodForm(true)}>New period</button>} />
      )}
      {!loading && periods.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-rule flex justify-between items-center bg-surface-sunken/40">
            <p className="font-display text-lg font-semibold text-ink">Periods</p>
            <span className="eyebrow">{periods.length} periods</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead>
                <tr className="border-b border-rule bg-surface-sunken/60">
                  <th className="py-3 px-5 eyebrow font-medium">Period</th>
                  <th className="py-3 px-5 eyebrow font-medium">Fiscal Year</th>
                  <th className="py-3 px-5 eyebrow font-medium">Dates</th>
                  <th className="py-3 px-5 eyebrow font-medium">Status</th>
                  <th className="py-3 px-5 eyebrow font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {periods.map((p) => (
                  <tr key={p._id} className="hover:bg-accent-soft/30 transition-colors">
                    <td className="py-3 px-5 text-sm font-semibold text-ink">{p.name}</td>
                    <td className="py-3 px-5 text-sm text-ink-muted">{p.fiscalYearId?.name || '—'}</td>
                    <td className="py-3 px-5 text-sm text-ink-muted num">{formatDate(p.startDate)} – {formatDate(p.endDate)}</td>
                    <td className="py-3 px-5"><StatusChip status={p.status} /></td>
                    <td className="py-3 px-5 text-right">
                      {can('reports.financial') && (
                        p.status === 'open'
                          ? <button className="btn-ghost !text-danger !px-0 text-xs" onClick={() => toggle(p._id, 'close')}>Close</button>
                          : <button className="btn-ghost !text-accent !px-0 text-xs" onClick={() => toggle(p._id, 'reopen')}>Reopen</button>
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
  const toast = useToast();
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/accounting-periods/fiscal-years', form);
      toast('Fiscal year created.', 'success');
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
        <p className="font-display text-lg font-semibold text-accent mb-4">New fiscal year</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Name</label>
            <input required placeholder="FY2026" className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">Start date</label>
              <input type="date" required className="field-input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="field-label">End date</label>
              <input type="date" required className="field-input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
}

function PeriodForm({ fiscalYears, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ fiscalYearId: '', name: '', startDate: '', endDate: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/accounting-periods/periods', form);
      toast('Period created.', 'success');
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
        <p className="font-display text-lg font-semibold text-accent mb-4">New period</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Fiscal year</label>
            <select required className="field-input" value={form.fiscalYearId} onChange={(e) => setForm({ ...form, fiscalYearId: e.target.value })}>
              <option value="">Select…</option>
              {fiscalYears.map((fy) => <option key={fy._id} value={fy._id}>{fy.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Name</label>
            <input required placeholder="January 2026" className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">Start date</label>
              <input type="date" required className="field-input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="field-label">End date</label>
              <input type="date" required className="field-input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create'}</button>
        </div>
      </form>
    </div>
  );
}
