import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

const now = new Date();

export function BudgetsPage() {
  const { t } = useTranslation();
  const MONTH_NAMES = t('common.months', { returnObjects: true });
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
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="page-title">{t('budgets.title')}</p>
          <p className="text-sm text-ink-muted mt-1">{t('budgets.subtitle')}</p>
        </div>
        {can('reports.financial') && <button className="btn-primary" onClick={() => setShowForm(true)}>{t('budgets.setABudget')}</button>}
      </div>

      <div className="flex gap-2 mb-5">
        <select className="field-input !w-40" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {MONTH_NAMES.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
        </select>
        <input type="number" className="field-input !w-28 num" value={year} onChange={(e) => setYear(Number(e.target.value))} />
      </div>

      {loading && <Loading />}
      {!loading && report?.rows.length === 0 && (
        <EmptyState title={t('budgets.noBudgetsSetFor', { month: MONTH_NAMES[month - 1], year })} description={t('budgets.setBudgetDescription')} action={can('reports.financial') && <button className="btn-primary" onClick={() => setShowForm(true)}>{t('budgets.setABudget').replace('+ ', '')}</button>} />
      )}
      {!loading && report?.rows.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6 max-w-2xl">
            <div className="card p-4">
              <p className="eyebrow">{t('budgets.totalBudgeted')}</p>
              <p className="font-display text-2xl font-semibold mt-1.5 num text-ink">{formatMoney(report.totalBudgeted, company?.currency)}</p>
            </div>
            <div className="card p-4">
              <p className="eyebrow">{t('budgets.totalActual')}</p>
              <p className="font-display text-2xl font-semibold mt-1.5 num text-ink">{formatMoney(report.totalActual, company?.currency)}</p>
            </div>
            <div className="card p-4">
              <p className="eyebrow">{t('budgets.variance')}</p>
              <p className={`font-display text-2xl font-semibold mt-1.5 num ${report.totalVariance > 0 ? 'text-danger' : 'text-accent-strong'}`}>{formatMoney(report.totalVariance, company?.currency)}</p>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-display text-lg font-semibold text-accent mb-4">{t('budgets.utilizationDeepDive')}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-widest">
                    <th className="px-3 py-2 font-semibold">{t('budgets.account')}</th>
                    <th className="px-3 py-2 font-semibold">{t('budgets.type')}</th>
                    <th className="px-3 py-2 font-semibold">{t('budgets.utilization')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('budgets.budgeted')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('budgets.actual')}</th>
                    <th className="px-3 py-2 font-semibold text-right">{t('budgets.variance')}</th>
                    <th className="px-3 py-2 font-semibold text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r) => {
                    const overBudget = r.variance > 0;
                    const pct = r.budgeted > 0 ? Math.min(100, Math.round((r.actual / r.budgeted) * 100)) : 0;
                    return (
                      <tr key={r.accountId} className="border-b border-rule last:border-0">
                        <td className="px-3 py-3 font-medium text-ink">{r.accountName}</td>
                        <td className="px-3 py-3 text-ink-muted capitalize">{r.accountType}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <div className="w-full bg-surface-sunken h-2 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${overBudget ? 'bg-danger' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="num text-xs text-ink-muted w-9 text-right">{pct}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 num text-right">{formatMoney(r.budgeted, company?.currency)}</td>
                        <td className="px-3 py-3 num text-right">{formatMoney(r.actual, company?.currency)}</td>
                        <td className={`px-3 py-3 num text-right ${overBudget ? 'text-danger' : 'text-accent-strong'}`}>{formatMoney(r.variance, company?.currency)}</td>
                        <td className="px-3 py-3 text-right">
                          {r.variancePercent !== null ? (
                            <span className={overBudget ? 'chip-danger' : 'chip-accent'}>{overBudget ? '+' : ''}{r.variancePercent}%</span>
                          ) : <span className="text-ink-muted">-</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showForm && <BudgetForm defaultMonth={month} defaultYear={year} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function BudgetForm({ defaultMonth, defaultYear, onClose, onSaved }) {
  const { t } = useTranslation();
  const MONTH_NAMES = t('common.months', { returnObjects: true });
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
      toast(t('budgets.budgetSet'), 'success');
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
        <p className="font-display text-lg font-semibold text-accent mb-4">{t('budgets.setABudget').replace('+ ', '')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('budgets.account')}</label>
            <select required className="field-input" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
              <option value="">{t('budgets.selectEllipsis')}</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name} ({a.type})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">{t('budgets.month')}</label>
              <select className="field-input" value={form.month} onChange={(e) => setForm({ ...form, month: Number(e.target.value) })}>
                {MONTH_NAMES.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">{t('budgets.year')}</label>
              <input type="number" required className="field-input num" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="field-label">{t('budgets.budgetedAmount')}</label>
            <input type="number" step="0.01" min="0.01" required className="field-input num" value={form.budgetedAmount} onChange={(e) => setForm({ ...form, budgetedAmount: e.target.value })} />
          </div>
        </div>
        <p className="text-xs text-ink-muted mt-3">{t('budgets.formNote')}</p>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('common.saving') : t('budgets.saveBudget')}</button>
        </div>
      </form>
    </div>
  );
}
