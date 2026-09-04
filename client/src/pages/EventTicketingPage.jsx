import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function EventTicketingPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);

  function load() {
    setLoading(true);
    api.get('/media-entertainment/shows').then(setShows).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <p className="eyebrow mb-1">{t('eventTicketing.mediaAndEntertainment')}</p>
      <div className="flex items-center justify-between mb-1">
        <p className="page-title">{t('eventTicketing.shows')}</p>
        <button className="btn-primary" onClick={() => setShowForm(true)}>{t('eventTicketing.newShow')}</button>
      </div>
      <p className="text-sm text-ink-muted mb-5 max-w-2xl">{t('eventTicketing.tiersDescription')}</p>

      {loading && <Loading />}
      {!loading && shows.length === 0 && (
        <EmptyState title={t('eventTicketing.noShowsYet')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('eventTicketing.scheduleOne')}</button>} />
      )}
      {!loading && shows.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left bg-surface-sunken">
                <th className="px-4 py-2.5 eyebrow font-medium">{t('eventTicketing.event')}</th>
                <th className="px-4 py-2.5 eyebrow font-medium">{t('eventTicketing.date')}</th>
                <th className="px-4 py-2.5 eyebrow font-medium">{t('eventTicketing.tiers')}</th>
                <th className="px-4 py-2.5 eyebrow font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {shows.map((s) => (
                <tr key={s._id} className="border-b border-rule last:border-0 hover:bg-surface-sunken/60">
                  <td className="px-4 py-2.5 font-medium text-ink">{s.eventName}</td>
                  <td className="px-4 py-2.5 num text-ink-muted">{new Date(s.showDateTime).toLocaleString()}</td>
                  <td className="px-4 py-2.5 num text-ink-muted">{s.tiers.length}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button className="btn-ghost" onClick={() => setSelected(s)}>{t('eventTicketing.manage')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <ShowForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {selected && <ShowManager show={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}

function ShowForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [eventName, setEventName] = useState('');
  const [showDateTime, setShowDateTime] = useState('');
  const [tiers, setTiers] = useState([{ name: '', capacity: '', price: '' }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); }, []);

  function updateTier(i, patch) {
    setTiers((prev) => prev.map((tier, idx) => idx === i ? { ...tier, ...patch } : tier));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/media-entertainment/shows', {
        branchId, eventName, showDateTime,
        tiers: tiers.map((t) => ({ name: t.name, capacity: Number(t.capacity), price: Number(t.price) })),
      });
      toast(t('eventTicketing.showScheduled'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 backdrop-blur-[1px] flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <p className="eyebrow mb-1">{t('eventTicketing.mediaAndEntertainment')}</p>
        <p className="font-display text-lg font-bold text-ink mb-4">{t('eventTicketing.newShow')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('eventTicketing.branch')}</label>
            <select required className="field-input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">{t('eventTicketing.selectEllipsis')}</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('eventTicketing.eventName')}</label>
            <input required className="field-input" value={eventName} onChange={(e) => setEventName(e.target.value)} />
          </div>
          <div>
            <label className="field-label">{t('eventTicketing.dateAndTime')}</label>
            <input required type="datetime-local" className="field-input" value={showDateTime} onChange={(e) => setShowDateTime(e.target.value)} />
          </div>
        </div>

        <p className="field-label mt-4 mb-1.5">{t('eventTicketing.seatingTiers')}</p>
        <div className="space-y-2">
          {tiers.map((tier, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <input required className="field-input" placeholder={t('eventTicketing.tierNamePlaceholder')} value={tier.name} onChange={(e) => updateTier(i, { name: e.target.value })} />
              <input required type="number" min="1" className="field-input num" placeholder={t('eventTicketing.capacityPlaceholder')} value={tier.capacity} onChange={(e) => updateTier(i, { capacity: e.target.value })} />
              <input required type="number" step="0.01" className="field-input num" placeholder={t('eventTicketing.pricePlaceholder')} value={tier.price} onChange={(e) => updateTier(i, { price: e.target.value })} />
            </div>
          ))}
        </div>
        <button type="button" className="btn-ghost !px-0 text-xs mt-2 mb-1" onClick={() => setTiers([...tiers, { name: '', capacity: '', price: '' }])}>
          {t('eventTicketing.addTier')}
        </button>

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('eventTicketing.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('eventTicketing.schedulingEllipsis') : t('eventTicketing.scheduleShow')}</button>
        </div>
      </form>
    </div>
  );
}

function ShowManager({ show, onClose, onChanged }) {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [roster, setRoster] = useState(null);
  const [bookingTierId, setBookingTierId] = useState(null);

  function load() {
    api.get(`/media-entertainment/shows/${show._id}/roster`).then(setRoster).catch((err) => toast(err.message, 'error'));
  }
  useEffect(load, [show._id]);

  if (!roster) return null;

  return (
    <div className="fixed inset-0 bg-ink/20 backdrop-blur-[1px] flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <p className="font-display text-lg font-bold text-ink">{roster.eventName}</p>
          <button className="btn-ghost !px-2 !py-1 text-xs" onClick={onClose}>{t('eventTicketing.close')}</button>
        </div>
        <p className="eyebrow mb-4">{t('eventTicketing.seatingTiers')}</p>

        <div className="space-y-3">
          {roster.tiers.map((tier) => {
            const sold = tier.soldCustomerIds.length;
            const remaining = tier.capacity - sold;
            return (
              <div key={tier._id} className="card p-4 bg-surface-sunken/40">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-ink">{tier.name} · <span className="num text-ink-muted font-normal">{formatMoney(tier.price, company?.currency)}</span></p>
                  <span className={remaining > 0 ? 'chip-accent' : 'chip-danger'}>{remaining > 0 ? t('eventTicketing.leftOfCapacity', { remaining, capacity: tier.capacity }) : t('eventTicketing.soldOut')}</span>
                </div>
                {tier.waitlistCustomerIds.length > 0 && (
                  <p className="text-xs text-ink-muted mb-2">{t('eventTicketing.onWaitlistForTier', { count: tier.waitlistCustomerIds.length })}</p>
                )}
                {show.status === 'scheduled' && (
                  <button className="btn-secondary text-xs" onClick={() => setBookingTierId(tier._id)}>
                    {remaining > 0 ? t('eventTicketing.sellATicket') : t('eventTicketing.addToWaitlist')}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {bookingTierId && <TicketForm show={show} tierId={bookingTierId} onClose={() => setBookingTierId(null)} onBooked={() => { setBookingTierId(null); load(); onChanged(); }} />}
      </div>
    </div>
  );
}

function TicketForm({ show, tierId, onClose, onBooked }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState({ customerId: '', warehouseId: '', ticketBillingProductId: '', paymentAccountId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/products').then((rows) => setProducts(rows.filter((p) => p.trackingMode === 'service'))).catch(() => {});
    api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {});
    if (show.branchId) api.get(`/org/warehouses?branchId=${show.branchId}`).then(setWarehouses).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const product = products.find((p) => p._id === form.ticketBillingProductId);
      if (!product) throw new Error(t('eventTicketing.selectBillingProductError'));
      const result = await api.post(`/media-entertainment/shows/${show._id}/tiers/${tierId}/book`, { ...form, ticketBillingVariantId: product.variants[0]?._id });
      toast(result.waitlisted ? t('eventTicketing.tierFullWaitlisted', { position: result.waitlistPosition }) : t('eventTicketing.ticketSold'), 'success');
      onBooked();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/30 backdrop-blur-[1px] flex items-center justify-center z-50 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="eyebrow mb-1">{show.eventName}</p>
        <p className="font-display text-lg font-bold text-ink mb-4">{t('eventTicketing.sellATicket')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('eventTicketing.customer')}</label>
            <select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">{t('eventTicketing.selectEllipsis')}</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('eventTicketing.billingProductServiceOnly')}</label>
            <select required className="field-input" value={form.ticketBillingProductId} onChange={(e) => setForm({ ...form, ticketBillingProductId: e.target.value })}>
              <option value="">{t('eventTicketing.selectEllipsis')}</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('eventTicketing.warehouseForSaleDocument')}</label>
            <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}>
              <option value="">{t('eventTicketing.selectEllipsis')}</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('eventTicketing.paymentAccount')}</label>
            <select required className="field-input" value={form.paymentAccountId} onChange={(e) => setForm({ ...form, paymentAccountId: e.target.value })}>
              <option value="">{t('eventTicketing.selectEllipsis')}</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('eventTicketing.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('eventTicketing.processingEllipsis') : t('eventTicketing.confirm')}</button>
        </div>
      </form>
    </div>
  );
}
