import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

const PRIORITY_CHIP = { low: 'chip-neutral', medium: 'chip-warning', high: 'chip-danger', emergency: 'chip-danger' };
const STATUS_CHIP = { open: 'chip-info', assigned: 'chip-accent', resolved: 'chip-neutral', closed: 'chip-neutral' };

function initials(name) {
  if (!name) return '';
  return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

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
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="page-title">Helpdesk Overview</p>
          <p className="text-sm text-ink-muted mt-1">Manage support requests and monitor performance.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="material-symbols-outlined text-base leading-none">add_task</span>
          New ticket
        </button>
      </div>

      {compliance && compliance.overall.total > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="eyebrow">Open tickets</p>
              <div className="w-8 h-8 rounded-full bg-danger-soft text-danger flex items-center justify-center">
                <span className="material-symbols-outlined text-base leading-none">warning</span>
              </div>
            </div>
            <p className="font-display text-3xl font-bold num">{tickets.filter((t) => t.status === 'open' || t.status === 'assigned').length}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="eyebrow">SLA met</p>
              <div className="w-8 h-8 rounded-full bg-accent-soft text-accent-strong flex items-center justify-center">
                <span className="material-symbols-outlined text-base leading-none">check_circle</span>
              </div>
            </div>
            <p className="font-display text-3xl font-bold num">{compliance.overall.met}</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="eyebrow">Compliance</p>
              <div className="w-8 h-8 rounded-full bg-info-soft text-info flex items-center justify-center">
                <span className="material-symbols-outlined text-base leading-none">timer</span>
              </div>
            </div>
            <p className="font-display text-3xl font-bold num">{compliance.overall.complianceRate ?? '-'}%</p>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-rule bg-surface-sunken/50">
          <p className="font-display text-lg font-semibold">Ticket queue</p>
          <div className="flex gap-1.5">
            {[['', 'All'], ['open', 'Open'], ['assigned', 'Assigned'], ['resolved', 'Resolved'], ['closed', 'Closed']].map(([key, label]) => (
              <button key={key} onClick={() => setStatusFilter(key)} className={statusFilter === key ? 'pill-active' : 'pill'}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading && <div className="p-6"><Loading /></div>}
        {!loading && tickets.length === 0 && (
          <div className="p-6">
            <EmptyState title="No tickets" description="Customer complaints and internal support requests both live here, with a real SLA clock running on each one." action={<button className="btn-primary" onClick={() => setShowForm(true)}>Raise a ticket</button>} />
          </div>
        )}
        {!loading && tickets.length > 0 && (
          <>
            <div className="grid grid-cols-[1.6fr_100px_120px_120px_130px_110px_170px] gap-3 px-5 py-2.5 bg-surface-sunken border-b border-rule text-xs text-ink-muted uppercase tracking-wide font-semibold">
              <div>Subject</div>
              <div>Category</div>
              <div>Priority</div>
              <div>Status</div>
              <div>SLA</div>
              <div>Raised</div>
              <div className="text-right">Action</div>
            </div>
            <div>
              {tickets.map((t) => <TicketRow key={t._id} ticket={t} onChanged={load} />)}
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t border-rule text-sm text-ink-muted">
              <span>Showing {tickets.length} ticket{tickets.length === 1 ? '' : 's'}</span>
            </div>
          </>
        )}
      </div>

      {showForm && <TicketForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function slaLabel(ticket) {
  if (ticket.slaBreached === true) return <span className="chip-danger">Breached</span>;
  if (ticket.slaBreached === false) return <span className="chip-accent">Met</span>;
  const overdue = new Date(ticket.slaDueAt) < new Date();
  return overdue ? <span className="chip-danger">Overdue</span> : <span className="chip-neutral">Awaiting</span>;
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

  const assigneeName = ticket.assignedToUserId?.name || ticket.assignedToName;

  return (
    <div className="grid grid-cols-[1.6fr_100px_120px_120px_130px_110px_170px] gap-3 px-5 py-3 border-b border-rule last:border-0 items-start hover:bg-surface-sunken/40 transition-colors">
      <div>
        <p className="font-medium text-sm">{ticket.subject}</p>
        <p className="text-ink-muted text-xs mt-0.5 line-clamp-1">{ticket.description}</p>
      </div>
      <div className="text-ink-muted text-sm pt-0.5">{ticket.category}</div>
      <div className="pt-0.5"><span className={PRIORITY_CHIP[ticket.priority]}>{ticket.priority}</span></div>
      <div className="pt-0.5"><span className={STATUS_CHIP[ticket.status]}>{ticket.status}</span></div>
      <div className="pt-0.5">{slaLabel(ticket)}</div>
      <div className="text-ink-muted text-sm pt-0.5">{formatDate(ticket.createdAt)}</div>
      <div className="text-right">
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
          <div className="flex items-center justify-end gap-2">
            {assigneeName && (
              <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                <span className="w-5 h-5 rounded-full bg-accent-soft text-accent-strong flex items-center justify-center text-[10px] font-bold">{initials(assigneeName)}</span>
                {assigneeName}
              </span>
            )}
            <button className="btn-ghost !text-accent" onClick={() => setResolving(true)}>Resolve</button>
          </div>
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
      </div>
    </div>
  );
}

function TicketForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ branchId: '', category: '', subject: '', description: '', priority: 'medium' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); }, []);

  // Suggested Knowledge Base articles for ticket deflection — additive,
  // debounced lookup against the subject as the requester types, so
  // agents/customers can see a relevant SOP before the ticket is even
  // submitted. Purely informational: does not block or alter submission.
  const [suggestedArticles, setSuggestedArticles] = useState([]);
  useEffect(() => {
    const subject = form.subject.trim();
    if (subject.length < 3) { setSuggestedArticles([]); return; }
    const timer = setTimeout(() => {
      api.get(`/knowledge-base/suggest?query=${encodeURIComponent(subject)}`)
        .then(setSuggestedArticles)
        .catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [form.subject]);

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
          {suggestedArticles.length > 0 && (
            <div className="rounded-lg bg-surface-sunken/60 border border-rule p-2.5">
              <p className="text-xs font-semibold text-ink-muted mb-1.5">Suggested Knowledge Base articles</p>
              <ul className="space-y-1">
                {suggestedArticles.map((a) => (
                  <li key={a._id} className="text-xs">
                    <a href="/knowledge-base" className="text-accent hover:underline">{a.title}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <label className="field-label">Description</label>
            <textarea required rows={3} className="field-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Priority</label>
            <select className="field-input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Low: 72h response target</option>
              <option value="medium">Medium: 24h response target</option>
              <option value="high">High: 4h response target</option>
              <option value="emergency">Emergency: 1h response target</option>
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
