import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';

const OUTCOME_CHIP = { order_placed: 'chip-accent', no_order: 'chip-warning', closed: 'chip-neutral', other: 'chip-neutral' };

/**
 * Self-service "today's route" for a field sales rep — same self-service
 * pattern as MyAttendancePage.jsx: resolves "which employee" server-side
 * from the logged-in user, never from anything picked here. Lists the
 * shops assigned to this rep (Customer.salesRepId) and lets them log a
 * visit outcome for each.
 */
export function MyRoutePage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(null); // customer being logged

  function load() {
    setLoading(true);
    api.get('/route-sales/me').then(setRoute).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  if (loading) return <Loading />;

  if (!route) return null;

  if (!route.employee) {
    return <EmptyState title={t('myRoute.noEmployeeTitle', 'No employee record linked')} description={t('myRoute.noEmployeeDescription', 'Ask an admin to link your login to an Employee record to see your route.')} />;
  }

  return (
    <div>
      <p className="eyebrow mb-1">{t('myRoute.eyebrow', 'Van sales')}</p>
      <p className="page-title mb-1">{t('myRoute.title', "Today's Route")}</p>
      <p className="text-sm text-ink-muted mb-5">{t('myRoute.subtitle', '{{count}} shop(s) assigned to you', { count: route.customers.length })}</p>

      {route.customers.length === 0 && (
        <EmptyState title={t('myRoute.emptyTitle', 'No shops assigned yet')} description={t('myRoute.emptyDescription', 'Ask an admin to assign customers to your route from the Customers page.')} />
      )}

      <div className="space-y-2">
        {route.customers.map((c) => (
          <div key={c._id} className="card p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-ink truncate">{c.name}</p>
                {c.route && <span className="chip-neutral">{c.route}</span>}
                {c.visitedToday && <span className="chip-accent">{t('myRoute.visitedToday', 'Visited today')}</span>}
              </div>
              <p className="text-xs text-ink-muted truncate">{c.address || c.phone || '—'}</p>
            </div>
            <button className="btn-secondary shrink-0" onClick={() => setLogging(c)}>{t('myRoute.logVisit', 'Log visit')}</button>
          </div>
        ))}
      </div>

      {route.visitsToday?.length > 0 && (
        <>
          <p className="text-sm font-semibold mt-6 mb-2">{t('myRoute.visitsLoggedToday', 'Visits logged today')}</p>
          <div className="space-y-1.5 text-sm">
            {route.visitsToday.map((v) => (
              <div key={v._id} className="flex items-center justify-between">
                <span className="text-ink-muted">{new Date(v.visitedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span className={OUTCOME_CHIP[v.outcome] || 'chip-neutral'}>{v.outcome.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {logging && <LogVisitModal customer={logging} onClose={() => setLogging(null)} onLogged={() => { setLogging(null); load(); }} />}
    </div>
  );
}

function LogVisitModal({ customer, onClose, onLogged }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [outcome, setOutcome] = useState('order_placed');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/route-sales/visits', { customerId: customer._id, outcome, note });
      toast(t('myRoute.visitLogged', 'Visit logged.'), 'success');
      onLogged();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 backdrop-blur-[2px] flex items-center justify-center z-40 px-4">
      <form onSubmit={submit} className="card p-6 w-full max-w-sm">
        <p className="eyebrow mb-1">{t('myRoute.logVisit', 'Log visit')}</p>
        <p className="font-display text-lg font-semibold mb-4">{customer.name}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('myRoute.outcome', 'Outcome')}</label>
            <select className="field-input" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              <option value="order_placed">{t('myRoute.orderPlaced', 'Order placed')}</option>
              <option value="no_order">{t('myRoute.noOrder', 'No order')}</option>
              <option value="closed">{t('myRoute.shopClosed', 'Shop closed')}</option>
              <option value="other">{t('myRoute.other', 'Other')}</option>
            </select>
          </div>
          <div>
            <label className="field-label">{t('myRoute.note', 'Note (optional)')}</label>
            <textarea className="field-input w-full" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('common.saving') : t('myRoute.logVisit', 'Log visit')}</button>
        </div>
      </form>
    </div>
  );
}
