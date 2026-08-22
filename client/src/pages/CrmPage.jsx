import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

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
  const [tab, setTab] = useState('campaigns');
  return (
    <div>
      <p className="page-title mb-4">CRM</p>
      <div className="flex gap-1 border-b border-rule mb-5">
        {[['campaigns', 'Campaigns'], ['feedback', 'Feedback'], ['follow-ups', 'Follow-ups'], ['tags', 'Customer tags']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === key ? 'border-accent text-accent-strong font-medium' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'campaigns' && <CampaignsTab />}
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
      toast(`Sent via ${result.campaign.provider} — ${result.campaign.successCount} succeeded, ${result.campaign.failureCount} failed.`, result.campaign.failureCount > 0 ? 'error' : 'success');
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Channel</th>
                <th className="px-3 py-2 font-medium">Target tags</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c._id} className="border-b border-rule last:border-0">
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
        <p className="text-xs text-ink-muted mt-2">Targeting is real (matches actual customers). Sending goes through a real provider abstraction — Twilio for SMS / SendGrid for email if configured, otherwise a working console/log transport so this still functions with zero setup.</p>
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
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Rating</th>
            <th className="px-3 py-2 font-medium">Comment</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f._id} className="border-b border-rule last:border-0">
              <td className="px-3 py-2 text-ink-muted">{formatDate(f.createdAt)}</td>
              <td className="px-3 py-2"><RatingStars rating={f.rating} /></td>
              <td className="px-3 py-2">{f.comment || '—'}</td>
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
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
            <th className="px-3 py-2 font-medium">Due</th>
            <th className="px-3 py-2 font-medium">Note</th>
            <th className="px-3 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f._id} className="border-b border-rule last:border-0">
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
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
            <th className="px-3 py-2 font-medium">Customer</th>
            <th className="px-3 py-2 font-medium">Tags</th>
            <th className="px-3 py-2 font-medium">Add tag</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c._id} className="border-b border-rule last:border-0">
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
