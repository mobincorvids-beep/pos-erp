import { useEffect, useState } from 'react';
import { Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate, formatMoney } from '../lib/format';

const STAGES = ['new', 'contacted', 'proposal', 'negotiation', 'won', 'lost'];
const STAGE_LABELS = { new: 'New', contacted: 'Contacted', proposal: 'Proposal', negotiation: 'Negotiation', won: 'Won', lost: 'Lost' };

function RatingStars({ rating }) {
  return (
    <span className="inline-flex items-center gap-0.5 align-middle">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={13} strokeWidth={2} className={i < rating ? 'fill-warning text-warning' : 'text-rule'} />
      ))}
    </span>
  );
}

export function CrmPage() {
  const [tab, setTab] = useState('pipeline');
  return (
    <div>
      <div className="mb-4">
        <p className="eyebrow mb-1">Sales &amp; CRM Hub</p>
        <p className="page-title">CRM</p>
        <p className="text-sm text-ink-muted mt-1">Overview of pipeline and performance</p>
      </div>
      <div className="flex gap-1 border-b border-rule mb-5">
        {[['pipeline', 'Pipeline'], ['leads', 'Leads'], ['campaigns', 'Campaigns'], ['automation', 'Automation'], ['feedback', 'Feedback'], ['follow-ups', 'Follow-ups'], ['tags', 'Customer tags']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === key ? 'border-accent text-accent-strong font-medium' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'pipeline' && <PipelineTab />}
      {tab === 'leads' && <LeadsTab />}
      {tab === 'campaigns' && <CampaignsTab />}
      {tab === 'automation' && <AutomationTab />}
      {tab === 'feedback' && <FeedbackTab />}
      {tab === 'follow-ups' && <FollowUpsTab />}
      {tab === 'tags' && <TagsTab />}
    </div>
  );
}

function CampaignsTab() {
  const { can } = useAuth();
  const toast = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/crm/campaigns').then(setCampaigns).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function send(id) {
    try {
      const result = await api.post(`/crm/campaigns/${id}/send`);
      toast(`Sent via ${result.campaign.provider}: ${result.campaign.successCount} succeeded, ${result.campaign.failureCount} failed.`, result.campaign.failureCount > 0 ? 'error' : 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      {can('crm.manage') && (
        <div className="flex justify-end mb-3">
          <button className="btn-primary" onClick={() => setShowForm(true)}>New campaign</button>
        </div>
      )}
      {loading && <Loading />}
      {!loading && campaigns.length === 0 && <EmptyState title="No campaigns yet" description="Target customers by tag with an SMS or email message." />}
      {!loading && campaigns.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-rule">
            <p className="font-display font-bold text-ink">Campaigns ledger</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/50">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Channel</th>
                <th className="px-3 py-2 font-medium">Target tags</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c._id} className="border-b border-rule last:border-0 hover:bg-accent-soft/30 transition-colors">
                  <td className="px-3 py-2">{c.name}</td>
                  <td className="px-3 py-2 uppercase text-xs text-ink-muted">{c.channel}</td>
                  <td className="px-3 py-2">{c.targetTags?.map((t) => <span key={t} className="chip-neutral mr-1">{t}</span>) || 'All'}</td>
                  <td className="px-3 py-2"><span className={c.status === 'sent' ? (c.failureCount > 0 ? 'chip-warning' : 'chip-accent') : 'chip-neutral'}>{c.status}{c.status === 'sent' ? ` (${c.successCount}/${c.recipientCount} via ${c.provider})` : ''}</span></td>
                  <td className="px-3 py-2 text-right">
                    {c.status === 'draft' && can('crm.manage') && <button className="btn-ghost !text-accent" onClick={() => send(c._id)}>Send</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showForm && <CampaignForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function CampaignForm({ onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', channel: 'sms', message: '', targetTags: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/crm/campaigns', {
        name: form.name, channel: form.channel, message: form.message,
        targetTags: form.targetTags ? form.targetTags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      });
      toast('Campaign created as a draft.', 'success');
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
        <p className="font-display text-lg mb-4">New campaign</p>
        <div className="space-y-3">
          <div><label className="field-label">Name</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div>
            <label className="field-label">Channel</label>
            <select className="field-input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
            </select>
          </div>
          <div><label className="field-label">Target tags (comma-separated, empty = everyone)</label><input className="field-input" value={form.targetTags} onChange={(e) => setForm({ ...form, targetTags: e.target.value })} placeholder="VIP, Wholesale" /></div>
          <div><label className="field-label">Message</label><textarea required rows={3} className="field-input" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
        </div>
        <p className="text-xs text-ink-muted mt-2">Targeting is real (matches actual customers). Sending goes through a real provider abstraction, Twilio for SMS / SendGrid for email if configured, otherwise a working console/log transport so this still functions with zero setup.</p>
        <div className="flex justify-end gap-2 mt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save draft'}</button>
        </div>
      </form>
    </div>
  );
}

function FeedbackTab() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.get('/crm/feedback').then(setRows).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function resolve(id) {
    try {
      await api.post(`/crm/feedback/${id}/resolve`, { resolutionNote: 'Resolved from dashboard' });
      toast('Marked resolved.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  if (loading) return <Loading />;
  if (rows.length === 0) return <EmptyState title="No feedback logged yet" />;

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-rule">
        <p className="font-display font-bold text-ink">Feedback ledger</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/50">
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Rating</th>
            <th className="px-3 py-2 font-medium">Comment</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f._id} className="border-b border-rule last:border-0 hover:bg-accent-soft/30 transition-colors">
              <td className="px-3 py-2 text-ink-muted">{formatDate(f.createdAt)}</td>
              <td className="px-3 py-2"><RatingStars rating={f.rating} /></td>
              <td className="px-3 py-2">{f.comment || '-'}</td>
              <td className="px-3 py-2"><span className={f.status === 'resolved' ? 'chip-accent' : 'chip-warning'}>{f.status}</span></td>
              <td className="px-3 py-2 text-right">{f.status !== 'resolved' && <button className="btn-ghost !text-accent" onClick={() => resolve(f._id)}>Resolve</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FollowUpsTab() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.get('/crm/follow-ups').then(setRows).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function complete(id) {
    try {
      await api.post(`/crm/follow-ups/${id}/complete`, { completionNote: 'Done' });
      toast('Follow-up completed.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  if (loading) return <Loading />;
  if (rows.length === 0) return <EmptyState title="No pending follow-ups" />;

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-rule">
        <p className="font-display font-bold text-ink">Follow-ups ledger</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/50">
            <th className="px-3 py-2 font-medium">Due</th>
            <th className="px-3 py-2 font-medium">Note</th>
            <th className="px-3 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f._id} className="border-b border-rule last:border-0 hover:bg-accent-soft/30 transition-colors">
              <td className="px-3 py-2 text-ink-muted">{formatDate(f.dueDate)}</td>
              <td className="px-3 py-2">{f.note}</td>
              <td className="px-3 py-2 text-right"><button className="btn-ghost !text-accent" onClick={() => complete(f._id)}>Mark done</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TagsTab() {
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTag, setNewTag] = useState({});

  function load() {
    setLoading(true);
    api.get('/customers').then(setCustomers).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function addTag(customerId) {
    const tag = newTag[customerId]?.trim();
    if (!tag) return;
    try {
      await api.post(`/crm/customers/${customerId}/tags`, { tags: [tag] });
      setNewTag({ ...newTag, [customerId]: '' });
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  if (loading) return <Loading />;

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-rule">
        <p className="font-display font-bold text-ink">Customer tags ledger</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/50">
            <th className="px-3 py-2 font-medium">Customer</th>
            <th className="px-3 py-2 font-medium">Tags</th>
            <th className="px-3 py-2 font-medium">Add tag</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c._id} className="border-b border-rule last:border-0 hover:bg-accent-soft/30 transition-colors">
              <td className="px-3 py-2">{c.name}</td>
              <td className="px-3 py-2">{c.tags?.map((t) => <span key={t} className="chip-neutral mr-1">{t}</span>)}</td>
              <td className="px-3 py-2">
                <div className="flex gap-1">
                  <input className="field-input !py-1 !text-xs w-28" value={newTag[c._id] || ''} onChange={(e) => setNewTag({ ...newTag, [c._id]: e.target.value })} placeholder="VIP" />
                  <button className="btn-ghost !text-accent !text-xs" onClick={() => addTag(c._id)}>Add</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Leads ------------------------------------------------------------------

function LeadsTab() {
  const { can } = useAuth();
  const toast = useToast();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [converting, setConverting] = useState(null);

  function load() {
    setLoading(true);
    api.get(`/crm/leads${statusFilter ? `?status=${statusFilter}` : ''}`).then(setLeads).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [statusFilter]);

  async function changeStatus(id, status) {
    try {
      await api.post(`/crm/leads/${id}/status`, { status });
      toast('Lead status updated.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <select className="field-input !w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {['new', 'contacted', 'qualified', 'unqualified', 'converted'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn-primary" onClick={() => setShowForm(true)}>New lead</button>
      </div>
      {loading && <Loading />}
      {!loading && leads.length === 0 && <EmptyState title="No leads yet" description="Track prospects here before they become opportunities and customers." />}
      {!loading && leads.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-rule">
            <p className="font-display font-bold text-ink">Leads ledger</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/50">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Contact</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l._id} className="border-b border-rule last:border-0 hover:bg-accent-soft/30 transition-colors">
                  <td className="px-3 py-2">{l.name}</td>
                  <td className="px-3 py-2 text-ink-muted">{l.phone || l.email || '-'}</td>
                  <td className="px-3 py-2 uppercase text-xs text-ink-muted">{l.source}</td>
                  <td className="px-3 py-2">
                    {l.status === 'converted'
                      ? <span className="chip-accent">converted</span>
                      : (
                        <select className="field-input !py-1 !text-xs !w-32" value={l.status} onChange={(e) => changeStatus(l._id, e.target.value)}>
                          {['new', 'contacted', 'qualified', 'unqualified'].map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {l.status !== 'converted' && can('crm.manage') && (
                      <button className="btn-ghost !text-accent" onClick={() => setConverting(l)}>Convert to customer</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showForm && <NewLeadModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {converting && <ConvertLeadModal lead={converting} onClose={() => setConverting(null)} onConverted={() => { setConverting(null); load(); }} />}
    </div>
  );
}

function NewLeadModal({ onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', contactName: '', phone: '', email: '', source: 'website', notes: '' });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.name.trim()) return toast('Name is required.', 'error');
    setSaving(true);
    try {
      await api.post('/crm/leads', form);
      toast('Lead created.', 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">New lead</p>
        <div className="space-y-3">
          <div><label className="field-label">Name / business</label><input autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="field-label">Contact person</label><input className="field-input" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="field-label">Phone</label><input className="field-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className="field-label">Email</label><input className="field-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div>
            <label className="field-label">Source</label>
            <select className="field-input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {['website', 'referral', 'walk-in', 'social', 'other'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><label className="field-label">Notes</label><textarea rows={2} className="field-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={submit}>{saving ? 'Saving…' : 'Create lead'}</button>
        </div>
      </div>
    </div>
  );
}

function ConvertLeadModal({ lead, onClose, onConverted }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: lead.name, phone: lead.phone || '', email: lead.email || '', address: '' });
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await api.post(`/crm/leads/${lead._id}/convert`, form);
      toast('Lead converted to customer.', 'success');
      onConverted();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">Convert lead to customer</p>
        <div className="space-y-3">
          <div><label className="field-label">Customer name</label><input autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="field-label">Phone</label><input className="field-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className="field-label">Email</label><input className="field-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div><label className="field-label">Address</label><input className="field-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={submit}>{saving ? 'Converting…' : 'Convert'}</button>
        </div>
      </div>
    </div>
  );
}

function PipelineStat({ label, value, icon, trend, trendLabel }) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-accent' : trend === 'down' ? 'text-danger' : 'text-ink-muted';
  return (
    <div className="card p-4 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-3">
        <span className="eyebrow">{label}</span>
        <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-accent-soft text-sm shrink-0" aria-hidden="true">{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-display font-bold num text-ink leading-none">{value}</p>
        {trendLabel && (
          <p className={`text-xs flex items-center gap-1 mt-2 ${trendColor}`}>
            <TrendIcon size={13} strokeWidth={2.5} /> {trendLabel}
          </p>
        )}
      </div>
    </div>
  );
}

// --- Pipeline -----------------------------------------------------------------

function PipelineTab() {
  const { can, company } = useAuth();
  const toast = useToast();
  const [board, setBoard] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewOpp, setShowNewOpp] = useState(false);
  const [stageTarget, setStageTarget] = useState(null); // { opportunity, stage }
  const [quoting, setQuoting] = useState(null); // opportunity
  const [dragOverStage, setDragOverStage] = useState(null);

  function load() {
    setLoading(true);
    Promise.all([api.get('/crm/pipeline'), api.get('/crm/pipeline/summary')])
      .then(([b, s]) => { setBoard(b); setSummary(s); })
      .catch((err) => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function moveStage(opportunity, stage) {
    if (stage === opportunity.stage) return;
    if (stage === 'won' || stage === 'lost') {
      setStageTarget({ opportunity, stage });
      return;
    }
    try {
      // Cheap endpoint: just POSTs the new stage, same one the "Move to…"
      // dropdown used before — drag-and-drop is a different interaction on
      // the same call.
      await api.post(`/crm/opportunities/${opportunity._id}/stage`, { stage });
      toast(`Moved to ${STAGE_LABELS[stage]}.`, 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  function handleDragStart(e, opp) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', opp._id);
  }
  function handleDrop(e, stage) {
    e.preventDefault();
    setDragOverStage(null);
    const oppId = e.dataTransfer.getData('text/plain');
    const opp = STAGES.flatMap((s) => board[s] || []).find((o) => o._id === oppId);
    if (opp) moveStage(opp, stage);
  }

  if (loading) return <Loading />;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <PipelineStat label="Open pipeline value" value={formatMoney(summary?.openPipelineValue, company?.currency)} icon="💰" trend="neutral" trendLabel={summary ? `${summary.periodDays}d window` : ''} />
        <PipelineStat label={`Win rate (${summary?.periodDays ?? ''}d)`} value={summary ? `${(summary.winRate * 100).toFixed(0)}%` : '-'} icon="🎯" trend={summary?.winRate >= 0.5 ? 'up' : 'down'} trendLabel={summary ? `${summary.wonCount} won this period` : ''} />
        <PipelineStat label={`Won deals (${summary?.periodDays ?? ''}d)`} value={summary?.wonCount ?? 0} icon="🤝" trend="up" trendLabel="closed-won" />
        <PipelineStat label="Average won deal size" value={formatMoney(summary?.averageWonDealSize, company?.currency)} icon="📈" trend="neutral" trendLabel="per closed deal" />
      </div>

      {can('crm.manage') && (
        <div className="flex justify-end mb-3">
          <button className="btn-primary" onClick={() => setShowNewOpp(true)}>New opportunity</button>
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-2">
          {STAGES.map((stage) => {
            const deals = board[stage] || [];
            const columnTotal = deals.reduce((sum, o) => sum + (o.estimatedValue || 0), 0);
            return (
              <div
                key={stage}
                className={`w-64 shrink-0 rounded-xl p-2.5 transition-colors ${dragOverStage === stage ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface-sunken'}`}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOverStage !== stage) setDragOverStage(stage); }}
                onDragLeave={() => setDragOverStage((s) => (s === stage ? null : s))}
                onDrop={(e) => handleDrop(e, stage)}
              >
                <div className="flex items-baseline justify-between px-1 mb-0.5">
                  <p className="eyebrow flex items-baseline gap-1.5">
                    {STAGE_LABELS[stage]} <span className="text-ink-muted normal-case tracking-normal font-medium">({deals.length})</span>
                  </p>
                </div>
                <p className="px-1 mb-2 text-xs num text-ink-muted">{formatMoney(columnTotal, company?.currency)} total</p>
                <div className="space-y-2 min-h-[2rem]">
                  {deals.map((opp) => (
                    <div
                      key={opp._id}
                      className={`card p-3 ${can('crm.manage') && stage !== 'won' && stage !== 'lost' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                      draggable={can('crm.manage') && stage !== 'won' && stage !== 'lost'}
                      onDragStart={(e) => handleDragStart(e, opp)}
                    >
                      <p className="text-sm font-medium mb-1">{opp.title}</p>
                      <p className="text-xs text-ink-muted mb-1">{opp.customerId?.name || opp.leadId?.name || 'Unassigned'}</p>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm num text-accent-strong font-semibold">{formatMoney(opp.estimatedValue, company?.currency)}</p>
                        {opp.expectedCloseDate && <p className="text-xs text-ink-muted">{formatDate(opp.expectedCloseDate)}</p>}
                      </div>
                      {stage !== 'won' && stage !== 'lost' && can('crm.manage') && (
                        <div className="flex gap-1">
                          <select
                            className="field-input !py-1 !text-xs flex-1"
                            value=""
                            onChange={(e) => e.target.value && moveStage(opp, e.target.value)}
                          >
                            <option value="">Move to…</option>
                            {STAGES.filter((s) => s !== stage).map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                          </select>
                          <button className="btn-ghost !text-accent !text-xs !px-1.5" title="Generate quote" onClick={() => setQuoting(opp)}>Quote</button>
                        </div>
                      )}
                      {opp.quoteSaleId && stage !== 'won' && <p className="text-xs text-ink-muted mt-1">Quote generated</p>}
                      {stage === 'lost' && opp.lostReason && <p className="text-xs text-danger mt-1">{opp.lostReason}</p>}
                    </div>
                  ))}
                  {deals.length === 0 && <p className="text-xs text-ink-muted px-1 py-2">No deals here — drop a card to move it in.</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showNewOpp && <NewOpportunityModal onClose={() => setShowNewOpp(false)} onSaved={() => { setShowNewOpp(false); load(); }} />}
      {stageTarget?.stage === 'lost' && (
        <LoseOpportunityModal opportunity={stageTarget.opportunity} onClose={() => setStageTarget(null)} onDone={() => { setStageTarget(null); load(); }} />
      )}
      {stageTarget?.stage === 'won' && (
        <WinOpportunityModal opportunity={stageTarget.opportunity} onClose={() => setStageTarget(null)} onDone={() => { setStageTarget(null); load(); }} />
      )}
      {quoting && <GenerateQuoteModal opportunity={quoting} onClose={() => setQuoting(null)} onDone={() => { setQuoting(null); load(); }} />}
    </div>
  );
}

/**
 * "Generate quote" — reuses the exact same items/branch/warehouse UI as
 * WinOpportunityModal (and the same createQuotation pathway server-side)
 * but creates a standalone quote without changing the opportunity's stage.
 */
function GenerateQuoteModal({ opportunity, onClose, onDone }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [lines, setLines] = useState([{ productId: '', quantity: 1, unitPrice: '' }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/org/branches'), api.get('/org/warehouses'), api.get('/products')]).then(([b, w, p]) => {
      setBranches(b); setWarehouses(w); setProducts(p);
      if (b.length) setBranchId(b[0]._id);
      if (w.length) setWarehouseId(w[0]._id);
    }).catch((err) => toast(err.message, 'error'));
  }, []);

  function updateLine(i, patch) { setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l))); }
  function addLine() { setLines([...lines, { productId: '', quantity: 1, unitPrice: '' }]); }
  function removeLine(i) { setLines(lines.filter((_, idx) => idx !== i)); }

  async function submit() {
    if (!branchId || !warehouseId) return toast('Choose a branch and warehouse.', 'error');
    const items = lines
      .filter((l) => l.productId && Number(l.quantity) > 0)
      .map((l) => {
        const product = products.find((p) => p._id === l.productId);
        const variant = product?.variants?.[0];
        return {
          productId: l.productId, variantId: variant?._id,
          quantity: Number(l.quantity),
          unitPrice: l.unitPrice !== '' ? Number(l.unitPrice) : (variant?.sellingPrice || 0),
        };
      })
      .filter((l) => l.variantId);
    if (items.length === 0) return toast('Add at least one product line for the quote.', 'error');

    setSaving(true);
    try {
      await api.post(`/crm/opportunities/${opportunity._id}/quote`, { branchId, warehouseId, items });
      toast('Quote generated for this opportunity.', 'success');
      onDone();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-lg">
        <p className="font-display text-lg mb-1">Generate quote for "{opportunity.title}"</p>
        <p className="text-xs text-ink-muted mb-4">Pre-filled from this deal's customer — pick branch, warehouse, and products, this creates a real quotation without changing the deal's stage.</p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="field-label">Branch</label>
            <select className="field-input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Select...</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Warehouse</label>
            <select className="field-input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">Select...</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
        </div>

        <label className="field-label">Items</label>
        <div className="space-y-2 mb-3">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-2">
              <select className="field-input flex-1" value={line.productId} onChange={(e) => updateLine(i, { productId: e.target.value })}>
                <option value="">Select product...</option>
                {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              <input type="number" min="1" className="field-input w-20" placeholder="Qty" value={line.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} />
              <input type="number" min="0" className="field-input w-28" placeholder="Unit price" value={line.unitPrice} onChange={(e) => updateLine(i, { unitPrice: e.target.value })} />
              {lines.length > 1 && <button className="btn-ghost !text-danger" onClick={() => removeLine(i)}>&times;</button>}
            </div>
          ))}
        </div>
        <button className="btn-ghost !text-accent mb-4" onClick={addLine}>+ Add another item</button>

        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={submit}>{saving ? 'Generating…' : 'Generate quote'}</button>
        </div>
      </div>
    </div>
  );
}

// --- Sales automation rules ----------------------------------------------------

const TRIGGER_STAGE_OPTIONS = STAGES;
const ACTION_TYPES = [['send_email', 'Send an email'], ['create_task', 'Create a follow-up task']];

function AutomationTab() {
  const { can } = useAuth();
  const toast = useToast();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/crm/automation-rules').then(setRules).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function toggleActive(rule) {
    try {
      await api.put(`/crm/automation-rules/${rule._id}`, { active: !rule.active });
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function remove(id) {
    try {
      await api.del(`/crm/automation-rules/${id}`);
      toast('Rule deleted.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <p className="text-sm text-ink-muted mb-3">When a deal moves to a stage, automatically send an email or create a follow-up task — simple trigger-and-action rules, evaluated the moment a stage change happens.</p>
      {can('crm.manage') && (
        <div className="flex justify-end mb-3">
          <button className="btn-primary" onClick={() => setShowForm(true)}>New rule</button>
        </div>
      )}
      {loading && <Loading />}
      {!loading && rules.length === 0 && <EmptyState title="No automation rules yet" description="Automatically email or task your team when a deal changes stage." />}
      {!loading && rules.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/50">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">When stage becomes</th>
                <th className="px-3 py-2 font-medium">Then</th>
                <th className="px-3 py-2 font-medium">Active</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r._id} className="border-b border-rule last:border-0 hover:bg-accent-soft/30 transition-colors">
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2"><span className="chip-neutral">{STAGE_LABELS[r.trigger?.toStage] || r.trigger?.toStage}</span></td>
                  <td className="px-3 py-2 text-ink-muted">{r.action?.type === 'send_email' ? `Email: ${r.action.subject || '(no subject)'}` : `Task: ${r.action?.taskNote || '(no note)'}`}</td>
                  <td className="px-3 py-2">
                    {can('crm.manage')
                      ? <button className={r.active ? 'chip-accent' : 'chip-neutral'} onClick={() => toggleActive(r)}>{r.active ? 'Active' : 'Paused'}</button>
                      : <span className={r.active ? 'chip-accent' : 'chip-neutral'}>{r.active ? 'Active' : 'Paused'}</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {can('crm.manage') && <button className="btn-ghost !text-danger" onClick={() => remove(r._id)}>Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showForm && <AutomationRuleForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function AutomationRuleForm({ onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: '', toStage: 'proposal', actionType: 'send_email',
    subject: '', message: '', taskNote: '', taskDueInDays: 3,
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.name.trim()) return toast('Rule name is required.', 'error');
    setSaving(true);
    try {
      const action = form.actionType === 'send_email'
        ? { type: 'send_email', subject: form.subject, message: form.message }
        : { type: 'create_task', taskNote: form.taskNote, taskDueInDays: Number(form.taskDueInDays) || 3 };
      await api.post('/crm/automation-rules', {
        name: form.name,
        trigger: { type: 'stage_changed', toStage: form.toStage },
        action,
      });
      toast('Automation rule created.', 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">New automation rule</p>
        <div className="space-y-3">
          <div><label className="field-label">Rule name</label><input autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Thank proposal-stage deals" /></div>
          <div>
            <label className="field-label">When a deal's stage becomes</label>
            <select className="field-input" value={form.toStage} onChange={(e) => setForm({ ...form, toStage: e.target.value })}>
              {TRIGGER_STAGE_OPTIONS.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Then</label>
            <select className="field-input" value={form.actionType} onChange={(e) => setForm({ ...form, actionType: e.target.value })}>
              {ACTION_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {form.actionType === 'send_email' ? (
            <>
              <div><label className="field-label">Email subject</label><input className="field-input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Thanks for considering {{title}}" /></div>
              <div><label className="field-label">Email message</label><textarea rows={3} className="field-input" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Hi {{customerName}}, ..." /></div>
              <p className="text-xs text-ink-muted">Placeholders: {'{{title}}'}, {'{{customerName}}'}, {'{{estimatedValue}}'}, {'{{stage}}'}.</p>
            </>
          ) : (
            <>
              <div><label className="field-label">Task note</label><input className="field-input" value={form.taskNote} onChange={(e) => setForm({ ...form, taskNote: e.target.value })} placeholder="Follow up on {{title}}" /></div>
              <div><label className="field-label">Due in (days)</label><input type="number" min="0" className="field-input" value={form.taskDueInDays} onChange={(e) => setForm({ ...form, taskDueInDays: e.target.value })} /></div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={submit}>{saving ? 'Saving…' : 'Create rule'}</button>
        </div>
      </div>
    </div>
  );
}

function NewOpportunityModal({ onClose, onSaved }) {
  const toast = useToast();
  const [leads, setLeads] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ title: '', estimatedValue: '', source: 'lead', leadId: '', customerId: '', expectedCloseDate: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/crm/leads?status=new').then(setLeads).catch(() => {});
    api.get('/customers').then(setCustomers).catch(() => {});
  }, []);

  async function submit() {
    if (!form.title.trim()) return toast('Title is required.', 'error');
    if (!form.estimatedValue || Number(form.estimatedValue) < 0) return toast('Enter a valid estimated value.', 'error');
    if (form.source === 'lead' && !form.leadId) return toast('Select a lead.', 'error');
    if (form.source === 'customer' && !form.customerId) return toast('Select a customer.', 'error');
    setSaving(true);
    try {
      await api.post('/crm/opportunities', {
        title: form.title,
        estimatedValue: Number(form.estimatedValue),
        leadId: form.source === 'lead' ? form.leadId : undefined,
        customerId: form.source === 'customer' ? form.customerId : undefined,
        expectedCloseDate: form.expectedCloseDate || undefined,
      });
      toast('Opportunity created.', 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">New opportunity</p>
        <div className="space-y-3">
          <div><label className="field-label">Title</label><input autoFocus className="field-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="field-label">Estimated value</label><input type="number" min="0" className="field-input" value={form.estimatedValue} onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })} /></div>
          <div>
            <label className="field-label">Linked to</label>
            <select className="field-input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              <option value="lead">A lead</option>
              <option value="customer">An existing customer</option>
            </select>
          </div>
          {form.source === 'lead' ? (
            <div>
              <label className="field-label">Lead</label>
              <select className="field-input" value={form.leadId} onChange={(e) => setForm({ ...form, leadId: e.target.value })}>
                <option value="">Select...</option>
                {leads.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="field-label">Customer</label>
              <select className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
                <option value="">Select...</option>
                {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div><label className="field-label">Expected close date</label><input type="date" className="field-input" value={form.expectedCloseDate} onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={submit}>{saving ? 'Saving…' : 'Create opportunity'}</button>
        </div>
      </div>
    </div>
  );
}

function LoseOpportunityModal({ opportunity, onClose, onDone }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!reason.trim()) return toast('A reason is required.', 'error');
    setSaving(true);
    try {
      await api.post(`/crm/opportunities/${opportunity._id}/stage`, { stage: 'lost', lostReason: reason });
      toast('Opportunity marked lost.', 'success');
      onDone();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">Mark "{opportunity.title}" as lost</p>
        <label className="field-label">Reason</label>
        <textarea autoFocus rows={3} className="field-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Chose a competitor, budget cut, went cold…" />
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={submit}>{saving ? 'Saving…' : 'Mark lost'}</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Winning an opportunity creates a real quotation-status Sale (via the same
 * pathway the Sales/Quotations screens use), so it needs the same inputs a
 * quotation needs: branch, warehouse, and real product lines.
 */
function WinOpportunityModal({ opportunity, onClose, onDone }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [lines, setLines] = useState([{ productId: '', quantity: 1, unitPrice: '' }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/org/branches'), api.get('/org/warehouses'), api.get('/products')]).then(([b, w, p]) => {
      setBranches(b); setWarehouses(w); setProducts(p);
      if (b.length) setBranchId(b[0]._id);
      if (w.length) setWarehouseId(w[0]._id);
    }).catch((err) => toast(err.message, 'error'));
  }, []);

  function updateLine(i, patch) { setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l))); }
  function addLine() { setLines([...lines, { productId: '', quantity: 1, unitPrice: '' }]); }
  function removeLine(i) { setLines(lines.filter((_, idx) => idx !== i)); }

  async function submit() {
    if (!branchId || !warehouseId) return toast('Choose a branch and warehouse.', 'error');
    const items = lines
      .filter((l) => l.productId && Number(l.quantity) > 0)
      .map((l) => {
        const product = products.find((p) => p._id === l.productId);
        const variant = product?.variants?.[0];
        return {
          productId: l.productId, variantId: variant?._id,
          quantity: Number(l.quantity),
          unitPrice: l.unitPrice !== '' ? Number(l.unitPrice) : (variant?.sellingPrice || 0),
        };
      })
      .filter((l) => l.variantId);
    if (items.length === 0) return toast('Add at least one product line for the quotation.', 'error');

    setSaving(true);
    try {
      await api.post(`/crm/opportunities/${opportunity._id}/stage`, { stage: 'won', branchId, warehouseId, items });
      toast('Opportunity won: a quotation has been created.', 'success');
      onDone();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-lg">
        <p className="font-display text-lg mb-1">Win "{opportunity.title}"</p>
        <p className="text-xs text-ink-muted mb-4">This creates a real quotation for the deal, pick the branch, warehouse, and products.</p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="field-label">Branch</label>
            <select className="field-input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Select...</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Warehouse</label>
            <select className="field-input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">Select...</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
        </div>

        <label className="field-label">Items</label>
        <div className="space-y-2 mb-3">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-2">
              <select className="field-input flex-1" value={line.productId} onChange={(e) => updateLine(i, { productId: e.target.value })}>
                <option value="">Select product...</option>
                {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              <input type="number" min="1" className="field-input w-20" placeholder="Qty" value={line.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} />
              <input type="number" min="0" className="field-input w-28" placeholder="Unit price" value={line.unitPrice} onChange={(e) => updateLine(i, { unitPrice: e.target.value })} />
              {lines.length > 1 && <button className="btn-ghost !text-danger" onClick={() => removeLine(i)}>&times;</button>}
            </div>
          ))}
        </div>
        <button className="btn-ghost !text-accent mb-4" onClick={addLine}>+ Add another item</button>

        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving} onClick={submit}>{saving ? 'Saving…' : 'Mark won & create quotation'}</button>
        </div>
      </div>
    </div>
  );
}
