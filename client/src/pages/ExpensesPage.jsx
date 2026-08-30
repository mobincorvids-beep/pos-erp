import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

const STATUS_CHIP = { pending: 'chip-warning', approved: 'chip-accent', rejected: 'chip-danger' };

export function ExpensesPage() {
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
      toast(approve ? 'Expense approved.' : 'Expense rejected.', 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="page-title">Expenses</p>
          <p className="text-sm text-ink-muted mt-1">Submitted expenses need approval before they hit the ledger.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>Submit expense</button>
      </div>

      {loading && <Loading />}
      {!loading && expenses.length === 0 && (
        <EmptyState title="No expenses yet" description="Submitted expenses need approval before they hit the ledger." action={<button className="btn-primary" onClick={() => setShowForm(true)}>Submit an expense</button>} />
      )}
      {!loading && expenses.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-rule flex items-center justify-between">
            <p className="font-display text-lg font-bold text-ink">Expense Ledger</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-surface-sunken border-b border-rule">
                  <th className="py-3 px-5 eyebrow font-semibold">Date</th>
                  <th className="py-3 px-5 eyebrow font-semibold">Note</th>
                  <th className="py-3 px-5 eyebrow font-semibold text-center">Status</th>
                  <th className="py-3 px-5 eyebrow font-semibold text-right">Amount</th>
                  <th className="py-3 px-5 eyebrow font-semibold text-right">Action</th>
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
                          <button className="btn-ghost !text-accent" onClick={() => decide(exp._id, true)}>Approve</button>
                          <button className="btn-ghost !text-danger" onClick={() => decide(exp._id, false)}>Reject</button>
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
      toast('Expense submitted for approval.', 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-4">Submit expense</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Category</label>
            <select required className="field-input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">Select…</option>
              {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Paid from</label>
            <select required className="field-input" value={form.paymentAccountId} onChange={(e) => setForm({ ...form, paymentAccountId: e.target.value })}>
              <option value="">Select…</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Amount</label>
            <input type="number" step="0.01" required className="field-input num" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Note</label>
            <input className="field-input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Submitting…' : 'Submit'}</button>
        </div>
      </form>
    </div>
  );
}
