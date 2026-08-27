import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

export function HrPage() {
  const [tab, setTab] = useState('employees');
  return (
    <div>
      <div className="flex flex-wrap justify-between items-end gap-3 mb-6">
        <div>
          <p className="page-title mb-1">Human Resources</p>
          <p className="text-ink-muted">Manage employee directory, attendance, and payroll processing.</p>
        </div>
      </div>
      <div className="flex gap-2 mb-5">
        {[['employees', 'Employees'], ['leave', 'Leave requests'], ['payroll', 'Payroll']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={tab === key ? 'pill-active' : 'pill'}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'employees' && <EmployeesTab />}
      {tab === 'leave' && <LeaveTab />}
      {tab === 'payroll' && <PayrollTab />}
    </div>
  );
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
}

function Avatar({ name, active }) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${active ? 'bg-accent-soft text-accent-strong' : 'bg-surface-sunken text-ink'}`}>
      {initials(name)}
    </div>
  );
}

function EmployeesTab() {
  const toast = useToast();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [attendanceFor, setAttendanceFor] = useState(null);
  const [inviteFor, setInviteFor] = useState(null);

  function load() {
    setLoading(true);
    api.get('/hr/employees').then(setEmployees).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function terminate(id) {
    try {
      await api.post(`/hr/employees/${id}/terminate`);
      toast('Employee terminated.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>Add employee</button>
      </div>

      {loading && <Loading />}
      {!loading && employees.length === 0 && (
        <EmptyState title="No employees yet" description="Add your team to track attendance and run payroll." action={<button className="btn-primary" onClick={() => setShowForm(true)}>Add an employee</button>} />
      )}
      {!loading && employees.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-rule flex items-center justify-between">
            <p className="font-display text-lg font-semibold">Active Directory</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/60">
                  <th className="px-5 py-3 font-medium">Employee</th>
                  <th className="px-5 py-3 font-medium">Role &amp; Dept</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Basic pay</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e._id} className="border-b border-rule last:border-0 hover:bg-accent-soft/20 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={e.name} active={e.status === 'active'} />
                        <div>
                          <p className="font-medium text-ink">{e.name}</p>
                          <p className="text-xs text-ink-muted">{e.designation || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      {e.designation || '—'}
                      <br />
                      <span className="text-xs text-ink-muted">{e.departmentId?.name || '—'}</span>
                    </td>
                    <td className="px-5 py-3"><span className={e.status === 'active' ? 'chip-accent' : e.status === 'on_leave' ? 'chip-warning' : 'chip-danger'}>{e.status.replace('_', ' ')}</span></td>
                    <td className="px-5 py-3 num text-right">{formatMoney(e.salaryStructure?.basic)}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <button className="btn-ghost !text-accent" onClick={() => setAttendanceFor(e)}>Attendance</button>
                        <button className="btn-ghost !text-accent" onClick={() => setInviteFor(e)}>Invite to portal</button>
                        {e.status !== 'terminated' && <button className="btn-ghost !text-danger" onClick={() => terminate(e._id)}>Terminate</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && <EmployeeForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {attendanceFor && <AttendancePanel employee={attendanceFor} onClose={() => setAttendanceFor(null)} />}
      {inviteFor && <InviteEmployeePortalModal employee={inviteFor} onClose={() => setInviteFor(null)} />}
    </div>
  );
}

function InviteEmployeePortalModal({ employee, onClose }) {
  const toast = useToast();
  const [email, setEmail] = useState(employee.email || '');
  const [inviteLink, setInviteLink] = useState('');
  const [sending, setSending] = useState(false);

  async function handleInvite(e) {
    e.preventDefault();
    setSending(true);
    try {
      const result = await api.post('/employee-portal/invite', { employeeId: employee._id, email });
      // No email provider is wired up yet, so the invite link is shown
      // directly here to copy/send manually — see employeePortalController.js.
      setInviteLink(`${window.location.origin}/employee-portal/activate?token=${result.inviteToken}`);
      toast('Portal invite created.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-lg">{employee.name} — portal invite</p>
          <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>Close</button>
        </div>

        {!inviteLink ? (
          <form onSubmit={handleInvite} className="space-y-3">
            <div><label className="field-label">Portal email</label><input type="email" required autoFocus className="field-input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" disabled={sending} className="btn-primary">{sending ? 'Sending…' : 'Create invite'}</button>
            </div>
          </form>
        ) : (
          <div>
            <p className="text-xs text-ink-muted mb-1">Send this activation link to the employee:</p>
            <input readOnly className="field-input text-xs" value={inviteLink} onClick={(e) => e.target.select()} />
            <div className="flex justify-end mt-3">
              <button className="btn-secondary" onClick={onClose}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmployeeForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ name: '', designation: '', branchId: '', basic: '', allowances: '', deductions: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/hr/employees', {
        name: form.name, designation: form.designation, branchId: form.branchId || undefined,
        salaryStructure: { basic: Number(form.basic) || 0, allowances: Number(form.allowances) || 0, deductions: Number(form.deductions) || 0 },
      });
      toast('Employee added.', 'success');
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
        <p className="font-display text-lg mb-4">Add employee</p>
        <div className="space-y-3">
          <div><label className="field-label">Name</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="field-label">Designation</label><input className="field-input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="e.g. Cashier, Waiter" /></div>
          <div>
            <label className="field-label">Branch</label>
            <select className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Unassigned</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="field-label">Basic</label><input type="number" className="field-input num" value={form.basic} onChange={(e) => setForm({ ...form, basic: e.target.value })} /></div>
            <div><label className="field-label">Allowances</label><input type="number" className="field-input num" value={form.allowances} onChange={(e) => setForm({ ...form, allowances: e.target.value })} /></div>
            <div><label className="field-label">Deductions</label><input type="number" className="field-input num" value={form.deductions} onChange={(e) => setForm({ ...form, deductions: e.target.value })} /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

function AttendancePanel({ employee, onClose }) {
  const toast = useToast();
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [rows, setRows] = useState([]);
  const [date, setDate] = useState(today.toISOString().slice(0, 10));
  const [status, setStatus] = useState('present');
  const [busy, setBusy] = useState(false);

  function load() {
    api.get(`/hr/attendance/${employee._id}?month=${month}&year=${year}`).then(setRows).catch((err) => toast(err.message, 'error'));
  }
  useEffect(load, [month, year]);

  async function mark() {
    setBusy(true);
    try {
      await api.post('/hr/attendance', { employeeId: employee._id, date, status });
      toast('Attendance recorded.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-lg">{employee.name} — attendance</p>
          <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>Close</button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <input type="date" className="field-input" value={date} onChange={(e) => setDate(e.target.value)} />
          <select className="field-input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="leave">Leave</option>
            <option value="holiday">Holiday</option>
          </select>
          <button className="btn-primary" disabled={busy} onClick={mark}>{busy ? 'Saving…' : 'Mark'}</button>
        </div>

        <div className="max-h-60 overflow-y-auto space-y-1">
          {rows.length === 0 && <p className="text-sm text-ink-muted">No attendance recorded for {month}/{year} yet.</p>}
          {rows.map((r) => (
            <div key={r._id} className="flex justify-between text-sm border-b border-rule py-1 last:border-0">
              <span className="text-ink-muted">{formatDate(r.date)}</span>
              <span className={r.status === 'absent' ? 'chip-danger' : r.status === 'present' ? 'chip-accent' : 'chip-neutral'}>{r.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LeaveTab() {
  const toast = useToast();
  const { can } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.get('/hr/leave-requests').then(setRows).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function decide(id, approve) {
    try {
      await api.post(`/hr/leave-requests/${id}/decide`, { approve });
      toast(approve ? 'Leave approved.' : 'Leave rejected.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  if (loading) return <Loading />;
  if (rows.length === 0) return <EmptyState title="No leave requests" />;

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-rule">
        <p className="font-display text-lg font-semibold">Leave requests</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/60">
              <th className="px-5 py-3 font-medium">Employee</th>
              <th className="px-5 py-3 font-medium">Dates</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id} className="border-b border-rule last:border-0 hover:bg-accent-soft/20 transition-colors">
                <td className="px-5 py-3 flex items-center gap-3">
                  <Avatar name={r.employeeId?.name} />
                  <span>{r.employeeId?.name}</span>
                </td>
                <td className="px-5 py-3 text-ink-muted">{formatDate(r.fromDate)} – {formatDate(r.toDate)}</td>
                <td className="px-5 py-3 capitalize">{r.type}</td>
                <td className="px-5 py-3"><span className={r.status === 'pending' ? 'chip-warning' : r.status === 'approved' ? 'chip-accent' : 'chip-danger'}>{r.status}</span></td>
                <td className="px-5 py-3 text-right">
                  {r.status === 'pending' && can('hr.manage') && (
                    <div className="flex gap-1 justify-end">
                      <button className="btn-ghost !text-accent" onClick={() => decide(r._id, true)}>Approve</button>
                      <button className="btn-ghost !text-danger" onClick={() => decide(r._id, false)}>Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PayrollTab() {
  const { company, can } = useAuth();
  const toast = useToast();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/hr/payroll-runs').then(setRuns).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        {can('hr.manage') && (
          <div className="flex justify-end mb-3">
            <button className="btn-primary" onClick={() => setShowForm(true)}>Generate payroll</button>
          </div>
        )}
        {loading && <Loading />}
        {!loading && runs.length === 0 && <EmptyState title="No payroll runs yet" />}
        {!loading && runs.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-rule">
              <p className="font-display text-lg font-semibold">Payroll runs</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/60">
                    <th className="px-5 py-3 font-medium">Period</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium text-right">Total net pay</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r._id} onClick={() => setSelected(r)} className={`border-b border-rule last:border-0 cursor-pointer hover:bg-accent-soft/20 transition-colors ${selected?._id === r._id ? 'bg-accent-soft/40' : ''}`}>
                      <td className="px-5 py-3 font-medium">{r.month}/{r.year}</td>
                      <td className="px-5 py-3"><span className={r.status === 'posted' ? 'chip-accent' : 'chip-neutral'}>{r.status}</span></td>
                      <td className="px-5 py-3 num text-right">{formatMoney(r.totalNetPay, company?.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {selected && <PayrollRunPanel run={selected} onClose={() => setSelected(null)} onChanged={load} />}
      {showForm && <GeneratePayrollForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function PayrollRunPanel({ run: initialRun, onClose, onChanged }) {
  const { company, can } = useAuth();
  const toast = useToast();
  const [run, setRun] = useState(initialRun);
  const [accounts, setAccounts] = useState([]);
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/hr/payroll-runs/${initialRun._id}`).then(setRun).catch(() => {});
    api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {});
  }, [initialRun._id]);

  async function post() {
    setBusy(true);
    try {
      await api.post(`/hr/payroll-runs/${run._id}/post`, { paymentAccountId });
      toast('Payroll posted to the ledger.', 'success');
      onChanged();
      onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="w-full lg:w-96 shrink-0 card p-4 h-fit">
      <div className="flex items-center justify-between mb-3">
        <p className="font-display text-lg">{run.month}/{run.year}</p>
        <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>Close</button>
      </div>

      <div className="space-y-1.5 text-sm max-h-56 overflow-y-auto mb-3">
        {run.entries.map((e, i) => (
          <div key={i} className="flex justify-between">
            <span className="truncate">{e.employeeId?.name || 'Employee'} {e.absentDays > 0 && <span className="text-xs text-warning">({e.absentDays}d absent)</span>}</span>
            <span className="num">{formatMoney(e.netPay, company?.currency)}</span>
          </div>
        ))}
      </div>
      <div className="tear-line my-2" />
      <div className="flex justify-between items-center rounded-lg bg-accent-soft px-3 py-3 mb-4">
        <span className="font-medium text-accent-strong">Total net pay</span>
        <span className="num font-bold text-accent-strong text-base">{formatMoney(run.totalNetPay, company?.currency)}</span>
      </div>

      {run.status === 'draft' && can('payroll.post') && (
        <div>
          <label className="field-label">Pay from</label>
          <select className="field-input mb-2" value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}>
            <option value="">Select account…</option>
            {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
          <button className="btn-primary w-full" disabled={busy || !paymentAccountId} onClick={post}>
            {busy ? 'Posting…' : 'Post payroll to ledger'}
          </button>
        </div>
      )}
    </div>
  );
}

function GeneratePayrollForm({ onClose, onSaved }) {
  const toast = useToast();
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/hr/payroll-runs', { month: Number(month), year: Number(year) });
      toast('Payroll draft generated from attendance.', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-xs">
        <p className="font-display text-lg mb-4">Generate payroll</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div><label className="field-label">Month</label><input type="number" min="1" max="12" className="field-input num" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
          <div><label className="field-label">Year</label><input type="number" className="field-input num" value={year} onChange={(e) => setYear(e.target.value)} /></div>
        </div>
        <p className="text-xs text-ink-muted mb-4">Computes each active employee's net pay from their salary structure minus attendance-based deductions for that month.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Generating…' : 'Generate'}</button>
        </div>
      </form>
    </div>
  );
}
