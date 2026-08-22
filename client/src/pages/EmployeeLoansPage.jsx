import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

const STATUS_CHIP = { active: 'chip-accent', settled: 'chip-neutral' };

export function EmployeeLoansPage() {
  const { company } = useAuth();
  const toast = useToast();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [repaying, setRepaying] = useState(null);

  function load() {
    setLoading(true);
    api.get('/employee-loans').then(setLoans).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="page-title">Employee loans</p>
        <button className="btn-primary" onClick={() => setShowForm(true)}>Disburse a loan</button>
      </div>

      {loading && <Loading />}
      {!loading && loans.length === 0 && (
        <EmptyState title="No loans yet" description="A loan's monthly installment is deducted automatically the next time payroll runs for that employee." action={<button className="btn-primary" onClick={() => setShowForm(true)}>Disburse a loan</button>} />
      )}
      {!loading && loans.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-3 py-2 font-medium">Employee</th>
                <th className="px-3 py-2 font-medium text-right">Principal</th>
                <th className="px-3 py-2 font-medium text-right">Monthly installment</th>
                <th className="px-3 py-2 font-medium text-right">Remaining</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Disbursed</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {loans.map((l) => (
                <tr key={l._id} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2">{l.employeeId?.name || '—'}</td>
                  <td className="px-3 py-2 num text-right">{formatMoney(l.principalAmount, company?.currency)}</td>
                  <td className="px-3 py-2 num text-right">{formatMoney(l.monthlyInstallment, company?.currency)}</td>
                  <td className="px-3 py-2 num text-right">{formatMoney(l.remainingBalance, company?.currency)}</td>
                  <td className="px-3 py-2"><span className={STATUS_CHIP[l.status]}>{l.status}</span></td>
                  <td className="px-3 py-2 text-ink-muted">{formatDate(l.disbursedAt)}</td>
                  <td className="px-3 py-2 text-right">
                    {l.status === 'active' && <button className="btn-ghost !text-accent" onClick={() => setRepaying(l)}>Record repayment</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <LoanForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {repaying && <RepaymentForm loan={repaying} onClose={() => setRepaying(null)} onSaved={() => { setRepaying(null); load(); }} />}
    </div>
  );
}

function LoanForm({ onClose, onSaved }) {
  const toast = useToast();
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ employeeId: '', branchId: '', principalAmount: '', monthlyInstallment: '', loanReceivableAccountId: '', disbursingAccountId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/hr/employees').then(setEmployees).catch(() => {});
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/org/accounts').then(setAccounts).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/employee-loans', {
        ...form,
        principalAmount: Number(form.principalAmount),
        monthlyInstallment: Number(form.monthlyInstallment),
      });
      toast('Loan disbursed.', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto">
        <p className="font-display text-lg mb-4">Disburse a loan</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Employee</label>
            <select required className="field-input" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
              <option value="">Select…</option>
              {employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">Principal</label>
              <input type="number" step="0.01" min="0.01" required className="field-input num" value={form.principalAmount} onChange={(e) => setForm({ ...form, principalAmount: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Monthly installment</label>
              <input type="number" step="0.01" min="0.01" required className="field-input num" value={form.monthlyInstallment} onChange={(e) => setForm({ ...form, monthlyInstallment: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="field-label">Loan receivable account</label>
            <select required className="field-input" value={form.loanReceivableAccountId} onChange={(e) => setForm({ ...form, loanReceivableAccountId: e.target.value })}>
              <option value="">Select…</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Disburse from</label>
            <select required className="field-input" value={form.disbursingAccountId} onChange={(e) => setForm({ ...form, disbursingAccountId: e.target.value })}>
              <option value="">Select…</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <p className="text-xs text-ink-muted mt-3">An employee can only have one active loan at a time — settle the existing one before issuing another.</p>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Disbursing…' : 'Disburse'}</button>
        </div>
      </form>
    </div>
  );
}

function RepaymentForm({ loan, onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [amount, setAmount] = useState(String(loan.monthlyInstallment));
  const [branchId, setBranchId] = useState('');
  const [salaryPayableAccountId, setSalaryPayableAccountId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/org/accounts').then(setAccounts).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/employee-loans/${loan.employeeId?._id || loan.employeeId}/repay`, { amount: Number(amount), branchId, salaryPayableAccountId });
      toast('Repayment recorded.', 'success');
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
        <p className="font-display text-lg mb-1">Record repayment</p>
        <p className="text-sm text-ink-muted mb-4">{loan.employeeId?.name} — {loan.remainingBalance} remaining</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Amount</label>
            <input type="number" step="0.01" min="0.01" max={loan.remainingBalance} required className="field-input num" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Salary payable account</label>
            <select required className="field-input" value={salaryPayableAccountId} onChange={(e) => setSalaryPayableAccountId(e.target.value)}>
              <option value="">Select…</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Recording…' : 'Record repayment'}</button>
        </div>
      </form>
    </div>
  );
}
