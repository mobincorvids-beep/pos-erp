import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

const STATUS_CHIP = { planned: 'chip-neutral', in_progress: 'chip-info', completed: 'chip-accent', cancelled: 'chip-danger' };

export function ProjectsPage() {
  const toast = useToast();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/projects').then(setProjects).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-between items-end mb-6">
        <div>
          <p className="page-title mb-1">Projects</p>
          <p className="text-sm text-ink-muted">Track profitability across active project portfolios</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ New project</button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0">
          {loading && <Loading />}
          {!loading && projects.length === 0 && (
            <EmptyState title="No projects yet" description="Tag sales, expenses, and purchases with a project to track its profitability automatically." action={<button className="btn-primary" onClick={() => setShowForm(true)}>Create a project</button>} />
          )}
          {!loading && projects.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-rule bg-surface-sunken/60">
                <p className="font-display text-lg font-semibold text-ink">Active Portfolios</p>
              </div>
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-sunken border-b border-rule">
                    <th className="px-5 py-3 eyebrow font-semibold">Code</th>
                    <th className="px-5 py-3 eyebrow font-semibold">Name</th>
                    <th className="px-5 py-3 eyebrow font-semibold">Status</th>
                    <th className="px-5 py-3 eyebrow font-semibold text-right">Budget</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr
                      key={p._id}
                      onClick={() => setSelected(p)}
                      className={`border-b border-rule last:border-0 cursor-pointer hover:bg-accent-soft/30 transition-colors ${selected?._id === p._id ? 'bg-accent-soft/40' : ''}`}
                    >
                      <td className="px-5 py-4 num text-ink-muted">{p.code}</td>
                      <td className="px-5 py-4 font-medium text-ink">{p.name}</td>
                      <td className="px-5 py-4"><span className={STATUS_CHIP[p.status]}>{p.status.replace('_', ' ')}</span></td>
                      <td className="px-5 py-4 num text-right">{formatMoney(p.budget)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selected && <ProjectDetailPanel project={selected} onClose={() => setSelected(null)} onChanged={load} />}
      </div>

      {showForm && <ProjectForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function ProjectForm({ onClose, onSaved }) {
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ name: '', budget: '', customerId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/customers').then(setCustomers).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/projects', { name: form.name, budget: Number(form.budget) || 0, customerId: form.customerId || undefined });
      toast('Project created.', 'success');
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
        <p className="font-display text-lg font-semibold text-ink mb-4">New project</p>
        <div className="space-y-3">
          <div><label className="field-label">Name</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="field-label">Budget</label><input type="number" className="field-input num" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></div>
          <div>
            <label className="field-label">Customer (optional)</label>
            <select className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">None</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
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

function ProjectDetailPanel({ project, onClose, onChanged }) {
  const { company } = useAuth();
  const toast = useToast();
  const [report, setReport] = useState(null);
  const [costs, setCosts] = useState([]);
  const [manualAmount, setManualAmount] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    api.get(`/projects/${project._id}/profitability`).then(setReport).catch((err) => toast(err.message, 'error'));
    api.get(`/projects/${project._id}/costs`).then(setCosts).catch(() => {});
  }
  useEffect(load, [project._id]);

  async function changeStatus(status) {
    try {
      await api.patch(`/projects/${project._id}/status`, { status });
      toast('Status updated.', 'success');
      onChanged();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function logCost() {
    if (!manualAmount) return;
    setBusy(true);
    try {
      await api.post(`/projects/${project._id}/costs`, { amount: Number(manualAmount), note: manualNote });
      toast('Cost logged.', 'success');
      setManualAmount(''); setManualNote('');
      load();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="w-full lg:w-96 shrink-0 card p-5 h-fit">
      <div className="flex items-center justify-between mb-4">
        <p className="font-display text-lg font-semibold text-ink">{project.name}</p>
        <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>Close</button>
      </div>

      <div>
        <label className="field-label">Status</label>
        <select className="field-input mb-4" value={project.status} onChange={(e) => changeStatus(e.target.value)}>
          <option value="planned">Planned</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {report && (
        <div className="bg-surface-sunken/60 rounded-lg p-4 mb-4">
          <p className="eyebrow mb-3">Budget Utilization</p>
          <div className="space-y-1.5 text-sm mb-3">
            <div className="flex justify-between"><span className="text-ink-muted">Revenue</span><span className="num text-accent-strong">{formatMoney(report.revenue, company?.currency)}</span></div>
            {Object.entries(report.costBreakdown).map(([type, amount]) => (
              <div key={type} className="flex justify-between"><span className="text-ink-muted capitalize">{type} cost</span><span className="num">{formatMoney(amount, company?.currency)}</span></div>
            ))}
          </div>
          <div className="tear-line my-2" />
          <div className="flex justify-between text-base font-semibold mb-1">
            <span>Profit</span>
            <span className={`num ${report.profit >= 0 ? 'text-accent-strong' : 'text-danger'}`}>{formatMoney(report.profit, company?.currency)}</span>
          </div>
          {report.budgetUtilization !== null && (
            <>
              <div className="w-full bg-surface-sunken rounded-full h-1.5 mt-3 mb-2">
                <div
                  className={`h-1.5 rounded-full ${report.budgetUtilization > 100 ? 'bg-danger' : 'bg-accent'}`}
                  style={{ width: `${Math.min(report.budgetUtilization, 100)}%` }}
                />
              </div>
              <p className="text-xs text-ink-muted">{report.budgetUtilization}% of budget used, {formatMoney(report.budgetRemaining, company?.currency)} remaining</p>
            </>
          )}
        </div>
      )}

      <p className="text-sm font-semibold text-ink mb-1 mt-2">Log a manual cost</p>
      <p className="text-xs text-ink-muted mb-3">Most costs arrive automatically when a tagged expense is approved or a tagged purchase order is received — this is only for costs with no other document (e.g. internal labor).</p>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input type="number" placeholder="Amount" className="field-input num" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} />
        <input placeholder="Note" className="field-input" value={manualNote} onChange={(e) => setManualNote(e.target.value)} />
      </div>
      <button className="btn-secondary w-full mb-5" disabled={busy || !manualAmount} onClick={logCost}>
        {busy ? 'Logging…' : 'Log cost'}
      </button>

      <p className="text-sm font-semibold text-ink mb-2">Cost history</p>
      <div className="space-y-1.5 text-xs max-h-40 overflow-y-auto">
        {costs.length === 0 && <p className="text-ink-muted">No costs logged yet.</p>}
        {costs.map((c) => (
          <div key={c._id} className="flex justify-between">
            <span className="text-ink-muted">{formatDate(c.date)} — {c.type}{c.note ? `: ${c.note}` : ''}</span>
            <span className="num">{formatMoney(c.amount, company?.currency)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
