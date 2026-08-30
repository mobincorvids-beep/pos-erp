import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

const STATUS_CHIP = { draft: 'chip-neutral', submitted: 'chip-warning', approved: 'chip-accent', rejected: 'chip-danger' };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function TimesheetsPage() {
  const toast = useToast();
  const [entries, setEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [statusFilter, setStatusFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (projectFilter) params.set('projectId', projectFilter);
    if (fromFilter) params.set('from', fromFilter);
    if (toFilter) params.set('to', toFilter);
    const query = params.toString() ? `?${params.toString()}` : '';
    api.get(`/timesheets${query}`)
      .then(setEntries)
      .catch((err) => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }
  useEffect(load, [statusFilter, projectFilter, fromFilter, toFilter]);

  useEffect(() => {
    api.get('/projects').then((res) => setProjects(res.items || res)).catch(() => {});
    api.get('/hr/employees').then((res) => setEmployees(res.items || res)).catch(() => {});
  }, []);

  async function submit(id) {
    try { await api.post(`/timesheets/${id}/submit`); toast('Timesheet submitted.', 'success'); load(); }
    catch (err) { toast(err.message, 'error'); }
  }
  async function approve(id) {
    try { await api.post(`/timesheets/${id}/approve`); toast('Timesheet approved.', 'success'); load(); }
    catch (err) { toast(err.message, 'error'); }
  }
  async function reject(id) {
    const reason = window.prompt('Reason for rejection (optional):') || '';
    try { await api.post(`/timesheets/${id}/reject`, { reason }); toast('Timesheet rejected.', 'success'); load(); }
    catch (err) { toast(err.message, 'error'); }
  }
  async function remove(id) {
    if (!window.confirm('Delete this timesheet entry?')) return;
    try { await api.delete(`/timesheets/${id}`); toast('Entry deleted.', 'success'); load(); }
    catch (err) { toast(err.message, 'error'); }
  }

  const totalHours = entries.reduce((sum, e) => sum + (e.hours || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow mb-1">People</p>
          <p className="page-title">Timesheets</p>
          <p className="text-sm text-ink-muted mt-1">Log hours against projects and tasks, then submit them for approval.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>Log time</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
        <div className="card p-3">
          <p className="eyebrow">Entries</p>
          <p className="font-display text-2xl font-bold text-ink mt-1">{entries.length}</p>
        </div>
        <div className="card p-3">
          <p className="eyebrow">Total hours</p>
          <p className="font-display text-2xl font-bold text-ink mt-1 num">{totalHours.toFixed(2)}</p>
        </div>
        <div className="card p-3">
          <p className="eyebrow">Submitted</p>
          <p className="font-display text-2xl font-bold text-warning mt-1">{entries.filter((e) => e.status === 'submitted').length}</p>
        </div>
        <div className="card p-3">
          <p className="eyebrow">Approved</p>
          <p className="font-display text-2xl font-bold text-ink mt-1">{entries.filter((e) => e.status === 'approved').length}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-1 border-b border-rule">
          {[['', 'All'], ['draft', 'Draft'], ['submitted', 'Submitted'], ['approved', 'Approved'], ['rejected', 'Rejected']].map(([key, label]) => (
            <button key={key} onClick={() => setStatusFilter(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 transition-colors ${statusFilter === key ? 'border-accent text-accent-strong font-semibold' : 'border-transparent text-ink-muted hover:text-ink'}`}>
              {label}
            </button>
          ))}
        </div>
        <div>
          <label className="field-label">Project</label>
          <select className="field-input" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="">All projects</option>
            {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">From</label>
          <input type="date" className="field-input" value={fromFilter} onChange={(e) => setFromFilter(e.target.value)} />
        </div>
        <div>
          <label className="field-label">To</label>
          <input type="date" className="field-input" value={toFilter} onChange={(e) => setToFilter(e.target.value)} />
        </div>
      </div>

      {loading && <Loading />}
      {!loading && entries.length === 0 && (
        <EmptyState title="No timesheet entries" description="Log hours against a project or task, then submit them for a manager to approve." action={<button className="btn-primary" onClick={() => setShowForm(true)}>Log time</button>} />
      )}
      {!loading && entries.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-rule bg-surface-sunken/60">
                  <th className="px-5 py-3 eyebrow font-medium">Date</th>
                  <th className="px-5 py-3 eyebrow font-medium">Employee</th>
                  <th className="px-5 py-3 eyebrow font-medium">Project</th>
                  <th className="px-5 py-3 eyebrow font-medium">Hours</th>
                  <th className="px-5 py-3 eyebrow font-medium">Billable</th>
                  <th className="px-5 py-3 eyebrow font-medium">Status</th>
                  <th className="px-5 py-3 eyebrow font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {entries.map((e) => (
                  <tr key={e._id} className="align-top">
                    <td className="px-5 py-4 text-ink-muted">{formatDate(e.date)}</td>
                    <td className="px-5 py-4 text-ink">{e.employeeId?.name || '-'}</td>
                    <td className="px-5 py-4">
                      <p className="text-ink">{e.projectId?.name || '-'}</p>
                      {e.description && <p className="text-ink-muted text-xs mt-0.5">{e.description}</p>}
                    </td>
                    <td className="px-5 py-4 num">{e.hours}</td>
                    <td className="px-5 py-4">{e.billable ? <span className="chip-accent">Billable</span> : <span className="chip-neutral">Non-billable</span>}</td>
                    <td className="px-5 py-4"><span className={STATUS_CHIP[e.status]}>{e.status}</span></td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {e.status === 'draft' && (
                          <>
                            <button className="btn-ghost !text-accent" onClick={() => submit(e._id)}>Submit</button>
                            <button className="btn-ghost !text-danger" onClick={() => remove(e._id)}>Delete</button>
                          </>
                        )}
                        {e.status === 'submitted' && (
                          <>
                            <button className="btn-ghost !text-accent" onClick={() => approve(e._id)}>Approve</button>
                            <button className="btn-ghost !text-danger" onClick={() => reject(e._id)}>Reject</button>
                          </>
                        )}
                        {e.status === 'rejected' && (
                          <span className="text-ink-muted text-xs" title={e.rejectionReason || ''}>{e.rejectionReason ? 'See reason' : ''}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <LogTimeForm
          projects={projects}
          employees={employees}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function LogTimeForm({ projects, employees, onClose, onSaved }) {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState({
    employeeId: '', projectId: '', taskId: '', date: todayISO(), hours: '', description: '', billable: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!form.projectId) { setTasks([]); return; }
    api.get(`/tasks?projectId=${form.projectId}`).then((res) => setTasks(res.items || res)).catch(() => setTasks([]));
  }, [form.projectId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/timesheets', {
        ...form,
        projectId: form.projectId || null,
        taskId: form.taskId || null,
        hours: Number(form.hours),
      });
      toast('Time logged.', 'success');
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
        <p className="font-display text-lg font-bold text-ink mb-4">Log time</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Employee</label>
            <select required className="field-input" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
              <option value="">Select…</option>
              {employees.map((emp) => <option key={emp._id} value={emp._id}>{emp.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Project</label>
            <select className="field-input" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value, taskId: '' })}>
              <option value="">No project</option>
              {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          {form.projectId && (
            <div>
              <label className="field-label">Task</label>
              <select className="field-input" value={form.taskId} onChange={(e) => setForm({ ...form, taskId: e.target.value })}>
                <option value="">No specific task</option>
                {tasks.map((t) => <option key={t._id} value={t._id}>{t.title}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="field-label">Date</label>
            <input type="date" required className="field-input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Hours</label>
            <input type="number" step="0.25" min="0.01" required className="field-input" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Description</label>
            <textarea rows={2} className="field-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.billable} onChange={(e) => setForm({ ...form, billable: e.target.checked })} />
            Billable to client
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Log time'}</button>
        </div>
      </form>
    </div>
  );
}
