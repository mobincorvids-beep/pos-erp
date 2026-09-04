import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { formatDate } from '../lib/format';

export function DeveloperPlatformPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('keys');

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 text-xs text-ink-muted mb-2">
        <span className="material-symbols-outlined text-sm">settings</span>
        <span className="font-semibold">{t('developerPlatform.settings')}</span>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <span className="font-semibold text-accent">{t('developerPlatform.apiIntegrations')}</span>
      </div>
      <p className="page-title mb-1 flex items-center gap-2">
        <span className="material-symbols-outlined text-3xl text-accent">hub</span>
        {t('developerPlatform.title')}
      </p>
      <p className="text-sm text-ink-muted mb-5">{t('developerPlatform.subtitle')}</p>

      <div className="flex border-b border-rule mb-5">
        {[['keys', t('developerPlatform.tabApiKeys')], ['webhooks', t('developerPlatform.tabWebhooks')]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 transition-colors ${tab === key ? 'border-accent text-accent-strong font-semibold' : 'border-transparent text-ink-muted hover:text-ink'}`}>{label}</button>
        ))}
      </div>

      {tab === 'keys' ? <ApiKeysSection /> : <WebhooksSection />}
    </div>
  );
}

function ApiKeysSection() {
  const { t } = useTranslation();
  const toast = useToast();
  const [keys, setKeys] = useState(null);
  const [availableScopes, setAvailableScopes] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createdKey, setCreatedKey] = useState(null); // { rawKey, name, ... } — shown once
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState([]);
  const [busy, setBusy] = useState(false);

  function load() {
    api.get('/developer/api-keys').then(setKeys).catch((err) => toast(err.message, 'error'));
    api.get('/developer/api-keys/scopes').then(setAvailableScopes).catch(() => {});
  }
  useEffect(load, []);

  function toggleScope(scope) {
    setSelectedScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  }

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await api.post('/developer/api-keys', { name, scopes: selectedScopes });
      setCreatedKey(result);
      setShowCreate(false);
      setName('');
      setSelectedScopes([]);
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id) {
    if (!confirm(t('developerPlatform.confirmRevokeKey'))) return;
    try {
      await api.post(`/developer/api-keys/${id}/revoke`, {});
      toast(t('developerPlatform.apiKeyRevoked'), 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(createdKey.rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast(t('developerPlatform.couldNotCopy'), 'error');
    }
  }

  return (
    <div className="space-y-4">
      {createdKey && (
        <div className="card p-5 border-2 border-danger">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-danger">warning</span>
            <p className="text-sm font-semibold text-danger">{t('developerPlatform.copyKeyNowWarning')}</p>
          </div>
          <p className="text-xs text-ink-muted mt-1 mb-3">{t('developerPlatform.keyCreatedNote', { name: createdKey.name })}</p>
          <div className="flex items-center gap-2 bg-surface-sunken border border-rule-strong rounded-lg p-3 num text-sm break-all">
            <span className="flex-1">{createdKey.rawKey}</span>
            <button className="btn-secondary shrink-0" onClick={copyKey}>
              <span className="material-symbols-outlined text-[18px]">{copied ? 'check' : 'content_copy'}</span>
              {copied ? t('developerPlatform.copied') : t('developerPlatform.copy')}
            </button>
          </div>
          <button className="btn-ghost mt-3" onClick={() => setCreatedKey(null)}>{t('developerPlatform.savedThisKey')}</button>
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="font-display text-lg font-bold text-accent flex items-center gap-2">
              <span className="material-symbols-outlined">key</span> {t('developerPlatform.apiKeys')}
            </p>
            <p className="text-sm text-ink-muted mt-0.5">{t('developerPlatform.apiKeysDescription')}</p>
          </div>
          <button className="btn-primary shrink-0" onClick={() => setShowCreate((v) => !v)}>
            <span className="material-symbols-outlined text-[18px]">add</span> {t('developerPlatform.newKey')}
          </button>
        </div>

        {showCreate && (
          <form onSubmit={create} className="border-t border-rule pt-4 mb-4 space-y-3">
            <div>
              <label className="field-label">{t('developerPlatform.name')}</label>
              <input required autoFocus placeholder={t('developerPlatform.namePlaceholder')} className="field-input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="field-label">{t('developerPlatform.scopes')}</label>
              <div className="flex flex-wrap gap-2">
                {availableScopes.map((scope) => (
                  <label key={scope} className={`chip cursor-pointer border ${selectedScopes.includes(scope) ? 'bg-accent-soft text-accent-strong border-accent' : 'bg-surface text-ink-muted border-rule-strong'}`}>
                    <input type="checkbox" className="sr-only" checked={selectedScopes.includes(scope)} onChange={() => toggleScope(scope)} />
                    {scope}
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={busy || selectedScopes.length === 0}>{t('developerPlatform.createKey')}</button>
          </form>
        )}

        {!keys && <Loading />}
        {keys?.length === 0 && <p className="text-sm text-ink-muted">{t('developerPlatform.noApiKeysYet')}</p>}
        <div className="space-y-3">
          {keys?.map((k) => (
            <div key={k.id} className="p-3 border border-rule rounded-lg bg-surface">
              <div className="flex justify-between items-center mb-2 gap-2">
                <span className="text-sm font-semibold text-accent truncate">{k.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {k.revokedAt && <span className="chip-danger">{t('developerPlatform.revoked')}</span>}
                  {!k.revokedAt && <button className="btn-ghost !text-danger !px-2 !py-1 text-xs" onClick={() => revoke(k.id)}>{t('developerPlatform.revoke')}</button>}
                </div>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <input aria-label={t('developerPlatform.apiKeyPrefixLabel')} readOnly value={`${k.keyPrefix}••••••••••••••••••`} className="flex-1 bg-surface-sunken border border-rule-strong rounded px-2 py-1.5 num text-sm text-ink" />
                <span className="chip-neutral shrink-0">{k.scopes.join(', ') || t('developerPlatform.noScopes')}</span>
              </div>
              <div className="text-xs text-ink-muted flex justify-between">
                <span>{t('developerPlatform.createdOn', { date: formatDate(k.createdAt) })}</span>
                <span>{t('developerPlatform.lastUsed', { date: k.lastUsedAt ? formatDate(k.lastUsedAt) : t('developerPlatform.never') })}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WebhooksSection() {
  const { t } = useTranslation();
  const toast = useToast();
  const [subs, setSubs] = useState(null);
  const [availableEvents, setAvailableEvents] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [url, setUrl] = useState('');
  const [event, setEvent] = useState('');
  const [busy, setBusy] = useState(false);

  function load() {
    api.get('/developer/webhooks').then(setSubs).catch((err) => toast(err.message, 'error'));
    api.get('/developer/webhooks/events').then(setAvailableEvents).catch(() => {});
  }
  useEffect(load, []);

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/developer/webhooks', { url, event });
      toast(t('developerPlatform.webhookSubscriptionCreated'), 'success');
      setShowCreate(false);
      setUrl('');
      setEvent('');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!confirm(t('developerPlatform.confirmDeleteWebhook'))) return;
    try {
      await api.del(`/developer/webhooks/${id}`);
      toast(t('developerPlatform.webhookSubscriptionDeleted'), 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="font-display text-lg font-bold text-accent flex items-center gap-2">
            <span className="material-symbols-outlined">webhook</span> {t('developerPlatform.webhookSubscriptions')}
          </p>
          <p className="text-sm text-ink-muted mt-0.5">{t('developerPlatform.webhookSubscriptionsDescription')}</p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setShowCreate((v) => !v)}>
          <span className="material-symbols-outlined text-[18px]">add</span> {t('developerPlatform.newSubscription')}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={create} className="border-t border-rule pt-4 mb-4 space-y-3 max-w-md">
          <div>
            <label className="field-label">{t('developerPlatform.targetUrl')}</label>
            <input required type="url" placeholder="https://example.com/webhooks/pos" className="field-input" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div>
            <label className="field-label">{t('developerPlatform.event')}</label>
            <select required className="field-input" value={event} onChange={(e) => setEvent(e.target.value)}>
              <option value="" disabled>{t('developerPlatform.selectAnEvent')}</option>
              {availableEvents.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
            </select>
          </div>
          <button type="submit" className="btn-primary" disabled={busy}>{t('developerPlatform.createSubscription')}</button>
        </form>
      )}

      {!subs && <Loading />}
      {subs?.length === 0 && <p className="text-sm text-ink-muted">{t('developerPlatform.noWebhookSubscriptionsYet')}</p>}
      {subs?.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-rule text-ink-muted eyebrow">
                <th className="pb-3 font-semibold">{t('developerPlatform.eventTrigger')}</th>
                <th className="pb-3 font-semibold">{t('developerPlatform.targetUrl')}</th>
                <th className="pb-3 font-semibold text-right">{t('developerPlatform.status')}</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {subs?.map((s) => (
                <tr key={s._id} className="border-b border-rule last:border-0 hover:bg-surface-sunken/50 transition-colors align-top">
                  <td className="py-3 font-medium text-accent whitespace-nowrap">{s.event}</td>
                  <td className="py-3 text-ink-muted">
                    <p className="truncate max-w-[220px]">{s.url}</p>
                    <p className="text-xs text-ink-muted/80 mt-0.5">
                      {t('developerPlatform.lastStatus', { status: s.lastStatus || t('developerPlatform.neverTriggered') })}
                      {s.lastTriggeredAt && <> · {formatDate(s.lastTriggeredAt)}</>}
                    </p>
                  </td>
                  <td className="py-3 text-right whitespace-nowrap">
                    {s.isActive ? <span className="chip-accent">{t('developerPlatform.active')}</span> : <span className="chip-neutral">{t('developerPlatform.inactive')}</span>}
                  </td>
                  <td className="py-3 pl-3 text-right">
                    <button className="btn-ghost !text-danger !px-2 !py-1 text-xs" onClick={() => remove(s._id)}>{t('developerPlatform.delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
