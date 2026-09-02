import { useEffect, useState } from 'react';
import { Send, Star, AlertTriangle } from 'lucide-react';
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
        <p className="eyebrow mb-1">Marketing</p>
        <div className="flex items-center justify-between">
          <p className="page-title">Reputation</p>
          <button className="btn-primary" onClick={() => setShowSend(true)}>
            <Send size={16} /> Send review request
          </button>
        </div>
        <p className="text-sm text-ink-muted mt-1">
          Ask customers to rate their experience. Positive ratings (4-5★) can be flagged as shareable; low ratings automatically show up below for follow-up.
          Note: this does not post anything to Google/Facebook/etc — there's no real review-platform integration wired up here.
        </p>
      </div>

      {followUps.length > 0 && (
        <div className="card p-4 mb-4 border-l-4 border-warning">
          <p className="font-display font-semibold text-ink flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-warning" /> Needs follow-up ({followUps.length})
          </p>
          <div className="grid gap-2">
            {followUps.map((r) => (
              <div key={r._id} className="flex items-center justify-between text-sm bg-surface-sunken rounded-lg px-3 py-2">
                <div>
                  <span className="font-medium">{r.customerId?.name || 'Customer'}</span>
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
          title="No review requests yet"
          description="Send a customer a link to rate their experience after a purchase."
          action={<button className="btn-primary" onClick={() => setShowSend(true)}>Send your first request</button>}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/60">
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Rating</th>
                  <th className="px-4 py-3 font-semibold">Shared publicly</th>
                  <th className="px-4 py-3 font-semibold">Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {requests.map((r) => (
                  <tr key={r._id}>
                    <td className="px-4 py-3 font-medium">{r.customerId?.name || '—'}</td>
                    <td className="px-4 py-3"><span className={STATUS_CHIP[r.status]}>{r.status}</span></td>
                    <td className="px-4 py-3"><StarRow rating={r.rating} /></td>
                    <td className="px-4 py-3">{r.sharedPublicly ? <span className="chip-accent">Yes</span> : <span className="text-xs text-ink-muted">No</span>}</td>
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
      toast('Review request sent.', 'success');
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
        <p className="font-display text-lg font-semibold text-ink mb-4">Send review request</p>
        <label className="field-label">Customer</label>
        <select required autoFocus className="field-input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Select…</option>
          {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <p className="text-xs text-ink-muted mt-2">Sent by email/SMS via whatever provider is configured — logs to the console if none is set up.</p>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving || !customerId} className="btn-primary">{saving ? 'Sending…' : 'Send'}</button>
        </div>
      </form>
    </div>
  );
}
