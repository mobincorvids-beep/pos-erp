import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

const STATUS_CHIP = { open: 'chip-accent', closed: 'chip-danger' };

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
      <div className="flex items-center justify-between mb-4">
        <p className="page-title">Fiscal years &amp; periods</p>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowFyForm(true)}>New fiscal year</button>
          <button className="btn-primary" onClick={() => setShowPeriodForm(true)} disabled={fiscalYears.length === 0}>New period</button>
        </div>
      </div>
      <p className="text-sm text-ink-muted mb-5 max-w-2xl">Closing a period is a real accounting control — once closed, no voucher can be posted with a date inside it, anywhere in the system, until it's reopened.</p>

      {loading && <Loading />}
      {!loading && periods.length === 0 && (
        <EmptyState title="No accounting periods yet" description="Create a fiscal year first, then periods inside it, to start locking finalized months." action={fiscalYears.length === 0 ? <button className="btn-secondary" onClick={() => setShowFyForm(true)}>New fiscal year</button> : <button className="btn-primary" onClick={() => setShowPeriodForm(true)}>New period</button>} />
      )}
      {!loading && periods.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-3 py-2 font-medium">Period</th>
                <th className="px-3 py-2 font-medium">Fiscal year</th>
                <th className="px-3 py-2 font-medium">Dates</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p._id} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2 text-ink-muted">{p.fiscalYearId?.name || '—'}</td>
                  <td className="px-3 py-2 text-ink-muted">{formatDate(p.startDate)} – {formatDate(p.endDate)}</td>
                  <td className="px-3 py-2"><span className={STATUS_CHIP[p.status]}>{p.status}</span></td>
                  <td className="px-3 py-2 text-right">
                    {can('reports.financial') && (
                      p.status === 'open'
                        ? <button className="btn-ghost !text-danger" onClick={() => toggle(p._id, 'close')}>Close</button>
                        : <button className="btn-ghost !text-accent" onClick={() => toggle(p._id, 'reopen')}>Reopen</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
        <p className="font-display text-lg mb-4">New fiscal year</p>
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
        <p className="font-display text-lg mb-4">New period</p>
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
