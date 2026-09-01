import { useEffect, useState } from 'react';
import { Plus, Eye, EyeOff, Power, RotateCw, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';

function webhookUrlFor(token) {
  const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');
  return `${base}/sales-channels/webhook/${token}`;
}

export function EcommerceHubPage() {
  const { t } = useTranslation();
  const CHANNEL_TYPES = [
    { value: 'shopify', label: 'Shopify' },
    { value: 'woocommerce', label: 'WooCommerce' },
    { value: 'daraz', label: 'Daraz' },
    { value: 'custom_website', label: t('ecommerceHub.customWebsite') },
    { value: 'marketplace_other', label: t('ecommerceHub.otherMarketplace') },
  ];
  const toast = useToast();
  const [channels, setChannels] = useState(null);
  const [analytics, setAnalytics] = useState([]);
  const [form, setForm] = useState({ name: '', channelType: 'shopify' });
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState({}); // channelId -> bool, show token/url

  function load() {
    api.get('/sales-channels').then(setChannels).catch((err) => toast(err.message, 'error'));
    api.get('/sales-channels/analytics').then(setAnalytics).catch(() => {});
  }
  useEffect(load, []);

  async function createChannel(e) {
    e.preventDefault();
    if (!form.name.trim()) return toast(t('ecommerceHub.channelNameRequired'), 'error');
    setBusy(true);
    try {
      await api.post('/sales-channels', form);
      toast(t('ecommerceHub.channelCreated'), 'success');
      setForm({ name: '', channelType: 'shopify' });
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id) {
    try {
      await api.post(`/sales-channels/${id}/toggle`);
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function regenerate(id) {
    if (!window.confirm(t('ecommerceHub.regenerateConfirm'))) return;
    try {
      const updated = await api.post(`/sales-channels/${id}/regenerate-token`);
      toast(t('ecommerceHub.webhookTokenRegenerated'), 'success');
      setRevealed((r) => ({ ...r, [updated._id]: true }));
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  function copy(text) {
    navigator.clipboard?.writeText(text);
    toast(t('ecommerceHub.copied'), 'success');
  }

  if (!channels) return <Loading />;

  const analyticsByChannel = Object.fromEntries(analytics.map((a) => [String(a.channelId), a]));

  return (
    <div>
      <div className="mb-6">
        <p className="eyebrow mb-1">{t('ecommerceHub.salesChannels')}</p>
        <p className="page-title mb-1">{t('ecommerceHub.title')}</p>
        <p className="text-sm text-ink-muted max-w-2xl">
          {t('ecommerceHub.subtitle')} <strong className="text-ink">E-commerce</strong>.
        </p>
      </div>

      <form onSubmit={createChannel} className="card p-4 mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="field-label">{t('ecommerceHub.channelName')}</label>
          <input
            className="field-input"
            placeholder={t('ecommerceHub.channelNamePlaceholder')}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="field-label">{t('ecommerceHub.type')}</label>
          <select
            className="field-input"
            value={form.channelType}
            onChange={(e) => setForm((f) => ({ ...f, channelType: e.target.value }))}
          >
            {CHANNEL_TYPES.map((ct) => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
          </select>
        </div>
        <button className="btn-primary" type="submit" disabled={busy}>
          <Plus size={16} /> {t('ecommerceHub.addChannel')}
        </button>
      </form>

      <div className="grid gap-4 mb-8">
        {channels.length === 0 && <p className="text-sm text-ink-muted">{t('ecommerceHub.noChannelsYet')}</p>}
        {channels.map((c) => (
          <div key={c._id} className="card p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-display font-bold text-ink">{c.name}</p>
                <p className="text-xs text-ink-muted mt-1 flex items-center gap-2 flex-wrap">
                  <span className="chip-neutral">{CHANNEL_TYPES.find((ct) => ct.value === c.channelType)?.label || c.channelType}</span>
                  {c.isActive ? <span className="chip-accent">{t('ecommerceHub.active')}</span> : <span className="chip-neutral">{t('ecommerceHub.disabled')}</span>}
                  <span className="num">{c.ordersReceivedCount} {t('ecommerceHub.ordersReceived')}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary !px-2.5 !py-1.5 text-xs" onClick={() => setRevealed((r) => ({ ...r, [c._id]: !r[c._id] }))}>
                  {revealed[c._id] ? <EyeOff size={14} /> : <Eye size={14} />}
                  {revealed[c._id] ? t('ecommerceHub.hideWebhook') : t('ecommerceHub.showWebhook')}
                </button>
                <button className="btn-secondary !px-2.5 !py-1.5 text-xs" onClick={() => toggle(c._id)}>
                  <Power size={14} /> {c.isActive ? t('ecommerceHub.disable') : t('ecommerceHub.enable')}
                </button>
                <button className="btn-secondary !px-2.5 !py-1.5 text-xs" onClick={() => regenerate(c._id)}>
                  <RotateCw size={14} /> {t('ecommerceHub.regenerateToken')}
                </button>
              </div>
            </div>
            {revealed[c._id] && (
              <div className="mt-3 pt-3 border-t border-rule text-xs space-y-2">
                <div className="flex items-center gap-2 bg-surface-sunken border border-rule-strong rounded-lg p-2.5">
                  <span className="text-ink-muted shrink-0">{t('ecommerceHub.webhookUrl')}</span>
                  <code className="num flex-1 truncate text-ink">{webhookUrlFor(c.webhookToken)}</code>
                  <button className="btn-ghost !text-accent !px-2 !py-1 text-xs shrink-0" onClick={() => copy(webhookUrlFor(c.webhookToken))}>
                    <Copy size={13} /> {t('ecommerceHub.copy')}
                  </button>
                </div>
                <div className="flex items-center gap-2 bg-surface-sunken border border-rule-strong rounded-lg p-2.5">
                  <span className="text-ink-muted shrink-0">{t('ecommerceHub.token')}</span>
                  <code className="num flex-1 truncate text-ink">{c.webhookToken}</code>
                  <button className="btn-ghost !text-accent !px-2 !py-1 text-xs shrink-0" onClick={() => copy(c.webhookToken)}>
                    <Copy size={13} /> {t('ecommerceHub.copy')}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-rule">
          <p className="font-display font-bold text-ink">{t('ecommerceHub.channelAnalytics')}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/50">
                <th className="px-3 py-2 font-medium">{t('ecommerceHub.channel')}</th>
                <th className="px-3 py-2 font-medium text-right">{t('ecommerceHub.ordersReceived')}</th>
                <th className="px-3 py-2 font-medium text-right">{t('ecommerceHub.processed')}</th>
                <th className="px-3 py-2 font-medium text-right">{t('ecommerceHub.failed')}</th>
                <th className="px-3 py-2 font-medium text-right">{t('ecommerceHub.revenue')}</th>
              </tr>
            </thead>
            <tbody>
              {analytics.map((a) => (
                <tr key={a.channelId} className="border-b border-rule last:border-0 hover:bg-accent-soft/30 transition-colors">
                  <td className="px-3 py-2">{a.name}</td>
                  <td className="px-3 py-2 text-right num">{a.ordersReceived}</td>
                  <td className="px-3 py-2 text-right num">{a.ordersProcessed}</td>
                  <td className="px-3 py-2 text-right num">{a.ordersFailed}</td>
                  <td className="px-3 py-2 text-right num">{a.revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                </tr>
              ))}
              {analytics.length === 0 && (
                <tr><td colSpan={5} className="text-center text-ink-muted py-6">{t('ecommerceHub.noDataYet')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
