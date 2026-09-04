import { useEffect, useState } from 'react';
import { Send, Star, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

const STATUS_CHIP = { pending: 'chip-neutral', sent: 'chip-info', responded: 'chip-accent' };

function StarRow({ rating }) {
  if (!rating) return <span className="text-xs text-ink-muted">—</span>;
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={13} className={n <= rating ? 'text-warning fill-warning' : 'text-rule'} />
      ))}
    </span>
  );
}

export function ReputationPage() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState(null);
  const [followUps, setFollowUps] = useState([]);
  const [showSend, setShowSend] = useState(false);
  const toast = useToast();

  function load() {
    api.get('/review-requests').then(setRequests).catch((err) => toast(err.message, 'error'));
    api.get('/review-requests/needs-follow-up').then(setFollowUps).catch(() => {});
  }
  useEffect(load, []);

  return (
    <div>
      <div className="mb-4">
        <p className="eyebrow mb-1">{t('reputation.marketing')}</p>
        <div className="flex items-center justify-between">
          <p className="page-title">{t('reputation.title')}</p>
          <button className="btn-primary" onClick={() => setShowSend(true)}>
            <Send size={16} /> {t('reputation.sendReviewRequest')}
          </button>
        </div>
        <p className="text-sm text-ink-muted mt-1">
          {t('reputation.subtitle')}
        </p>
      </div>

      {followUps.length > 0 && (
        <div className="card p-4 mb-4 border-l-4 border-warning">
          <p className="font-display font-semibold text-ink flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-warning" /> {t('reputation.needsFollowUp', { count: followUps.length })}
          </p>
          <div className="grid gap-2">
            {followUps.map((r) => (
              <div key={r._id} className="flex items-center justify-between text-sm bg-surface-sunken rounded-lg px-3 py-2">
                <div>
                  <span className="font-medium">{r.customerId?.name || t('reputation.customer')}</span>
                  {r.feedback && <span className="text-ink-muted"> — "{r.feedback}"</span>}
                </div>
                <StarRow rating={r.rating} />
              </div>
            ))}
          </div>
        </div>
      )}

      {requests === null ? (
        <Loading />
      ) : requests.length === 0 ? (
        <EmptyState
          title={t('reputation.noRequestsYet')}
          description={t('reputation.noRequestsDescription')}
          action={<button className="btn-primary" onClick={() => setShowSend(true)}>{t('reputation.sendFirstRequest')}</button>}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/60">
                  <th className="px-4 py-3 font-semibold">{t('reputation.customer')}</th>
                  <th className="px-4 py-3 font-semibold">{t('reputation.status')}</th>
                  <th className="px-4 py-3 font-semibold">{t('reputation.rating')}</th>
                  <th className="px-4 py-3 font-semibold">{t('reputation.sharedPublicly')}</th>
                  <th className="px-4 py-3 font-semibold">{t('reputation.sent')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {requests.map((r) => (
                  <tr key={r._id}>
                    <td className="px-4 py-3 font-medium">{r.customerId?.name || '—'}</td>
                    <td className="px-4 py-3"><span className={STATUS_CHIP[r.status]}>{r.status}</span></td>
                    <td className="px-4 py-3"><StarRow rating={r.rating} /></td>
                    <td className="px-4 py-3">{r.sharedPublicly ? <span className="chip-accent">{t('reputation.yes')}</span> : <span className="text-xs text-ink-muted">{t('reputation.no')}</span>}</td>
                    <td className="px-4 py-3 text-xs text-ink-muted num">{r.sentAt ? formatDate(r.sentAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showSend && <SendReviewRequest onClose={() => setShowSend(false)} onSent={() => { setShowSend(false); load(); }} />}
    </div>
  );
}

function SendReviewRequest({ onClose, onSent }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/customers').then(setCustomers).catch(() => {}); }, []);

  async function send(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/review-requests', { customerId });
      toast(t('reputation.requestSent'), 'success');
      onSent();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={send} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg font-semibold text-ink mb-4">{t('reputation.sendReviewRequest')}</p>
        <label className="field-label">{t('reputation.customer')}</label>
        <select required autoFocus className="field-input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">{t('reputation.selectPlaceholder')}</option>
          {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <p className="text-xs text-ink-muted mt-2">{t('reputation.sendMethodHint')}</p>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('reputation.cancel')}</button>
          <button type="submit" disabled={saving || !customerId} className="btn-primary">{saving ? t('reputation.sending') : t('reputation.send')}</button>
        </div>
      </form>
    </div>
  );
}
