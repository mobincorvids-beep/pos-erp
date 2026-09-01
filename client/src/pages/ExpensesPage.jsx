import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

const STATUS_CHIP = { pending: 'chip-warning', approved: 'chip-accent', rejected: 'chip-danger' };

export function ExpensesPage() {
  const { t } = useTranslation();
  const { company, can } = useAuth();
  const toast = useToast();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/expenses').then(setExpenses).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function decide(id, approve) {
    try {
      await api.post(`/expenses/${id}/${approve ? 'approve' : 'reject'}`, approve ? {} : { reason: 'Rejected from dashboard' });
      toast(approve ? t('expenses.expenseApproved') : t('expenses.expenseRejected'), 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="page-title">{t('expenses.title')}</p>
          <p className="text-sm text-ink-muted mt-1">{t('expenses.subtitle')}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>{t('expenses.submitExpense')}</button>
      </div>

      {loading && <Loading />}
      {!loading && expenses.length === 0 && (
        <EmptyState title={t('expenses.noExpensesYet')} description={t('expenses.subtitle')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('expenses.submitAnExpense')}</button>} />
      )}
      {!loading && expenses.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-rule flex items-center justify-between">
            <p className="font-display text-lg font-bold text-ink">{t('expenses.expenseLedger')}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-surface-sunken border-b border-rule">
                  <th className="py-3 px-5 eyebrow font-semibold">{t('expenses.date')}</th>
                  <th className="py-3 px-5 eyebrow font-semibold">{t('expenses.note')}</th>
                  <th className="py-3 px-5 eyebrow font-semibold text-center">{t('expenses.status')}</th>
                  <th className="py-3 px-5 eyebrow font-semibold text-right">{t('expenses.amount')}</th>
                  <th className="py-3 px-5 eyebrow font-semibold text-right">{t('expenses.action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {expenses.map((exp) => (
                  <tr key={exp._id} className="hover:bg-surface-sunken/50 transition-colors">
                    <td className="py-3 px-5 num text-ink-muted">{formatDate(exp.date)}</td>
                    <td className="py-3 px-5 text-ink">{exp.note || '-'}</td>
                    <td className="py-3 px-5 text-center"><span className={STATUS_CHIP[exp.status]}>{exp.status}</span></td>
                    <td className="py-3 px-5 num text-right text-ink">{formatMoney(exp.amount, company?.currency)}</td>
                    <td className="py-3 px-5 text-right">
                      {exp.status === 'pending' && can('expenses.approve') && (
                        <div className="flex gap-1 justify-end">
                          <button className="btn-ghost !text-accent" onClick={() => decide(exp._id, true)}>{t('expenses.approve')}</button>
                          <button className="btn-ghost !text-danger" onClick={() => decide(exp._id, false)}>{t('expenses.reject')}</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && <ExpenseForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function ExpenseForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ categoryId: '', paymentAccountId: '', amount: '', note: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/expense-categories').then(setCategories).catch(() => {});
    api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/expenses', { ...form, amount: Number(form.amount), date: new Date().toISOString() });
      toast(t('expenses.expenseSubmittedForApproval'), 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-4">{t('expenses.submitExpense')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('expenses.category')}</label>
            <select required className="field-input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">{t('expenses.select')}</option>
              {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('expenses.paidFrom')}</label>
            <select required className="field-input" value={form.paymentAccountId} onChange={(e) => setForm({ ...form, paymentAccountId: e.target.value })}>
              <option value="">{t('expenses.select')}</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('expenses.amount')}</label>
            <input type="number" step="0.01" required className="field-input num" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div>
            <label className="field-label">{t('expenses.note')}</label>
            <input className="field-input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('expenses.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('expenses.submitting') : t('expenses.submit')}</button>
        </div>
      </form>
    </div>
  );
}
