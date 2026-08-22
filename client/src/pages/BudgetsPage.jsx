import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

const now = new Date();
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function BudgetsPage() {
  const { company, can } = useAuth();
  const toast = useToast();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get(`/budgets/vs-actual?month=${month}&year=${year}`).then(setReport).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [month, year]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="page-title">Budget vs Actual</p>
        {can('reports.financial') && <button className="btn-primary" onClick={() => setShowForm(true)}>Set a budget</button>}
      </div>

      <div className="flex gap-2 mb-5">
        <select className="field-input !w-40" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {MONTH_NAMES.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
        </select>
        <input type="number" className="field-input !w-28 num" value={year} onChange={(e) => setYear(Number(e.target.value))} />
      </div>

      {loading && <Loading />}
      {!loading && report?.rows.length === 0 && (
        <EmptyState title={`No budgets set for ${MONTH_NAMES[month - 1]} ${year}`} description="Set a budget per account, per month — actual figures are read from real posted vouchers, never a second tracked number." action={can('reports.financial') && <button className="btn-primary" onClick={() => setShowForm(true)}>Set a budget</button>} />
      )}
      {!loading && report?.rows.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5 max-w-lg">
            <div className="card p-3">
              <p className="text-xs text-ink-muted uppercase tracking-wide">Total budgeted</p>
              <p className="font-display text-2xl mt-1 num">{formatMoney(report.totalBudgeted, company?.currency)}</p>
            </div>
            <div className="card p-3">
              <p className="text-xs text-ink-muted uppercase tracking-wide">Total actual</p>
              <p className="font-display text-2xl mt-1 num">{formatMoney(report.totalActual, company?.currency)}</p>
            </div>
            <div className="card p-3">
              <p className="text-xs text-ink-muted uppercase tracking-wide">Variance</p>
              <p className={`font-display text-2xl mt-1 num ${report.totalVariance > 0 ? 'text-danger' : 'text-accent-strong'}`}>{formatMoney(report.totalVariance, company?.currency)}</p>
            </div>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                  <th className="px-3 py-2 font-medium">Account</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium text-right">Budgeted</th>
                  <th className="px-3 py-2 font-medium text-right">Actual</th>
                  <th className="px-3 py-2 font-medium text-right">Variance</th>
                  <th className="px-3 py-2 font-medium text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.accountId} className="border-b border-rule last:border-0">
                    <td className="px-3 py-2">{r.accountName}</td>
                    <td className="px-3 py-2 text-ink-muted capitalize">{r.accountType}</td>
                    <td className="px-3 py-2 num text-right">{formatMoney(r.budgeted, company?.currency)}</td>
                    <td className="px-3 py-2 num text-right">{formatMoney(r.actual, company?.currency)}</td>
                    <td className={`px-3 py-2 num text-right ${r.variance > 0 ? 'text-danger' : 'text-accent-strong'}`}>{formatMoney(r.variance, company?.currency)}</td>
                    <td className={`px-3 py-2 num text-right ${r.variance > 0 ? 'text-danger' : 'text-accent-strong'}`}>{r.variancePercent !== null ? `${r.variancePercent}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showForm && <BudgetForm defaultMonth={month} defaultYear={year} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function BudgetForm({ defaultMonth, defaultYear, onClose, onSaved }) {
  const toast = useToast();
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ accountId: '', month: defaultMonth, year: defaultYear, budgetedAmount: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/accounts').then((all) => setAccounts(all.filter((a) => a.type === 'income' || a.type === 'expense'))).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/budgets/lines', { ...form, budgetedAmount: Number(form.budgetedAmount) });
      toast('Budget set.', 'success');
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
        <p className="font-display text-lg mb-4">Set a budget</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Account</label>
            <select required className="field-input" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
              <option value="">Select…</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name} ({a.type})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">Month</label>
              <select className="field-input" value={form.month} onChange={(e) => setForm({ ...form, month: Number(e.target.value) })}>
                {MONTH_NAMES.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Year</label>
              <input type="number" required className="field-input num" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="field-label">Budgeted amount</label>
            <input type="number" step="0.01" min="0.01" required className="field-input num" value={form.budgetedAmount} onChange={(e) => setForm({ ...form, budgetedAmount: e.target.value })} />
          </div>
        </div>
        <p className="text-xs text-ink-muted mt-3">Setting a budget for an account/month that already has one updates it — it's never duplicated.</p>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save budget'}</button>
        </div>
      </form>
    </div>
  );
}
