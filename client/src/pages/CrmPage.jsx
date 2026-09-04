import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate, formatMoney } from '../lib/format';

const STAGES = ['new', 'contacted', 'proposal', 'negotiation', 'won', 'lost'];
const STAGE_LABEL_KEYS = {
  new: 'crm.stageNew', contacted: 'crm.stageContacted', proposal: 'crm.stageProposal',
  negotiation: 'crm.stageNegotiation', won: 'crm.stageWon', lost: 'crm.stageLost',
};

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
  const { t } = useTranslation();
  const [tab, setTab] = useState('pipeline');
  const TABS = [
    ['pipeline', t('crm.tabPipeline')], ['leads', t('crm.tabLeads')], ['campaigns', t('crm.tabCampaigns')],
    ['automation', t('crm.tabAutomation')], ['feedback', t('crm.tabFeedback')], ['follow-ups', t('crm.tabFollowUps')],
    ['tags', t('crm.tabCustomerTags')],
  ];
  return (
    <div>
      <div className="mb-4">
        <p className="eyebrow mb-1">{t('crm.hubEyebrow')}</p>
        <p className="page-title">{t('crm.title')}</p>
        <p className="text-sm text-ink-muted mt-1">{t('crm.subtitle')}</p>
      </div>
      <div className="flex gap-1 border-b border-rule mb-5">
        {TABS.map(([key, label]) => (
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
  const { t } = useTranslation();
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
      toast(t('crm.sentViaProvider', { provider: result.campaign.provider, succeeded: result.campaign.successCount, failed: result.campaign.failureCount }), result.campaign.failureCount > 0 ? 'error' : 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      {can('crm.manage') && (
        <div className="flex justify-end mb-3">
          <button className="btn-primary" onClick={() => setShowForm(true)}>{t('crm.newCampaign')}</button>
        </div>
      )}
      {loading && <Loading />}
      {!loading && campaigns.length === 0 && <EmptyState title={t('crm.noCampaignsYet')} description={t('crm.noCampaignsDescription')} />}
      {!loading && campaigns.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-rule">
            <p className="font-display font-bold text-ink">{t('crm.campaignsLedger')}</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/50">
                <th className="px-3 py-2 font-medium">{t('crm.name')}</th>
                <th className="px-3 py-2 font-medium">{t('crm.channel')}</th>
                <th className="px-3 py-2 font-medium">{t('crm.targetTags')}</th>
                <th className="px-3 py-2 font-medium">{t('crm.status')}</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c._id} className="border-b border-rule last:border-0 hover:bg-accent-soft/30 transition-colors">
                  <td className="px-3 py-2">{c.name}</td>
                  <td className="px-3 py-2 uppercase text-xs text-ink-muted">{c.channel}</td>
                  <td className="px-3 py-2">{c.targetTags?.map((tg) => <span key={tg} className="chip-neutral mr-1">{tg}</span>) || t('crm.all')}</td>
                  <td className="px-3 py-2"><span className={c.status === 'sent' ? (c.failureCount > 0 ? 'chip-warning' : 'chip-accent') : 'chip-neutral'}>{c.status}{c.status === 'sent' ? ` (${c.successCount}/${c.recipientCount} ${t('crm.viaProviderSuffix', { provider: c.provider })})` : ''}</span></td>
                  <td className="px-3 py-2 text-right">
                    {c.status === 'draft' && can('crm.manage') && <button className="btn-ghost !text-accent" onClick={() => send(c._id)}>{t('crm.send')}</button>}
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
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', channel: 'sms', message: '', targetTags: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/crm/campaigns', {
        name: form.name, channel: form.channel, message: form.message,
        targetTags: form.targetTags ? form.targetTags.split(',').map((tg) => tg.trim()).filter(Boolean) : [],
      });
      toast(t('crm.campaignCreatedAsDraft'), 'success');
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
        <p className="font-display text-lg mb-4">{t('crm.newCampaign')}</p>
        <div className="space-y-3">
          <div><label className="field-label">{t('crm.name')}</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div>
            <label className="field-label">{t('crm.channel')}</label>
            <select className="field-input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
              <option value="sms">{t('crm.sms')}</option>
              <option value="email">{t('crm.email')}</option>
            </select>
          </div>
          <div><label className="field-label">{t('crm.targetTagsFieldLabel')}</label><input className="field-input" value={form.targetTags} onChange={(e) => setForm({ ...form, targetTags: e.target.value })} placeholder={t('crm.targetTagsPlaceholder')} /></div>
          <div><label className="field-label">{t('crm.message')}</label><textarea required rows={3} className="field-input" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
        </div>
        <p className="text-xs text-ink-muted mt-2">{t('crm.campaignSendingNote')}</p>
        <div className="flex justify-end gap-2 mt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('crm.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('crm.saving') : t('crm.saveDraft')}</button>
        </div>
      </form>
    </div>
  );
}

function FeedbackTab() {
  const { t } = useTranslation();
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
      toast(t('crm.markedResolved'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  if (loading) return <Loading />;
  if (rows.length === 0) return <EmptyState title={t('crm.noFeedbackLoggedYet')} />;

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-rule">
        <p className="font-display font-bold text-ink">{t('crm.feedbackLedger')}</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/50">
            <th className="px-3 py-2 font-medium">{t('crm.date')}</th>
            <th className="px-3 py-2 font-medium">{t('crm.rating')}</th>
            <th className="px-3 py-2 font-medium">{t('crm.comment')}</th>
            <th className="px-3 py-2 font-medium">{t('crm.status')}</th>
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
              <td className="px-3 py-2 text-right">{f.status !== 'resolved' && <button className="btn-ghost !text-accent" onClick={() => resolve(f._id)}>{t('crm.resolve')}</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FollowUpsTab() {
  const { t } = useTranslation();
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
      toast(t('crm.followUpCompleted'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  if (loading) return <Loading />;
  if (rows.length === 0) return <EmptyState title={t('crm.noPendingFollowUps')} />;

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-rule">
        <p className="font-display font-bold text-ink">{t('crm.followUpsLedger')}</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/50">
            <th className="px-3 py-2 font-medium">{t('crm.due')}</th>
            <th className="px-3 py-2 font-medium">{t('crm.note')}</th>
            <th className="px-3 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f._id} className="border-b border-rule last:border-0 hover:bg-accent-soft/30 transition-colors">
              <td className="px-3 py-2 text-ink-muted">{formatDate(f.dueDate)}</td>
              <td className="px-3 py-2">{f.note}</td>
              <td className="px-3 py-2 text-right"><button className="btn-ghost !text-accent" onClick={() => complete(f._id)}>{t('crm.markDone')}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TagsTab() {
  const { t } = useTranslation();
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
        <p className="font-display font-bold text-ink">{t('crm.customerTagsLedger')}</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/50">
            <th className="px-3 py-2 font-medium">{t('crm.customer')}</th>
            <th className="px-3 py-2 font-medium">{t('crm.tags')}</th>
            <th className="px-3 py-2 font-medium">{t('crm.addTag')}</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c._id} className="border-b border-rule last:border-0 hover:bg-accent-soft/30 transition-colors">
              <td className="px-3 py-2">{c.name}</td>
              <td className="px-3 py-2">{c.tags?.map((tg) => <span key={tg} className="chip-neutral mr-1">{tg}</span>)}</td>
              <td className="px-3 py-2">
                <div className="flex gap-1">
                  <input className="field-input !py-1 !text-xs w-28" value={newTag[c._id] || ''} onChange={(e) => setNewTag({ ...newTag, [c._id]: e.target.value })} placeholder={t('crm.tagPlaceholder')} />
                  <button className="btn-ghost !text-accent !text-xs" onClick={() => addTag(c._id)}>{t('crm.add')}</button>
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

const LEAD_STATUS_KEYS = {
  new: 'crm.leadStatusNew', contacted: 'crm.leadStatusContacted', qualified: 'crm.leadStatusQualified',
  unqualified: 'crm.leadStatusUnqualified', converted: 'crm.leadStatusConverted',
};

function LeadsTab() {
  const { t } = useTranslation();
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
      toast(t('crm.leadStatusUpdated'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <select className="field-input !w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">{t('crm.allStatuses')}</option>
          {['new', 'contacted', 'qualified', 'unqualified', 'converted'].map((s) => <option key={s} value={s}>{t(LEAD_STATUS_KEYS[s])}</option>)}
        </select>
        <button className="btn-primary" onClick={() => setShowForm(true)}>{t('crm.newLead')}</button>
      </div>
      {loading && <Loading />}
      {!loading && leads.length === 0 && <EmptyState title={t('crm.noLeadsYet')} description={t('crm.noLeadsDescription')} />}
      {!loading && leads.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-rule">
            <p className="font-display font-bold text-ink">{t('crm.leadsLedger')}</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/50">
                <th className="px-3 py-2 font-medium">{t('crm.name')}</th>
                <th className="px-3 py-2 font-medium">{t('crm.contact')}</th>
                <th className="px-3 py-2 font-medium">{t('crm.source')}</th>
                <th className="px-3 py-2 font-medium">{t('crm.status')}</th>
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
                      ? <span className="chip-accent">{t('crm.leadStatusConverted')}</span>
                      : (
                        <select className="field-input !py-1 !text-xs !w-32" value={l.status} onChange={(e) => changeStatus(l._id, e.target.value)}>
                          {['new', 'contacted', 'qualified', 'unqualified'].map((s) => <option key={s} value={s}>{t(LEAD_STATUS_KEYS[s])}</option>)}
                        </select>
                      )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {l.status !== 'converted' && can('crm.manage') && (
                      <button className="btn-ghost !text-accent" onClick={() => setConverting(l)}>{t('crm.convertToCustomer')}</button>
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
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', contactName: '', phone: '', email: '', source: 'website', notes: '' });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.name.trim()) return toast(t('crm.nameRequired'), 'error');
    setSaving(true);
    try {
      await api.post('/crm/leads', form);
      toast(t('crm.leadCreated'), 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">{t('crm.newLead')}</p>
        <div className="space-y-3">
          <div><label className="field-label">{t('crm.nameOrBusiness')}</label><input autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="field-label">{t('crm.contactPerson')}</label><input className="field-input" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="field-label">{t('crm.phone')}</label><input className="field-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className="field-label">{t('crm.email')}</label><input className="field-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div>
            <label className="field-label">{t('crm.source')}</label>
            <select className="field-input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              {['website', 'referral', 'walk-in', 'social', 'other'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><label className="field-label">{t('crm.notes')}</label><textarea rows={2} className="field-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-secondary" onClick={onClose}>{t('crm.cancel')}</button>
          <button className="btn-primary" disabled={saving} onClick={submit}>{saving ? t('crm.saving') : t('crm.createLead')}</button>
        </div>
      </div>
    </div>
  );
}

function ConvertLeadModal({ lead, onClose, onConverted }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({ name: lead.name, phone: lead.phone || '', email: lead.email || '', address: '' });
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await api.post(`/crm/leads/${lead._id}/convert`, form);
      toast(t('crm.leadConvertedToCustomer'), 'success');
      onConverted();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">{t('crm.convertLeadToCustomer')}</p>
        <div className="space-y-3">
          <div><label className="field-label">{t('crm.customerName')}</label><input autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="field-label">{t('crm.phone')}</label><input className="field-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className="field-label">{t('crm.email')}</label><input className="field-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div><label className="field-label">{t('crm.address')}</label><input className="field-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-secondary" onClick={onClose}>{t('crm.cancel')}</button>
          <button className="btn-primary" disabled={saving} onClick={submit}>{saving ? t('crm.converting') : t('crm.convert')}</button>
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
  const { t } = useTranslation();
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
      toast(t('crm.movedToStage', { stage: t(STAGE_LABEL_KEYS[stage]) }), 'success');
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
        <PipelineStat label={t('crm.openPipelineValue')} value={formatMoney(summary?.openPipelineValue, company?.currency)} icon="💰" trend="neutral" trendLabel={summary ? t('crm.periodDaysWindow', { days: summary.periodDays }) : ''} />
        <PipelineStat label={t('crm.winRateLabel', { days: summary?.periodDays ?? '' })} value={summary ? `${(summary.winRate * 100).toFixed(0)}%` : '-'} icon="🎯" trend={summary?.winRate >= 0.5 ? 'up' : 'down'} trendLabel={summary ? t('crm.wonThisPeriod', { count: summary.wonCount }) : ''} />
        <PipelineStat label={t('crm.wonDealsLabel', { days: summary?.periodDays ?? '' })} value={summary?.wonCount ?? 0} icon="🤝" trend="up" trendLabel={t('crm.closedWon')} />
        <PipelineStat label={t('crm.averageWonDealSize')} value={formatMoney(summary?.averageWonDealSize, company?.currency)} icon="📈" trend="neutral" trendLabel={t('crm.perClosedDeal')} />
      </div>

      {can('crm.manage') && (
        <div className="flex justify-end mb-3">
          <button className="btn-primary" onClick={() => setShowNewOpp(true)}>{t('crm.newOpportunity')}</button>
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
                    {t(STAGE_LABEL_KEYS[stage])} <span className="text-ink-muted normal-case tracking-normal font-medium">({deals.length})</span>
                  </p>
                </div>
                <p className="px-1 mb-2 text-xs num text-ink-muted">{t('crm.columnTotal', { amount: formatMoney(columnTotal, company?.currency) })}</p>
                <div className="space-y-2 min-h-[2rem]">
                  {deals.map((opp) => (
                    <div
                      key={opp._id}
                      className={`card p-3 ${can('crm.manage') && stage !== 'won' && stage !== 'lost' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                      draggable={can('crm.manage') && stage !== 'won' && stage !== 'lost'}
                      onDragStart={(e) => handleDragStart(e, opp)}
                    >
                      <p className="text-sm font-medium mb-1">{opp.title}</p>
                      <p className="text-xs text-ink-muted mb-1">{opp.customerId?.name || opp.leadId?.name || t('crm.unassigned')}</p>
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
                            <option value="">{t('crm.moveToPlaceholder')}</option>
                            {STAGES.filter((s) => s !== stage).map((s) => <option key={s} value={s}>{t(STAGE_LABEL_KEYS[s])}</option>)}
                          </select>
                          <button className="btn-ghost !text-accent !text-xs !px-1.5" title={t('crm.generateQuote')} onClick={() => setQuoting(opp)}>{t('crm.quote')}</button>
                        </div>
                      )}
                      {opp.quoteSaleId && stage !== 'won' && <p className="text-xs text-ink-muted mt-1">{t('crm.quoteGenerated')}</p>}
                      {stage === 'lost' && opp.lostReason && <p className="text-xs text-danger mt-1">{opp.lostReason}</p>}
                    </div>
                  ))}
                  {deals.length === 0 && <p className="text-xs text-ink-muted px-1 py-2">{t('crm.noDealsHere')}</p>}
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
  const { t } = useTranslation();
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
    if (!branchId || !warehouseId) return toast(t('crm.chooseBranchWarehouse'), 'error');
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
    if (items.length === 0) return toast(t('crm.addAtLeastOneProductLineQuote'), 'error');

    setSaving(true);
    try {
      await api.post(`/crm/opportunities/${opportunity._id}/quote`, { branchId, warehouseId, items });
      toast(t('crm.quoteGeneratedForOpportunity'), 'success');
      onDone();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-lg">
        <p className="font-display text-lg mb-1">{t('crm.generateQuoteFor', { title: opportunity.title })}</p>
        <p className="text-xs text-ink-muted mb-4">{t('crm.generateQuoteNote')}</p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="field-label">{t('crm.branch')}</label>
            <select className="field-input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">{t('crm.selectEllipsis')}</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('crm.warehouse')}</label>
            <select className="field-input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">{t('crm.selectEllipsis')}</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
        </div>

        <label className="field-label">{t('crm.items')}</label>
        <div className="space-y-2 mb-3">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-2">
              <select className="field-input flex-1" value={line.productId} onChange={(e) => updateLine(i, { productId: e.target.value })}>
                <option value="">{t('crm.selectProductEllipsis')}</option>
                {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              <input type="number" min="1" className="field-input w-20" placeholder={t('crm.qty')} value={line.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} />
              <input type="number" min="0" className="field-input w-28" placeholder={t('crm.unitPrice')} value={line.unitPrice} onChange={(e) => updateLine(i, { unitPrice: e.target.value })} />
              {lines.length > 1 && <button className="btn-ghost !text-danger" onClick={() => removeLine(i)}>&times;</button>}
            </div>
          ))}
        </div>
        <button className="btn-ghost !text-accent mb-4" onClick={addLine}>{t('crm.addAnotherItem')}</button>

        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>{t('crm.cancel')}</button>
          <button className="btn-primary" disabled={saving} onClick={submit}>{saving ? t('crm.generating') : t('crm.generateQuote')}</button>
        </div>
      </div>
    </div>
  );
}

// --- Sales automation rules ----------------------------------------------------

const TRIGGER_STAGE_OPTIONS = STAGES;

function AutomationTab() {
  const { t } = useTranslation();
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
      toast(t('crm.ruleDeleted'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <p className="text-sm text-ink-muted mb-3">{t('crm.automationDescription')}</p>
      {can('crm.manage') && (
        <div className="flex justify-end mb-3">
          <button className="btn-primary" onClick={() => setShowForm(true)}>{t('crm.newRule')}</button>
        </div>
      )}
      {loading && <Loading />}
      {!loading && rules.length === 0 && <EmptyState title={t('crm.noAutomationRulesYet')} description={t('crm.noAutomationRulesDescription')} />}
      {!loading && rules.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/50">
                <th className="px-3 py-2 font-medium">{t('crm.name')}</th>
                <th className="px-3 py-2 font-medium">{t('crm.whenStageBecomes')}</th>
                <th className="px-3 py-2 font-medium">{t('crm.then')}</th>
                <th className="px-3 py-2 font-medium">{t('crm.active')}</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r._id} className="border-b border-rule last:border-0 hover:bg-accent-soft/30 transition-colors">
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2"><span className="chip-neutral">{STAGE_LABEL_KEYS[r.trigger?.toStage] ? t(STAGE_LABEL_KEYS[r.trigger?.toStage]) : r.trigger?.toStage}</span></td>
                  <td className="px-3 py-2 text-ink-muted">{r.action?.type === 'send_email' ? t('crm.emailSubjectSummary', { subject: r.action.subject || t('crm.noSubject') }) : t('crm.taskNoteSummary', { note: r.action?.taskNote || t('crm.noNote') })}</td>
                  <td className="px-3 py-2">
                    {can('crm.manage')
                      ? <button className={r.active ? 'chip-accent' : 'chip-neutral'} onClick={() => toggleActive(r)}>{r.active ? t('crm.active') : t('crm.paused')}</button>
                      : <span className={r.active ? 'chip-accent' : 'chip-neutral'}>{r.active ? t('crm.active') : t('crm.paused')}</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {can('crm.manage') && <button className="btn-ghost !text-danger" onClick={() => remove(r._id)}>{t('crm.delete')}</button>}
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
  const { t } = useTranslation();
  const toast = useToast();
  const ACTION_TYPES = [['send_email', t('crm.actionSendEmail')], ['create_task', t('crm.actionCreateTask')]];
  const [form, setForm] = useState({
    name: '', toStage: 'proposal', actionType: 'send_email',
    subject: '', message: '', taskNote: '', taskDueInDays: 3,
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.name.trim()) return toast(t('crm.ruleNameRequired'), 'error');
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
      toast(t('crm.automationRuleCreated'), 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">{t('crm.newAutomationRule')}</p>
        <div className="space-y-3">
          <div><label className="field-label">{t('crm.ruleName')}</label><input autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('crm.ruleNamePlaceholder')} /></div>
          <div>
            <label className="field-label">{t('crm.whenDealStageBecomes')}</label>
            <select className="field-input" value={form.toStage} onChange={(e) => setForm({ ...form, toStage: e.target.value })}>
              {TRIGGER_STAGE_OPTIONS.map((s) => <option key={s} value={s}>{t(STAGE_LABEL_KEYS[s])}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('crm.then')}</label>
            <select className="field-input" value={form.actionType} onChange={(e) => setForm({ ...form, actionType: e.target.value })}>
              {ACTION_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {form.actionType === 'send_email' ? (
            <>
              <div><label className="field-label">{t('crm.emailSubject')}</label><input className="field-input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder={t('crm.emailSubjectPlaceholder')} /></div>
              <div><label className="field-label">{t('crm.emailMessage')}</label><textarea rows={3} className="field-input" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder={t('crm.emailMessagePlaceholder')} /></div>
              <p className="text-xs text-ink-muted">{t('crm.placeholders')}: {'{{title}}'}, {'{{customerName}}'}, {'{{estimatedValue}}'}, {'{{stage}}'}.</p>
            </>
          ) : (
            <>
              <div><label className="field-label">{t('crm.taskNote')}</label><input className="field-input" value={form.taskNote} onChange={(e) => setForm({ ...form, taskNote: e.target.value })} placeholder={t('crm.taskNotePlaceholder')} /></div>
              <div><label className="field-label">{t('crm.dueInDays')}</label><input type="number" min="0" className="field-input" value={form.taskDueInDays} onChange={(e) => setForm({ ...form, taskDueInDays: e.target.value })} /></div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-secondary" onClick={onClose}>{t('crm.cancel')}</button>
          <button className="btn-primary" disabled={saving} onClick={submit}>{saving ? t('crm.saving') : t('crm.createRule')}</button>
        </div>
      </div>
    </div>
  );
}

function NewOpportunityModal({ onClose, onSaved }) {
  const { t } = useTranslation();
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
    if (!form.title.trim()) return toast(t('crm.titleRequired'), 'error');
    if (!form.estimatedValue || Number(form.estimatedValue) < 0) return toast(t('crm.enterValidEstimatedValue'), 'error');
    if (form.source === 'lead' && !form.leadId) return toast(t('crm.selectALead'), 'error');
    if (form.source === 'customer' && !form.customerId) return toast(t('crm.selectACustomer'), 'error');
    setSaving(true);
    try {
      await api.post('/crm/opportunities', {
        title: form.title,
        estimatedValue: Number(form.estimatedValue),
        leadId: form.source === 'lead' ? form.leadId : undefined,
        customerId: form.source === 'customer' ? form.customerId : undefined,
        expectedCloseDate: form.expectedCloseDate || undefined,
      });
      toast(t('crm.opportunityCreated'), 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">{t('crm.newOpportunity')}</p>
        <div className="space-y-3">
          <div><label className="field-label">{t('crm.opportunityTitle')}</label><input autoFocus className="field-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><label className="field-label">{t('crm.estimatedValue')}</label><input type="number" min="0" className="field-input" value={form.estimatedValue} onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })} /></div>
          <div>
            <label className="field-label">{t('crm.linkedTo')}</label>
            <select className="field-input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              <option value="lead">{t('crm.linkedToLead')}</option>
              <option value="customer">{t('crm.linkedToCustomer')}</option>
            </select>
          </div>
          {form.source === 'lead' ? (
            <div>
              <label className="field-label">{t('crm.lead')}</label>
              <select className="field-input" value={form.leadId} onChange={(e) => setForm({ ...form, leadId: e.target.value })}>
                <option value="">{t('crm.selectEllipsis')}</option>
                {leads.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="field-label">{t('crm.customer')}</label>
              <select className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
                <option value="">{t('crm.selectEllipsis')}</option>
                {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div><label className="field-label">{t('crm.expectedCloseDate')}</label><input type="date" className="field-input" value={form.expectedCloseDate} onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-secondary" onClick={onClose}>{t('crm.cancel')}</button>
          <button className="btn-primary" disabled={saving} onClick={submit}>{saving ? t('crm.saving') : t('crm.createOpportunity')}</button>
        </div>
      </div>
    </div>
  );
}

function LoseOpportunityModal({ opportunity, onClose, onDone }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!reason.trim()) return toast(t('crm.reasonRequired'), 'error');
    setSaving(true);
    try {
      await api.post(`/crm/opportunities/${opportunity._id}/stage`, { stage: 'lost', lostReason: reason });
      toast(t('crm.opportunityMarkedLost'), 'success');
      onDone();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">{t('crm.markOpportunityAsLost', { title: opportunity.title })}</p>
        <label className="field-label">{t('crm.reason')}</label>
        <textarea autoFocus rows={3} className="field-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('crm.lostReasonPlaceholder')} />
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-secondary" onClick={onClose}>{t('crm.cancel')}</button>
          <button className="btn-primary" disabled={saving} onClick={submit}>{saving ? t('crm.saving') : t('crm.markLost')}</button>
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
  const { t } = useTranslation();
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
    if (!branchId || !warehouseId) return toast(t('crm.chooseBranchWarehouse'), 'error');
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
    if (items.length === 0) return toast(t('crm.addAtLeastOneProductLineQuotation'), 'error');

    setSaving(true);
    try {
      await api.post(`/crm/opportunities/${opportunity._id}/stage`, { stage: 'won', branchId, warehouseId, items });
      toast(t('crm.opportunityWonQuotationCreated'), 'success');
      onDone();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-lg">
        <p className="font-display text-lg mb-1">{t('crm.winOpportunity', { title: opportunity.title })}</p>
        <p className="text-xs text-ink-muted mb-4">{t('crm.winOpportunityNote')}</p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="field-label">{t('crm.branch')}</label>
            <select className="field-input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">{t('crm.selectEllipsis')}</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('crm.warehouse')}</label>
            <select className="field-input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">{t('crm.selectEllipsis')}</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
        </div>

        <label className="field-label">{t('crm.items')}</label>
        <div className="space-y-2 mb-3">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-2">
              <select className="field-input flex-1" value={line.productId} onChange={(e) => updateLine(i, { productId: e.target.value })}>
                <option value="">{t('crm.selectProductEllipsis')}</option>
                {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              <input type="number" min="1" className="field-input w-20" placeholder={t('crm.qty')} value={line.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} />
              <input type="number" min="0" className="field-input w-28" placeholder={t('crm.unitPrice')} value={line.unitPrice} onChange={(e) => updateLine(i, { unitPrice: e.target.value })} />
              {lines.length > 1 && <button className="btn-ghost !text-danger" onClick={() => removeLine(i)}>&times;</button>}
            </div>
          ))}
        </div>
        <button className="btn-ghost !text-accent mb-4" onClick={addLine}>{t('crm.addAnotherItem')}</button>

        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>{t('crm.cancel')}</button>
          <button className="btn-primary" disabled={saving} onClick={submit}>{saving ? t('crm.saving') : t('crm.markWonCreateQuotation')}</button>
        </div>
      </div>
    </div>
  );
}
