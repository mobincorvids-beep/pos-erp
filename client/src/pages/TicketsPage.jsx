import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

const PRIORITY_CHIP = { low: 'chip-neutral', medium: 'chip-warning', high: 'chip-danger', emergency: 'chip-danger' };
const STATUS_CHIP = { open: 'chip-neutral', assigned: 'chip-accent', resolved: 'chip-accent', closed: 'chip-neutral' };

export function TicketsPage() {
  const toast = useToast();
  const [tickets, setTickets] = useState([]);
  const [compliance, setCompliance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    const query = statusFilter ? `?status=${statusFilter}` : '';
    Promise.all([
      api.get(`/tickets${query}`),
      api.get('/tickets/sla/compliance'),
    ]).then(([t, c]) => { setTickets(t); setCompliance(c); }).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [statusFilter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="page-title">Helpdesk</p>
        <button className="btn-primary" onClick={() => setShowForm(true)}>New ticket</button>
      </div>

      {compliance && compliance.overall.total > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5 max-w-lg">
          <div className="card p-3">
            <p className="text-xs text-ink-muted uppercase tracking-wide">SLA met</p>
            <p className="font-display text-2xl mt-1">{compliance.overall.met}</p>
          </div>
          <div className="card p-3">
            <p className="text-xs text-ink-muted uppercase tracking-wide">Breached</p>
            <p className="font-display text-2xl mt-1 text-danger">{compliance.overall.breached}</p>
          </div>
          <div className="card p-3">
            <p className="text-xs text-ink-muted uppercase tracking-wide">Compliance</p>
            <p className="font-display text-2xl mt-1">{compliance.overall.complianceRate ?? '—'}%</p>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-rule mb-4">
        {[['', 'All'], ['open', 'Open'], ['assigned', 'Assigned'], ['resolved', 'Resolved'], ['closed', 'Closed']].map(([key, label]) => (
          <button key={key} onClick={() => setStatusFilter(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 ${statusFilter === key ? 'border-accent text-accent-strong font-medium' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading && <Loading />}
      {!loading && tickets.length === 0 && (
        <EmptyState title="No tickets" description="Customer complaints and internal support requests both live here, with a real SLA clock running on each one." action={<button className="btn-primary" onClick={() => setShowForm(true)}>Raise a ticket</button>} />
      )}
      {!loading && tickets.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-3 py-2 font-medium">Subject</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Priority</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">SLA</th>
                <th className="px-3 py-2 font-medium">Raised</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => <TicketRow key={t._id} ticket={t} onChanged={load} />)}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <TicketForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function slaLabel(ticket) {
  if (ticket.slaBreached === true) return <span className="chip-danger">Breached</span>;
  if (ticket.slaBreached === false) return <span className="chip-accent">Met</span>;
  const overdue = new Date(ticket.slaDueAt) < new Date();
  return overdue ? <span className="chip-danger">Overdue</span> : <span className="chip-neutral">Awaiting response</span>;
}

function TicketRow({ ticket, onChanged }) {
  const toast = useToast();
  const [assigning, setAssigning] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [users, setUsers] = useState([]);
  const [assignee, setAssignee] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');

  useEffect(() => { if (assigning) api.get('/users').then(setUsers).catch(() => {}); }, [assigning]);

  async function assign() {
    if (!assignee) return;
    try {
      await api.post(`/tickets/${ticket._id}/assign`, { assignedToUserId: assignee });
      toast('Ticket assigned.', 'success');
      setAssigning(false);
      onChanged();
    } catch (err) { toast(err.message, 'error'); }
  }
  async function resolve() {
    if (!resolutionNote.trim()) return;
    try {
      await api.post(`/tickets/${ticket._id}/resolve`, { resolutionNote });
      toast('Ticket resolved.', 'success');
      setResolving(false);
      onChanged();
    } catch (err) { toast(err.message, 'error'); }
  }
  async function close() {
    try {
      await api.post(`/tickets/${ticket._id}/close`);
      toast('Ticket closed.', 'success');
      onChanged();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <tr className="border-b border-rule last:border-0 align-top">
      <td className="px-3 py-2">
        <p className="font-medium">{ticket.subject}</p>
        <p className="text-ink-muted text-xs mt-0.5">{ticket.description}</p>
      </td>
      <td className="px-3 py-2 text-ink-muted">{ticket.category}</td>
      <td className="px-3 py-2"><span className={PRIORITY_CHIP[ticket.priority]}>{ticket.priority}</span></td>
      <td className="px-3 py-2"><span className={STATUS_CHIP[ticket.status]}>{ticket.status}</span></td>
      <td className="px-3 py-2">{slaLabel(ticket)}</td>
      <td className="px-3 py-2 text-ink-muted">{formatDate(ticket.createdAt)}</td>
      <td className="px-3 py-2 text-right">
        {ticket.status === 'open' && !assigning && (
          <button className="btn-ghost !text-accent" onClick={() => setAssigning(true)}>Assign</button>
        )}
        {ticket.status === 'open' && assigning && (
          <div className="flex gap-1 justify-end items-center">
            <select className="field-input !py-1 !text-xs" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Assign to…</option>
              {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
            <button className="btn-ghost !text-accent" onClick={assign} disabled={!assignee}>Save</button>
          </div>
        )}
        {ticket.status === 'assigned' && !resolving && (
          <button className="btn-ghost !text-accent" onClick={() => setResolving(true)}>Resolve</button>
        )}
        {ticket.status === 'assigned' && resolving && (
          <div className="flex gap-1 justify-end items-center">
            <input className="field-input !py-1 !text-xs" placeholder="Resolution note…" value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} />
            <button className="btn-ghost !text-accent" onClick={resolve} disabled={!resolutionNote.trim()}>Save</button>
          </div>
        )}
        {ticket.status === 'resolved' && (
          <button className="btn-ghost" onClick={close}>Close</button>
        )}
      </td>
    </tr>
  );
}

function TicketForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ branchId: '', category: '', subject: '', description: '', priority: 'medium' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/tickets', form);
      toast('Ticket raised.', 'success');
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
        <p className="font-display text-lg mb-4">Raise a ticket</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Category</label>
            <input required className="field-input" placeholder="Billing, technical, general…" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Subject</label>
            <input required className="field-input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Description</label>
            <textarea required rows={3} className="field-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Priority</label>
            <select className="field-input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Low — 72h response target</option>
              <option value="medium">Medium — 24h response target</option>
              <option value="high">High — 4h response target</option>
              <option value="emergency">Emergency — 1h response target</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Raising…' : 'Raise ticket'}</button>
        </div>
      </form>
    </div>
  );
}
