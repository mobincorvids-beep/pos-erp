import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { DocumentsPanel } from '../components/DocumentsPanel';
import { formatMoney, formatDate } from '../lib/format';

export function HrPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const canManageHr = can('hr.manage');
  const [tab, setTab] = useState('my-hr');

  // "My HR" is always first and open to everyone — the rest of the module
  // (directory, org chart, payroll processing, etc.) stays HR-manager-only,
  // matching the existing hr.manage gates elsewhere on this page.
  const tabs = [
    ['my-hr', t('hr.myHr')],
    ...(canManageHr ? [
      ['employees', t('hr.employees')], ['org-chart', t('hr.orgChart')], ['leave', t('hr.leaveRequests')],
      ['shifts', t('hr.shifts')], ['leave-policies', t('hr.leavePolicies')], ['payroll', t('hr.payroll')],
    ] : [['leave', t('hr.leaveRequests')]]), // a non-HR-manager can still land here if they're a manager approving their team's leave
  ];

  return (
    <div>
      <div className="flex flex-wrap justify-between items-end gap-3 mb-6">
        <div>
          <p className="page-title mb-1">{t('hr.title')}</p>
          <p className="text-ink-muted">{t('hr.subtitle')}</p>
        </div>
      </div>
      <div className="flex gap-2 mb-5 flex-wrap">
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={tab === key ? 'pill-active' : 'pill'}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'my-hr' && <MyHrTab />}
      {tab === 'employees' && canManageHr && <EmployeesTab />}
      {tab === 'org-chart' && canManageHr && <OrgChartTab />}
      {tab === 'leave' && <LeaveTab />}
      {tab === 'shifts' && canManageHr && <ShiftsTab />}
      {tab === 'leave-policies' && canManageHr && <LeavePoliciesTab />}
      {tab === 'payroll' && canManageHr && <PayrollTab />}
    </div>
  );
}

/**
 * Self-service view — reachable by any logged-in user, no hr.manage
 * required. Resolves the caller's own Employee record from the server
 * side (/hr/me and friends, see hrController's my* endpoints); a user
 * with no linked Employee record gets a clean explanatory state instead
 * of an error-y blank page.
 */
function MyHrTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const { company } = useAuth();
  const [employee, setEmployee] = useState(undefined); // undefined = loading, null = no linked record
  const [balances, setBalances] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [showLeaveForm, setShowLeaveForm] = useState(false);

  function loadAll() {
    api.get('/hr/me')
      .then((e) => {
        setEmployee(e);
        api.get('/hr/me/leave-balances').then(setBalances).catch(() => {});
        api.get('/hr/me/leave-requests').then(setLeaveRequests).catch(() => {});
        api.get('/hr/me/payslips').then(setPayslips).catch(() => {});
      })
      .catch(() => setEmployee(null));
  }
  useEffect(loadAll, []);
  useEffect(() => {
    if (!employee) return;
    api.get(`/hr/me/attendance?month=${month}&year=${year}`).then(setAttendance).catch(() => {});
  }, [employee, month, year]);

  if (employee === undefined) return <Loading />;
  if (employee === null) {
    return <EmptyState title={t('hr.noEmployeeRecordLinked')} description={t('hr.noEmployeeRecordLinkedDescription')} />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-6">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <Avatar name={employee.name} active={employee.status === 'active'} />
            <div>
              <p className="font-display text-lg font-semibold text-ink">{employee.name}</p>
              <p className="text-sm text-ink-muted">{employee.designation || '—'}</p>
            </div>
          </div>
          <div className="text-sm space-y-1.5 text-ink-muted">
            <p>{t('hr.status')}: <span className="chip-accent capitalize">{employee.status?.replace('_', ' ')}</span></p>
            <p>{t('hr.joined')}: {formatDate(employee.joiningDate)}</p>
            {employee.phone && <p>{t('hr.phone')}: {employee.phone}</p>}
          </div>
        </div>

        <div className="card p-5">
          <p className="font-display text-base font-semibold mb-3">{t('hr.myLeaveBalance')}</p>
          {balances.length === 0 && <p className="text-sm text-ink-muted">{t('hr.noLeaveBalanceRecordsYet')}</p>}
          {balances.map((b) => (
            <div key={b._id} className="flex justify-between text-sm border-b border-rule py-1.5 last:border-0">
              <span>{b.leavePolicyId?.name || t('hr.policy')} <span className="text-xs text-ink-muted">({b.year})</span></span>
              <span className="num">{b.remainingDays} / {b.entitledDays} {t('hr.days')}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2 space-y-6">
        <div className="card p-5">
          <div className="flex justify-between items-center mb-3">
            <p className="font-display text-base font-semibold">{t('hr.myLeaveRequests')}</p>
            <button className="btn-primary text-xs px-3 py-1.5" onClick={() => setShowLeaveForm(true)}>{t('hr.requestLeave')}</button>
          </div>
          {leaveRequests.length === 0 && <p className="text-sm text-ink-muted">{t('hr.noLeaveRequestsYet')}</p>}
          <div className="space-y-1.5">
            {leaveRequests.map((r) => (
              <div key={r._id} className="flex justify-between items-center text-sm border-b border-rule py-1.5 last:border-0">
                <span className="text-ink-muted">{formatDate(r.fromDate)} – {formatDate(r.toDate)} <span className="capitalize">({r.type})</span></span>
                <span className={r.status === 'pending' ? 'chip-warning' : r.status === 'approved' ? 'chip-accent' : 'chip-danger'}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex justify-between items-center mb-3">
            <p className="font-display text-base font-semibold">{t('hr.myAttendance')}</p>
            <div className="flex gap-1">
              <input type="number" className="field-input num !w-20 !py-1 text-xs" value={month} onChange={(e) => setMonth(Number(e.target.value))} />
              <input type="number" className="field-input num !w-24 !py-1 text-xs" value={year} onChange={(e) => setYear(Number(e.target.value))} />
            </div>
          </div>
          {attendance.length === 0 && <p className="text-sm text-ink-muted">{t('hr.noAttendanceRecordedFor', { month, year })}</p>}
          <div className="max-h-56 overflow-y-auto space-y-1">
            {attendance.map((r) => (
              <div key={r._id} className="flex justify-between text-sm border-b border-rule py-1 last:border-0">
                <span className="text-ink-muted">{formatDate(r.date)}</span>
                <span className={r.status === 'absent' ? 'chip-danger' : r.status === 'present' ? 'chip-accent' : 'chip-neutral'}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <p className="font-display text-base font-semibold mb-3">{t('hr.myPayslips')}</p>
          {payslips.length === 0 && <p className="text-sm text-ink-muted">{t('hr.noPostedPayslipsYet')}</p>}
          <div className="space-y-1.5">
            {payslips.map((p) => (
              <div key={p.payrollRunId} className="flex justify-between text-sm border-b border-rule py-1.5 last:border-0">
                <span className="text-ink-muted">{p.month}/{p.year}</span>
                <span className="num font-semibold">{formatMoney(p.netPay, company?.currency)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showLeaveForm && <MyLeaveRequestForm onClose={() => setShowLeaveForm(false)} onSaved={() => { setShowLeaveForm(false); loadAll(); }} toast={toast} />}
    </div>
  );
}

function MyLeaveRequestForm({ onClose, onSaved, toast }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ fromDate: '', toDate: '', type: 'annual', reason: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/hr/me/leave-requests', form);
      toast(t('hr.leaveRequestSubmitted'), 'success');
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
        <p className="font-display text-lg mb-4">{t('hr.requestLeave')}</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">{t('hr.from')}</label><input required type="date" className="field-input" value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} /></div>
            <div><label className="field-label">{t('hr.to')}</label><input required type="date" className="field-input" value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} /></div>
          </div>
          <div>
            <label className="field-label">{t('hr.type')}</label>
            <select className="field-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="annual">{t('hr.annual')}</option>
              <option value="sick">{t('hr.sick')}</option>
              <option value="unpaid">{t('hr.unpaid')}</option>
              <option value="other">{t('hr.other')}</option>
            </select>
          </div>
          <div><label className="field-label">{t('hr.reason')}</label><input className="field-input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('hr.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('hr.submitting') : t('hr.submit')}</button>
        </div>
      </form>
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

/** Simple recursive tree view of the reporting hierarchy — indented, nested boxes, no charting library needed for this. */
function OrgChartTab() {
  const { t } = useTranslation();
  const [roots, setRoots] = useState(null);

  function load() {
    api.get('/hr/org-chart').then(setRoots).catch(() => setRoots([]));
  }
  useEffect(load, []);

  if (roots === null) return <Loading />;
  if (roots.length === 0) return <EmptyState title={t('hr.noEmployeesYet')} description={t('hr.orgChartEmptyDescription')} />;

  return (
    <div className="card p-5">
      <p className="text-sm text-ink-muted mb-4">{t('hr.orgChartNote')}</p>
      <div className="space-y-2">
        {roots.map((node) => <OrgChartNode key={node._id} node={node} />)}
      </div>
    </div>
  );
}

function OrgChartNode({ node }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  return (
    <div>
      <div className="flex items-center gap-2 border border-line-muted rounded-lg px-3 py-2 bg-surface w-fit min-w-[220px]">
        {hasChildren ? (
          <button type="button" className="text-ink-muted hover:text-ink text-xs w-4" onClick={() => setExpanded((e) => !e)}>
            {expanded ? '▾' : '▸'}
          </button>
        ) : <span className="w-4" />}
        <Avatar name={node.name} active={node.status === 'active'} />
        <div>
          <p className="text-sm font-semibold text-ink leading-tight">{node.name}</p>
          <p className="text-xs text-ink-muted leading-tight">{node.designation || '—'}{node.status !== 'active' ? ` · ${node.status}` : ''}</p>
        </div>
      </div>
      {hasChildren && expanded && (
        <div className="mt-2 space-y-2 border-l border-line-muted pl-2 ml-4">
          {node.children.map((child) => <OrgChartNode key={child._id} node={child} />)}
        </div>
      )}
    </div>
  );
}

function EmployeesTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [attendanceFor, setAttendanceFor] = useState(null);
  const [inviteFor, setInviteFor] = useState(null);
  const [shiftFor, setShiftFor] = useState(null);
  const [balancesFor, setBalancesFor] = useState(null);
  const [managerFor, setManagerFor] = useState(null);
  const [detailFor, setDetailFor] = useState(null);

  function load() {
    setLoading(true);
    api.get('/hr/employees').then(setEmployees).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function terminate(id) {
    try {
      await api.post(`/hr/employees/${id}/terminate`);
      toast(t('hr.employeeTerminated'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>{t('hr.addEmployee')}</button>
      </div>

      {loading && <Loading />}
      {!loading && employees.length === 0 && (
        <EmptyState title={t('hr.noEmployeesYet')} description={t('hr.employeesEmptyDescription')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('hr.addAnEmployee')}</button>} />
      )}
      {!loading && employees.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-rule flex items-center justify-between">
            <p className="font-display text-lg font-semibold">{t('hr.activeDirectory')}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/60">
                  <th className="px-5 py-3 font-medium">{t('hr.employee')}</th>
                  <th className="px-5 py-3 font-medium">{t('hr.roleAndDept')}</th>
                  <th className="px-5 py-3 font-medium">{t('hr.status')}</th>
                  <th className="px-5 py-3 font-medium text-right">{t('hr.basicPay')}</th>
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
                          <p className="text-xs text-ink-muted">{e.designation || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-muted">
                      {e.designation || '-'}
                      <br />
                      <span className="text-xs text-ink-muted">{e.departmentId?.name || '-'}{e.shiftId?.name ? ` · ${e.shiftId.name} ${t('hr.shift')}` : ''}</span>
                    </td>
                    <td className="px-5 py-3"><span className={e.status === 'active' ? 'chip-accent' : e.status === 'on_leave' ? 'chip-warning' : 'chip-danger'}>{e.status.replace('_', ' ')}</span></td>
                    <td className="px-5 py-3 num text-right">{formatMoney(e.salaryStructure?.basic)}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <button className="btn-ghost !text-accent" onClick={() => setDetailFor(e)}>{t('hr.details')}</button>
                        <button className="btn-ghost !text-accent" onClick={() => setAttendanceFor(e)}>{t('hr.attendance')}</button>
                        <button className="btn-ghost !text-accent" onClick={() => setShiftFor(e)}>{t('hr.shift')}</button>
                        <button className="btn-ghost !text-accent" onClick={() => setManagerFor(e)}>{t('hr.manager')}</button>
                        <button className="btn-ghost !text-accent" onClick={() => setBalancesFor(e)}>{t('hr.leaveBalance')}</button>
                        <button className="btn-ghost !text-accent" onClick={() => setInviteFor(e)}>{t('hr.inviteToPortal')}</button>
                        {e.status !== 'terminated' && <button className="btn-ghost !text-danger" onClick={() => terminate(e._id)}>{t('hr.terminate')}</button>}
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
      {shiftFor && <AssignShiftModal employee={shiftFor} onClose={() => setShiftFor(null)} onSaved={() => { setShiftFor(null); load(); }} />}
      {managerFor && <AssignManagerModal employee={managerFor} onClose={() => setManagerFor(null)} onSaved={() => { setManagerFor(null); load(); }} />}
      {balancesFor && <LeaveBalancesModal employee={balancesFor} onClose={() => setBalancesFor(null)} />}
      {detailFor && <EmployeeDetailModal employee={detailFor} onClose={() => setDetailFor(null)} />}
    </div>
  );
}

/**
 * Employee detail view — profile summary plus panels for documents,
 * assigned fixed assets, and (HR-manager-only) disciplinary records. This
 * is the HR-manager-facing counterpart to MyHrTab's self-service view;
 * disciplinary records deliberately never appear there.
 */
function EmployeeDetailModal({ employee, onClose }) {
  const { t } = useTranslation();
  const [section, setSection] = useState('documents');
  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4 py-8 overflow-y-auto">
      <div className="card p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar name={employee.name} active={employee.status === 'active'} />
            <div>
              <p className="font-display text-lg font-semibold text-ink">{employee.name}</p>
              <p className="text-xs text-ink-muted">{employee.designation || '—'}</p>
            </div>
          </div>
          <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>{t('hr.close')}</button>
        </div>
        <div className="flex gap-2 mb-4 flex-wrap">
          {[['documents', t('hr.documents')], ['assets', t('hr.assets')], ['disciplinary', t('hr.disciplinaryRecords')]].map(([key, label]) => (
            <button key={key} onClick={() => setSection(key)} className={section === key ? 'pill-active' : 'pill'}>{label}</button>
          ))}
        </div>
        {section === 'documents' && <DocumentsPanel entityType="Employee" entityId={employee._id} />}
        {section === 'assets' && <EmployeeAssetsPanel employee={employee} />}
        {section === 'disciplinary' && <EmployeeDisciplinaryPanel employee={employee} />}
      </div>
    </div>
  );
}

function EmployeeAssetsPanel({ employee }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [assets, setAssets] = useState(null);

  function load() {
    api.get(`/fixed-assets?assignedToEmployeeId=${employee._id}`).then(setAssets).catch((err) => toast(err.message, 'error'));
  }
  useEffect(load, [employee._id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function unassign(assetId) {
    try {
      await api.post(`/fixed-assets/${assetId}/unassign`);
      toast(t('hr.assetUnassigned'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  if (assets === null) return <Loading />;
  if (assets.length === 0) return <p className="text-sm text-ink-muted">{t('hr.noFixedAssetsAssigned')}</p>;

  return (
    <div className="space-y-2">
      {assets.map((a) => (
        <div key={a._id} className="flex items-center justify-between border border-line-muted rounded-lg px-3 py-2">
          <div>
            <p className="text-sm font-medium text-ink">{a.name}</p>
            <p className="text-xs text-ink-muted">{a.category || '—'}{a.assignedAt ? ` · ${t('hr.assigned')} ${formatDate(a.assignedAt)}` : ''}</p>
          </div>
          <button className="btn-ghost !text-danger !px-0 text-xs" onClick={() => unassign(a._id)}>{t('hr.unassign')}</button>
        </div>
      ))}
    </div>
  );
}

function EmployeeDisciplinaryPanel({ employee }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [records, setRecords] = useState(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    api.get(`/hr/disciplinary-cases/${employee._id}`).then(setRecords).catch((err) => toast(err.message, 'error'));
  }
  useEffect(load, [employee._id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function resolve(id) {
    const resolutionNotes = window.prompt(t('hr.resolutionNotesOptional')) || '';
    try {
      await api.post(`/hr/disciplinary-cases/${id}/resolve`, { resolutionNotes });
      toast(t('hr.markedResolved'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  if (records === null) return <Loading />;

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary text-xs px-3 py-1.5" onClick={() => setShowForm(true)}>{t('hr.newRecord')}</button>
      </div>
      {records.length === 0 && <p className="text-sm text-ink-muted">{t('hr.noDisciplinaryRecords')}</p>}
      <div className="space-y-2">
        {records.map((r) => (
          <div key={r._id} className="border border-line-muted rounded-lg px-3 py-2">
            <div className="flex justify-between items-start">
              <div>
                <span className="chip-neutral capitalize mr-2">{r.type}</span>
                <span className={r.status === 'open' ? 'chip-warning' : 'chip-accent'}>{r.status}</span>
              </div>
              <span className="text-xs text-ink-muted">{formatDate(r.dateRecorded)}</span>
            </div>
            <p className="text-sm text-ink mt-1.5">{r.description}</p>
            {r.resolutionNotes && <p className="text-xs text-ink-muted mt-1">{t('hr.resolution')}: {r.resolutionNotes}</p>}
            {r.status === 'open' && <button className="btn-ghost !text-accent !px-0 text-xs mt-1.5" onClick={() => resolve(r._id)}>{t('hr.markResolved')}</button>}
          </div>
        ))}
      </div>
      {showForm && <DisciplinaryCaseForm employee={employee} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function DisciplinaryCaseForm({ employee, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({ type: 'warning', description: '', dateRecorded: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/hr/disciplinary-cases', { ...form, employeeId: employee._id });
      toast(t('hr.recordAdded'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-50 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">{t('hr.newDisciplinaryRecord')} — {employee.name}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('hr.type')}</label>
            <select className="field-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="warning">{t('hr.warning')}</option>
              <option value="grievance">{t('hr.grievance')}</option>
              <option value="incident">{t('hr.incident')}</option>
            </select>
          </div>
          <div><label className="field-label">{t('hr.date')}</label><input type="date" className="field-input" value={form.dateRecorded} onChange={(e) => setForm({ ...form, dateRecorded: e.target.value })} /></div>
          <div><label className="field-label">{t('hr.description')}</label><textarea required className="field-input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('hr.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('hr.saving') : t('hr.save')}</button>
        </div>
      </form>
    </div>
  );
}

function AssignShiftModal({ employee, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [shifts, setShifts] = useState([]);
  const [shiftId, setShiftId] = useState(employee.shiftId?._id || employee.shiftId || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/hr/shifts').then(setShifts).catch(() => {}); }, []);

  async function assign() {
    setSaving(true);
    try {
      await api.post('/hr/shifts/assign', { employeeId: employee._id, shiftId: shiftId || null });
      toast(t('hr.shiftAssigned'), 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-lg">{employee.name}: {t('hr.shift')}</p>
          <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>{t('hr.close')}</button>
        </div>
        <label className="field-label">{t('hr.shift')}</label>
        <select className="field-input mb-4" value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
          <option value="">{t('hr.unassigned')}</option>
          {shifts.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.startTime}–{s.endTime})</option>)}
        </select>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>{t('hr.cancel')}</button>
          <button className="btn-primary" disabled={saving} onClick={assign}>{saving ? t('hr.saving') : t('hr.save')}</button>
        </div>
      </div>
    </div>
  );
}

function AssignManagerModal({ employee, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [employees, setEmployees] = useState([]);
  const [managerId, setManagerId] = useState(employee.managerId?._id || employee.managerId || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/hr/employees').then(setEmployees).catch(() => {}); }, []);

  async function assign() {
    setSaving(true);
    try {
      await api.post(`/hr/employees/${employee._id}/manager`, { managerId: managerId || null });
      toast(t('hr.managerUpdated'), 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-lg">{employee.name}: {t('hr.manager')}</p>
          <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>{t('hr.close')}</button>
        </div>
        <label className="field-label">{t('hr.reportsTo')}</label>
        <select className="field-input mb-4" value={managerId} onChange={(e) => setManagerId(e.target.value)}>
          <option value="">{t('hr.noManagerTopOfOrgChart')}</option>
          {employees.filter((e) => e._id !== employee._id).map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
        </select>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>{t('hr.cancel')}</button>
          <button className="btn-primary" disabled={saving} onClick={assign}>{saving ? t('hr.saving') : t('hr.save')}</button>
        </div>
      </div>
    </div>
  );
}

function LeaveBalancesModal({ employee, onClose }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    api.get(`/hr/leave-balances/${employee._id}`).then(setRows).catch((err) => toast(err.message, 'error'));
  }, [employee._id]);

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-lg">{employee.name}: {t('hr.leaveBalance')}</p>
          <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>{t('hr.close')}</button>
        </div>
        {rows === null && <Loading />}
        {rows && rows.length === 0 && <p className="text-sm text-ink-muted">{t('hr.noLeaveBalanceRecordsAutoNote')}</p>}
        {rows && rows.length > 0 && (
          <div className="space-y-2">
            {rows.map((b) => (
              <div key={b._id} className="flex justify-between text-sm border-b border-rule py-1.5 last:border-0">
                <span>{b.leavePolicyId?.name || t('hr.policy')} <span className="text-xs text-ink-muted">({b.year})</span></span>
                <span className="num">{b.remainingDays} / {b.entitledDays} {t('hr.daysLeft')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InviteEmployeePortalModal({ employee, onClose }) {
  const { t } = useTranslation();
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
      toast(t('hr.portalInviteCreated'), 'success');
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
          <p className="font-display text-lg">{employee.name}: {t('hr.portalInvite')}</p>
          <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>{t('hr.close')}</button>
        </div>

        {!inviteLink ? (
          <form onSubmit={handleInvite} className="space-y-3">
            <div><label className="field-label">{t('hr.portalEmail')}</label><input type="email" required autoFocus className="field-input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={onClose}>{t('hr.cancel')}</button>
              <button type="submit" disabled={sending} className="btn-primary">{sending ? t('hr.sending') : t('hr.createInvite')}</button>
            </div>
          </form>
        ) : (
          <div>
            <p className="text-xs text-ink-muted mb-1">{t('hr.sendActivationLinkNote')}</p>
            <input readOnly className="field-input text-xs" value={inviteLink} onClick={(e) => e.target.select()} />
            <div className="flex justify-end mt-3">
              <button className="btn-secondary" onClick={onClose}>{t('hr.done')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmployeeForm({ onClose, onSaved }) {
  const { t } = useTranslation();
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
      toast(t('hr.employeeAdded'), 'success');
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
        <p className="font-display text-lg mb-4">{t('hr.addEmployee')}</p>
        <div className="space-y-3">
          <div><label className="field-label">{t('hr.name')}</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="field-label">{t('hr.designation')}</label><input className="field-input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder={t('hr.designationPlaceholder')} /></div>
          <div>
            <label className="field-label">{t('hr.branch')}</label>
            <select className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">{t('hr.unassigned')}</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="field-label">{t('hr.basic')}</label><input type="number" className="field-input num" value={form.basic} onChange={(e) => setForm({ ...form, basic: e.target.value })} /></div>
            <div><label className="field-label">{t('hr.allowances')}</label><input type="number" className="field-input num" value={form.allowances} onChange={(e) => setForm({ ...form, allowances: e.target.value })} /></div>
            <div><label className="field-label">{t('hr.deductions')}</label><input type="number" className="field-input num" value={form.deductions} onChange={(e) => setForm({ ...form, deductions: e.target.value })} /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('hr.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('hr.saving') : t('hr.save')}</button>
        </div>
      </form>
    </div>
  );
}

function AttendancePanel({ employee, onClose }) {
  const { t } = useTranslation();
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
      toast(t('hr.attendanceRecorded'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-lg">{employee.name}: {t('hr.attendance')}</p>
          <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>{t('hr.close')}</button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <input type="date" className="field-input" value={date} onChange={(e) => setDate(e.target.value)} />
          <select className="field-input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="present">{t('hr.present')}</option>
            <option value="absent">{t('hr.absent')}</option>
            <option value="leave">{t('hr.leave')}</option>
            <option value="holiday">{t('hr.holiday')}</option>
          </select>
          <button className="btn-primary" disabled={busy} onClick={mark}>{busy ? t('hr.saving') : t('hr.mark')}</button>
        </div>

        <div className="max-h-60 overflow-y-auto space-y-1">
          {rows.length === 0 && <p className="text-sm text-ink-muted">{t('hr.noAttendanceRecordedForYet', { month, year })}</p>}
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
  const { t } = useTranslation();
  const toast = useToast();
  const { can } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [balancesFor, setBalancesFor] = useState(null);

  function load() {
    setLoading(true);
    api.get('/hr/leave-requests').then(setRows).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function decide(id, approve) {
    try {
      await api.post(`/hr/leave-requests/${id}/decide`, { approve });
      toast(approve ? t('hr.leaveApproved') : t('hr.leaveRejected'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  if (loading) return <Loading />;
  if (rows.length === 0) return <EmptyState title={t('hr.noLeaveRequests')} />;

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-rule">
        <p className="font-display text-lg font-semibold">{t('hr.leaveRequests')}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/60">
              <th className="px-5 py-3 font-medium">{t('hr.employee')}</th>
              <th className="px-5 py-3 font-medium">{t('hr.dates')}</th>
              <th className="px-5 py-3 font-medium">{t('hr.type')}</th>
              <th className="px-5 py-3 font-medium">{t('hr.status')}</th>
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
                  <div className="flex gap-1 justify-end">
                    <button className="btn-ghost !text-accent" onClick={() => setBalancesFor(r.employeeId)}>{t('hr.balance')}</button>
                    {r.status === 'pending' && can('hr.manage') && (
                      <>
                        <button className="btn-ghost !text-accent" onClick={() => decide(r._id, true)}>{t('hr.approve')}</button>
                        <button className="btn-ghost !text-danger" onClick={() => decide(r._id, false)}>{t('hr.reject')}</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {balancesFor && <LeaveBalancesModal employee={balancesFor} onClose={() => setBalancesFor(null)} />}
    </div>
  );
}

function ShiftsTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/hr/shifts').then(setShifts).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>{t('hr.newShift')}</button>
      </div>
      {loading && <Loading />}
      {!loading && shifts.length === 0 && (
        <EmptyState title={t('hr.noShiftsDefined')} description={t('hr.noShiftsDefinedDescription')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('hr.newShift')}</button>} />
      )}
      {!loading && shifts.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-rule">
            <p className="font-display text-lg font-semibold">{t('hr.shifts')}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/60">
                  <th className="px-5 py-3 font-medium">{t('hr.name')}</th>
                  <th className="px-5 py-3 font-medium">{t('hr.time')}</th>
                  <th className="px-5 py-3 font-medium">{t('hr.daysLabel')}</th>
                  <th className="px-5 py-3 font-medium">{t('hr.status')}</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((s) => (
                  <tr key={s._id} className="border-b border-rule last:border-0">
                    <td className="px-5 py-3 font-medium">{s.name}</td>
                    <td className="px-5 py-3 num text-ink-muted">{s.startTime}–{s.endTime}</td>
                    <td className="px-5 py-3 text-ink-muted">{(s.daysOfWeek || []).map((d) => WEEKDAY_LABELS[d]).join(', ')}</td>
                    <td className="px-5 py-3"><span className={s.active ? 'chip-accent' : 'chip-neutral'}>{s.active ? t('hr.active') : t('hr.inactive')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {showForm && <ShiftForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ShiftForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', startTime: '09:00', endTime: '17:00', daysOfWeek: [1, 2, 3, 4, 5] });
  const [saving, setSaving] = useState(false);

  function toggleDay(d) {
    setForm((f) => ({ ...f, daysOfWeek: f.daysOfWeek.includes(d) ? f.daysOfWeek.filter((x) => x !== d) : [...f.daysOfWeek, d].sort() }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/hr/shifts', form);
      toast(t('hr.shiftCreated'), 'success');
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
        <p className="font-display text-lg mb-4">{t('hr.newShift')}</p>
        <div className="space-y-3">
          <div><label className="field-label">{t('hr.name')}</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('hr.shiftNamePlaceholder')} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">{t('hr.start')}</label><input required type="time" className="field-input" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
            <div><label className="field-label">{t('hr.end')}</label><input required type="time" className="field-input" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
          </div>
          <div>
            <label className="field-label">{t('hr.daysLabel')}</label>
            <div className="flex gap-1 flex-wrap">
              {WEEKDAY_LABELS.map((label, d) => (
                <button type="button" key={d} onClick={() => toggleDay(d)} className={form.daysOfWeek.includes(d) ? 'chip-accent' : 'chip-neutral'}>{label}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('hr.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('hr.saving') : t('hr.save')}</button>
        </div>
      </form>
    </div>
  );
}

function LeavePoliciesTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/hr/leave-policies').then(setPolicies).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>{t('hr.newLeavePolicy')}</button>
      </div>
      {loading && <Loading />}
      {!loading && policies.length === 0 && (
        <EmptyState title={t('hr.noLeavePoliciesYet')} description={t('hr.noLeavePoliciesYetDescription')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('hr.newLeavePolicy')}</button>} />
      )}
      {!loading && policies.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-rule">
            <p className="font-display text-lg font-semibold">{t('hr.leavePolicies')}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/60">
                  <th className="px-5 py-3 font-medium">{t('hr.name')}</th>
                  <th className="px-5 py-3 font-medium text-right">{t('hr.annualEntitlement')}</th>
                  <th className="px-5 py-3 font-medium">{t('hr.carryForward')}</th>
                  <th className="px-5 py-3 font-medium">{t('hr.status')}</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p._id} className="border-b border-rule last:border-0">
                    <td className="px-5 py-3 font-medium">{p.name}</td>
                    <td className="px-5 py-3 num text-right">{p.annualEntitlementDays} {t('hr.days')}</td>
                    <td className="px-5 py-3 text-ink-muted">{p.carryForwardAllowed ? `${t('hr.upTo')} ${p.maxCarryForwardDays} ${t('hr.days')}` : t('hr.notAllowed')}</td>
                    <td className="px-5 py-3"><span className={p.active ? 'chip-accent' : 'chip-neutral'}>{p.active ? t('hr.active') : t('hr.inactive')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {showForm && <LeavePolicyForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function LeavePolicyForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', annualEntitlementDays: '14', carryForwardAllowed: false, maxCarryForwardDays: '0' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/hr/leave-policies', {
        name: form.name,
        annualEntitlementDays: Number(form.annualEntitlementDays) || 0,
        carryForwardAllowed: form.carryForwardAllowed,
        maxCarryForwardDays: Number(form.maxCarryForwardDays) || 0,
      });
      toast(t('hr.leavePolicyCreated'), 'success');
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
        <p className="font-display text-lg mb-4">{t('hr.newLeavePolicy')}</p>
        <div className="space-y-3">
          <div><label className="field-label">{t('hr.name')}</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('hr.leavePolicyNamePlaceholder')} /></div>
          <div><label className="field-label">{t('hr.annualEntitlementDays')}</label><input type="number" min="0" className="field-input num" value={form.annualEntitlementDays} onChange={(e) => setForm({ ...form, annualEntitlementDays: e.target.value })} /></div>
          <div className="flex items-center gap-2">
            <input id="cf" type="checkbox" checked={form.carryForwardAllowed} onChange={(e) => setForm({ ...form, carryForwardAllowed: e.target.checked })} />
            <label htmlFor="cf" className="text-sm">{t('hr.allowCarryForward')}</label>
          </div>
          {form.carryForwardAllowed && (
            <div><label className="field-label">{t('hr.maxCarryForwardDays')}</label><input type="number" min="0" className="field-input num" value={form.maxCarryForwardDays} onChange={(e) => setForm({ ...form, maxCarryForwardDays: e.target.value })} /></div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('hr.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('hr.saving') : t('hr.save')}</button>
        </div>
      </form>
    </div>
  );
}

function PayrollTab() {
  const { t } = useTranslation();
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
            <button className="btn-primary" onClick={() => setShowForm(true)}>{t('hr.generatePayroll')}</button>
          </div>
        )}
        {loading && <Loading />}
        {!loading && runs.length === 0 && <EmptyState title={t('hr.noPayrollRunsYet')} />}
        {!loading && runs.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-rule">
              <p className="font-display text-lg font-semibold">{t('hr.payrollRuns')}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/60">
                    <th className="px-5 py-3 font-medium">{t('hr.period')}</th>
                    <th className="px-5 py-3 font-medium">{t('hr.status')}</th>
                    <th className="px-5 py-3 font-medium text-right">{t('hr.totalNetPay')}</th>
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
  const { t } = useTranslation();
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
      toast(t('hr.payrollPostedToLedger'), 'success');
      onChanged();
      onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="w-full lg:w-96 shrink-0 card p-4 h-fit">
      <div className="flex items-center justify-between mb-3">
        <p className="font-display text-lg">{run.month}/{run.year}</p>
        <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>{t('hr.close')}</button>
      </div>

      <div className="space-y-1.5 text-sm max-h-56 overflow-y-auto mb-3">
        {run.entries.map((e, i) => (
          <div key={i} className="flex justify-between">
            <span className="truncate">{e.employeeId?.name || t('hr.employee')} {e.absentDays > 0 && <span className="text-xs text-warning">({e.absentDays}{t('hr.dAbsent')})</span>}</span>
            <span className="num">{formatMoney(e.netPay, company?.currency)}</span>
          </div>
        ))}
      </div>
      <div className="tear-line my-2" />
      <div className="flex justify-between items-center rounded-lg bg-accent-soft px-3 py-3 mb-4">
        <span className="font-medium text-accent-strong">{t('hr.totalNetPay')}</span>
        <span className="num font-bold text-accent-strong text-base">{formatMoney(run.totalNetPay, company?.currency)}</span>
      </div>

      {run.status === 'draft' && can('payroll.post') && (
        <div>
          <label className="field-label">{t('hr.payFrom')}</label>
          <select className="field-input mb-2" value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}>
            <option value="">{t('hr.selectAccount')}</option>
            {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
          <button className="btn-primary w-full" disabled={busy || !paymentAccountId} onClick={post}>
            {busy ? t('hr.posting') : t('hr.postPayrollToLedger')}
          </button>
        </div>
      )}
    </div>
  );
}

function GeneratePayrollForm({ onClose, onSaved }) {
  const { t } = useTranslation();
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
      toast(t('hr.payrollDraftGenerated'), 'success');
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
        <p className="font-display text-lg mb-4">{t('hr.generatePayroll')}</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div><label className="field-label">{t('hr.month')}</label><input type="number" min="1" max="12" className="field-input num" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
          <div><label className="field-label">{t('hr.year')}</label><input type="number" className="field-input num" value={year} onChange={(e) => setYear(e.target.value)} /></div>
        </div>
        <p className="text-xs text-ink-muted mb-4">{t('hr.generatePayrollNote')}</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('hr.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('hr.generating') : t('hr.generate')}</button>
        </div>
      </form>
    </div>
  );
}
