import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

const SEVERITY_CHIP = { low: 'chip-neutral', medium: 'chip-warning', high: 'chip-danger', critical: 'chip-danger' };
const STATUS_CHIP = { open: 'chip-neutral', investigating: 'chip-accent', corrective_action: 'chip-accent', closed: 'chip-neutral' };
const SOURCE_LABEL = {
  customer_complaint: 'Customer complaint', internal_inspection: 'Internal inspection',
  supplier_defect: 'Supplier defect', production_defect: 'Production defect', other: 'Other',
};

export function QualityPage() {
  const toast = useToast();
  const [ncrs, setNcrs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);

  function load() {
    setLoading(true);
    const query = statusFilter ? `?status=${statusFilter}` : '';
    Promise.all([
      api.get(`/quality/ncrs${query}`),
      api.get('/quality/ncrs/summary'),
    ]).then(([n, s]) => { setNcrs(n); setSummary(s); }).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [statusFilter]);

  if (selected) {
    return <NCRDetail ncrId={selected} onBack={() => { setSelected(null); load(); }} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="page-title">Quality Management</p>
        <button className="btn-primary" onClick={() => setShowForm(true)}>New NCR</button>
      </div>

      {summary && summary.total > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-5 max-w-2xl">
          <div className="card p-3">
            <p className="text-xs text-ink-muted uppercase tracking-wide">Open</p>
            <p className="font-display text-2xl mt-1">{summary.byStatus.open || 0}</p>
          </div>
          <div className="card p-3">
            <p className="text-xs text-ink-muted uppercase tracking-wide">Critical</p>
            <p className="font-display text-2xl mt-1 text-danger">{summary.bySeverity.critical || 0}</p>
          </div>
          <div className="card p-3">
            <p className="text-xs text-ink-muted uppercase tracking-wide">Closed</p>
            <p className="font-display text-2xl mt-1">{summary.byStatus.closed || 0}</p>
          </div>
          <div className="card p-3">
            <p className="text-xs text-ink-muted uppercase tracking-wide">Avg days to close</p>
            <p className="font-display text-2xl mt-1">{summary.avgDaysToClose ?? '—'}</p>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-rule mb-4">
        {[['', 'All'], ['open', 'Open'], ['investigating', 'Investigating'], ['corrective_action', 'Corrective action'], ['closed', 'Closed']].map(([key, label]) => (
          <button key={key} onClick={() => setStatusFilter(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 ${statusFilter === key ? 'border-accent text-accent-strong font-medium' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading && <Loading />}
      {!loading && ncrs.length === 0 && (
        <EmptyState title="No NCRs" description="Defective batches, failed inspections, and customer complaints about quality all live here, tracked through investigation to a verified corrective action." action={<button className="btn-primary" onClick={() => setShowForm(true)}>Log an NCR</button>} />
      )}
      {!loading && ncrs.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-3 py-2 font-medium">NCR #</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Severity</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Reported</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {ncrs.map((n) => (
                <tr key={n._id} className="border-b border-rule last:border-0 align-top">
                  <td className="px-3 py-2 font-medium">{n.ncrNumber}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{n.title}</p>
                    <p className="text-ink-muted text-xs mt-0.5">{n.description}</p>
                  </td>
                  <td className="px-3 py-2 text-ink-muted">{SOURCE_LABEL[n.source] || n.source}</td>
                  <td className="px-3 py-2"><span className={SEVERITY_CHIP[n.severity]}>{n.severity}</span></td>
                  <td className="px-3 py-2"><span className={STATUS_CHIP[n.status]}>{n.status}</span></td>
                  <td className="px-3 py-2 text-ink-muted">{formatDate(n.createdAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <button className="btn-ghost !text-accent" onClick={() => setSelected(n._id)}>Open</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <NCRForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function NCRForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ branchId: '', title: '', description: '', source: 'internal_inspection', severity: 'medium' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/quality/ncrs', form);
      toast('NCR logged.', 'success');
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
        <p className="font-display text-lg mb-4">Log a non-conformance</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Title</label>
            <input required className="field-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Description</label>
            <textarea required rows={3} className="field-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Source</label>
            <select className="field-input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              <option value="customer_complaint">Customer complaint</option>
              <option value="internal_inspection">Internal inspection</option>
              <option value="supplier_defect">Supplier defect</option>
              <option value="production_defect">Production defect</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="field-label">Severity</label>
            <select className="field-input" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Logging…' : 'Log NCR'}</button>
        </div>
      </form>
    </div>
  );
}

function NCRDetail({ ncrId, onBack }) {
  const toast = useToast();
  const [ncr, setNcr] = useState(null);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rootCause, setRootCause] = useState('');
  const [showActionForm, setShowActionForm] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      api.get(`/quality/ncrs/${ncrId}`),
      api.get(`/quality/ncrs/${ncrId}/actions`),
    ]).then(([n, a]) => { setNcr(n); setRootCause(n.rootCause || ''); setActions(a); }).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [ncrId]);

  async function saveRootCause() {
    if (!rootCause.trim()) return;
    try {
      await api.post(`/quality/ncrs/${ncrId}/root-cause`, { rootCause });
      toast('Root cause saved.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function advanceStatus(status) {
    try {
      await api.post(`/quality/ncrs/${ncrId}/status`, { status });
      toast('Status updated.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  if (loading) return <Loading />;
  if (!ncr) return null;

  const nextStatus = { open: 'investigating', investigating: 'corrective_action', corrective_action: 'closed' }[ncr.status];

  return (
    <div>
      <button className="btn-ghost mb-3" onClick={onBack}>← Back to NCRs</button>
      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-lg">{ncr.ncrNumber} — {ncr.title}</p>
            <p className="text-ink-muted text-sm mt-1">{ncr.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={SEVERITY_CHIP[ncr.severity]}>{ncr.severity}</span>
            <span className={STATUS_CHIP[ncr.status]}>{ncr.status}</span>
          </div>
        </div>

        <div className="mt-4">
          <label className="field-label">Root cause</label>
          <textarea rows={2} className="field-input" placeholder="What actually caused this?" value={rootCause} onChange={(e) => setRootCause(e.target.value)} />
          <button className="btn-secondary mt-2" onClick={saveRootCause} disabled={!rootCause.trim()}>Save root cause</button>
        </div>

        {nextStatus && (
          <div className="mt-4">
            <button className="btn-primary" onClick={() => advanceStatus(nextStatus)}>
              {nextStatus === 'closed' ? 'Close NCR' : `Move to ${nextStatus.replace('_', ' ')}`}
            </button>
            {nextStatus === 'closed' && (
              <p className="text-xs text-ink-muted mt-1">Requires at least one corrective action verified as effective.</p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="font-display text-base">Corrective / preventive actions</p>
        <button className="btn-secondary" onClick={() => setShowActionForm(true)}>Add action</button>
      </div>

      {actions.length === 0 && <EmptyState title="No actions yet" description="Add a corrective or preventive action and track it to a verified close." />}
      {actions.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium">Due</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => <ActionRow key={a._id} action={a} onChanged={load} />)}
            </tbody>
          </table>
        </div>
      )}

      {showActionForm && <ActionForm ncrId={ncrId} onClose={() => setShowActionForm(false)} onSaved={() => { setShowActionForm(false); load(); }} />}
    </div>
  );
}

function ActionRow({ action, onChanged }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [effectivenessNote, setEffectivenessNote] = useState('');
  const [editing, setEditing] = useState(false);

  async function advance(status, extra) {
    try {
      await api.post(`/quality/actions/${action._id}/status`, { status, ...extra });
      toast('Action updated.', 'success');
      setEditing(false);
      onChanged();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <tr className="border-b border-rule last:border-0 align-top">
      <td className="px-3 py-2 text-ink-muted">{action.actionType}</td>
      <td className="px-3 py-2">{action.description}</td>
      <td className="px-3 py-2 text-ink-muted">{action.dueDate ? formatDate(action.dueDate) : '—'}</td>
      <td className="px-3 py-2"><span className="chip-neutral">{action.status}</span></td>
      <td className="px-3 py-2 text-right">
        {action.status === 'open' && !editing && (
          <button className="btn-ghost !text-accent" onClick={() => advance('in_progress')}>Start</button>
        )}
        {action.status === 'in_progress' && !editing && (
          <button className="btn-ghost !text-accent" onClick={() => setEditing('complete')}>Complete</button>
        )}
        {editing === 'complete' && (
          <div className="flex gap-1 justify-end items-center">
            <input className="field-input !py-1 !text-xs" placeholder="Completion note…" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn-ghost !text-accent" onClick={() => advance('completed', { note })} disabled={!note.trim()}>Save</button>
          </div>
        )}
        {action.status === 'completed' && !editing && (
          <button className="btn-ghost !text-accent" onClick={() => setEditing('verify')}>Verify</button>
        )}
        {editing === 'verify' && (
          <div className="flex gap-1 justify-end items-center">
            <input className="field-input !py-1 !text-xs" placeholder="Effectiveness note…" value={effectivenessNote} onChange={(e) => setEffectivenessNote(e.target.value)} />
            <button className="btn-ghost !text-accent" onClick={() => advance('verified', { effectivenessNote })} disabled={!effectivenessNote.trim()}>Save</button>
          </div>
        )}
        {action.status === 'verified' && <span className="chip-accent">Verified</span>}
      </td>
    </tr>
  );
}

function ActionForm({ ncrId, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ actionType: 'corrective', description: '', dueDate: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/quality/ncrs/${ncrId}/actions`, form);
      toast('Corrective action added.', 'success');
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
        <p className="font-display text-lg mb-4">Add corrective/preventive action</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Type</label>
            <select className="field-input" value={form.actionType} onChange={(e) => setForm({ ...form, actionType: e.target.value })}>
              <option value="corrective">Corrective</option>
              <option value="preventive">Preventive</option>
            </select>
          </div>
          <div>
            <label className="field-label">Description</label>
            <textarea required rows={3} className="field-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Due date</label>
            <input type="date" className="field-input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Add action'}</button>
        </div>
      </form>
    </div>
  );
}
