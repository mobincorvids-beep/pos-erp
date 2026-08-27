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

  const activeLoans = loans.filter((l) => l.status === 'active');
  const totalOutstanding = activeLoans.reduce((sum, l) => sum + Number(l.remainingBalance || 0), 0);
  const totalPrincipal = loans.reduce((sum, l) => sum + Number(l.principalAmount || 0), 0);
  const totalRepaid = totalPrincipal - totalOutstanding;
  const repaidPct = totalPrincipal > 0 ? Math.min(100, Math.round((totalRepaid / totalPrincipal) * 100)) : 0;
  const nextDue = [...activeLoans].sort((a, b) => new Date(a.disbursedAt) - new Date(b.disbursedAt))[0];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="page-title">Employee loans</p>
          <p className="text-sm text-ink-muted mt-1">Overview of active employee advances and repayment progress.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>Disburse a loan</button>
      </div>

      {loading && <Loading />}

      {!loading && loans.length === 0 && (
        <EmptyState title="No loans yet" description="A loan's monthly installment is deducted automatically the next time payroll runs for that employee." action={<button className="btn-primary" onClick={() => setShowForm(true)}>Disburse a loan</button>} />
      )}

      {!loading && loans.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="card p-5 flex flex-col justify-between">
              <span className="eyebrow">Total outstanding balance</span>
              <p className="font-display num text-4xl font-bold text-accent mt-2">{formatMoney(totalOutstanding, company?.currency)}</p>
              <p className="text-xs text-ink-muted mt-3">{activeLoans.length} active loan{activeLoans.length === 1 ? '' : 's'}</p>
            </div>
            <div className="card p-5 flex flex-col justify-between">
              <span className="eyebrow">Next installment due</span>
              <p className="font-display num text-2xl font-bold text-ink mt-2">{nextDue ? formatMoney(nextDue.monthlyInstallment, company?.currency) : '—'}</p>
              <p className="text-xs text-ink-muted mt-1">{nextDue ? (nextDue.employeeId?.name || '—') : 'No active loans'}</p>
              {nextDue && <button className="btn-secondary mt-4 self-start" onClick={() => setRepaying(nextDue)}>Record repayment</button>}
            </div>
            <div className="card p-5 flex flex-col justify-between">
              <span className="eyebrow">Repaid to date</span>
              <p className="font-display num text-2xl font-bold text-ink mt-2">{formatMoney(totalRepaid, company?.currency)}</p>
              <div className="mt-4 w-full bg-surface-sunken h-2 rounded-full overflow-hidden">
                <div className="bg-accent h-full rounded-full" style={{ width: `${repaidPct}%` }} />
              </div>
              <div className="flex justify-between mt-1 text-xs text-ink-muted">
                <span>Repaid: {formatMoney(totalRepaid, company?.currency)}</span>
                <span>Total: {formatMoney(totalPrincipal, company?.currency)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {loans.map((l) => {
              const principal = Number(l.principalAmount || 0);
              const remaining = Number(l.remainingBalance || 0);
              const paidPct = principal > 0 ? Math.min(100, Math.round(((principal - remaining) / principal) * 100)) : 0;
              return (
                <div key={l._id} className="card p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                      <div className="bg-accent-soft p-3 rounded-lg text-accent">
                        <span className="material-symbols-outlined font-icon">person</span>
                      </div>
                      <div>
                        <p className="font-display text-lg font-semibold text-ink">{l.employeeId?.name || '—'}</p>
                        <p className="text-ink-muted text-sm">Disbursed {formatDate(l.disbursedAt)}</p>
                      </div>
                    </div>
                    <span className={STATUS_CHIP[l.status]}>{l.status}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 py-4 border-t border-b border-rule mb-4">
                    <div>
                      <span className="eyebrow block mb-1">Principal</span>
                      <span className="num text-ink">{formatMoney(l.principalAmount, company?.currency)}</span>
                    </div>
                    <div>
                      <span className="eyebrow block mb-1">Monthly installment</span>
                      <span className="num text-ink">{formatMoney(l.monthlyInstallment, company?.currency)}</span>
                    </div>
                    <div>
                      <span className="eyebrow block mb-1">Remaining</span>
                      <span className="num text-ink">{formatMoney(l.remainingBalance, company?.currency)}</span>
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="w-full bg-surface-sunken h-1.5 rounded-full overflow-hidden">
                      <div className="bg-accent h-full rounded-full" style={{ width: `${paidPct}%` }} />
                    </div>
                    <p className="text-xs text-ink-muted mt-1">{paidPct}% repaid</p>
                  </div>
                  <div className="flex justify-end">
                    {l.status === 'active' && <button className="btn-ghost !text-accent" onClick={() => setRepaying(l)}>Record repayment →</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
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
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm max-h-[85vh] overflow-y-auto">
        <p className="font-display text-lg font-semibold text-ink mb-4">Disburse a loan</p>
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
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
        <p className="font-display text-lg font-semibold text-ink mb-1">Record repayment</p>
        <p className="text-sm text-ink-muted mb-4">{loan.employeeId?.name} — <span className="num">{loan.remainingBalance}</span> remaining</p>
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
