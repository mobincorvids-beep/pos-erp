import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function CostCentersPage() {
  const toast = useToast();
  const [costCenters, setCostCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewing, setViewing] = useState(null);

  function load() {
    setLoading(true);
    api.get('/cost-centers').then(setCostCenters).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-between items-end flex-wrap gap-4 mb-6">
        <div>
          <p className="page-title">Cost Centers</p>
          <p className="text-sm text-ink-muted mt-1 max-w-2xl">Tag any voucher entry with a cost center — a department, a project, an arbitrary internal grouping — to see a real profit &amp; loss scoped to just that entry, even when it shares a voucher with untagged or differently-tagged money.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="material-symbols-outlined text-sm">add</span>
          New cost center
        </button>
      </div>

      {loading && <Loading />}
      {!loading && costCenters.length === 0 && (
        <EmptyState title="No cost centers yet" description="Create one, then tag it on voucher entries wherever your accounting flow supports it." action={<button className="btn-primary" onClick={() => setShowForm(true)}>New cost center</button>} />
      )}
      {!loading && costCenters.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-rule flex justify-between items-center bg-surface-sunken/40">
            <p className="font-display text-lg font-semibold text-ink">Cost Centers</p>
            <span className="eyebrow">{costCenters.length} centers</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[480px]">
              <thead>
                <tr className="border-b border-rule bg-surface-sunken/60">
                  <th className="py-3 px-5 eyebrow font-medium">Name</th>
                  <th className="py-3 px-5 eyebrow font-medium">Code</th>
                  <th className="py-3 px-5 eyebrow font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {costCenters.map((c) => (
                  <tr key={c._id} className="hover:bg-accent-soft/30 transition-colors">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-surface-sunken flex items-center justify-center text-ink-muted shrink-0">
                          <span className="material-symbols-outlined">account_tree</span>
                        </div>
                        <p className="text-sm font-semibold text-ink">{c.name}</p>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-sm text-ink-muted num">{c.code || '—'}</td>
                    <td className="py-3 px-5 text-right">
                      <button className="btn-ghost !text-accent !px-0 text-xs" onClick={() => setViewing(c)}>View P&amp;L</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && <CostCenterForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {viewing && <CostCenterPnl costCenter={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function CostCenterForm({ onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', code: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/cost-centers', form);
      toast('Cost center created.', 'success');
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
        <p className="font-display text-lg font-semibold text-accent mb-4">New cost center</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Name</label>
            <input required className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Code (optional)</label>
            <input className="field-input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
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

function CostCenterPnl({ costCenter, onClose }) {
  const { company } = useAuth();
  const toast = useToast();
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.get(`/cost-centers/${costCenter._id}/profit-and-loss?from=${from}&to=${to}`).then(setReport).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [from, to]);

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-lg font-semibold text-accent">{costCenter.name} — P&amp;L</p>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
        <div className="flex gap-2 mb-4">
          <input type="date" className="field-input" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" className="field-input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>

        {loading && <Loading />}
        {!loading && report && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="card p-3">
                <p className="eyebrow">Income</p>
                <p className="font-display text-lg font-semibold mt-1 num text-ink">{formatMoney(report.totalIncome, company?.currency)}</p>
              </div>
              <div className="card p-3">
                <p className="eyebrow">Expenses</p>
                <p className="font-display text-lg font-semibold mt-1 num text-ink">{formatMoney(report.totalExpenses, company?.currency)}</p>
              </div>
              <div className="card p-3">
                <p className="eyebrow">Net</p>
                <p className={`font-display text-lg font-semibold mt-1 num ${report.netProfit < 0 ? 'text-danger' : 'text-accent-strong'}`}>{formatMoney(report.netProfit, company?.currency)}</p>
              </div>
            </div>
            {report.income.length === 0 && report.expenses.length === 0 && (
              <p className="text-sm text-ink-muted">No voucher entries have been tagged to this cost center in this date range.</p>
            )}
            {[...report.income, ...report.expenses].length > 0 && (
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-rule">
                    {report.income.map((r) => (
                      <tr key={r.accountId}>
                        <td className="px-3 py-2">{r.name}</td>
                        <td className="px-3 py-2 num text-right text-accent-strong">{formatMoney(r.amount, company?.currency)}</td>
                      </tr>
                    ))}
                    {report.expenses.map((r) => (
                      <tr key={r.accountId}>
                        <td className="px-3 py-2">{r.name}</td>
                        <td className="px-3 py-2 num text-right text-danger">{formatMoney(r.amount, company?.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
