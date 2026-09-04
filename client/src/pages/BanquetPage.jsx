import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

const STATUS_CHIP = { booked: 'chip-neutral', completed: 'chip-accent', cancelled: 'chip-danger' };

export function BanquetPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('bookings');
  return (
    <div>
      <p className="page-title mb-4">{t('banquet.title')}</p>
      <div className="flex gap-2 mb-5">
        {[['bookings', t('banquet.bookings')], ['venues', t('banquet.venuesAndPackages')]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={tab === key ? 'pill-active' : 'pill'}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'bookings' && <BookingsTab />}
      {tab === 'venues' && <VenuesTab />}
    </div>
  );
}

function BookingsTab() {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/banquet/bookings').then(setBookings).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        {loading && <Loading />}
        {!loading && bookings.length === 0 && <EmptyState title={t('banquet.noBookingsYet')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('banquet.bookOne')}</button>} />}
        {!loading && bookings.length > 0 && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-rule">
              <p className="font-display text-lg">{t('banquet.upcomingEvents')}</p>
              <button className="btn-primary" onClick={() => setShowForm(true)}>{t('banquet.bookEvent')}</button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                  <th className="px-4 py-2 font-medium">{t('banquet.venue')}</th>
                  <th className="px-4 py-2 font-medium">{t('banquet.customer')}</th>
                  <th className="px-4 py-2 font-medium">{t('banquet.date')}</th>
                  <th className="px-4 py-2 font-medium text-right">{t('banquet.guests')}</th>
                  <th className="px-4 py-2 font-medium">{t('banquet.status')}</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b._id} onClick={() => setSelected(b)} className={`border-b border-rule last:border-0 cursor-pointer hover:bg-paper ${selected?._id === b._id ? 'bg-accent-soft/40' : ''}`}>
                    <td className="px-4 py-2.5 font-medium">{b.venueId?.name}</td>
                    <td className="px-4 py-2.5">{b.customerId?.name || '-'}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{formatDate(b.eventDate)}</td>
                    <td className="px-4 py-2.5 num text-right">{b.guestCount}</td>
                    <td className="px-4 py-2.5"><span className={STATUS_CHIP[b.status]}>{b.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selected && <BookingPanel booking={selected} onClose={() => setSelected(null)} onChanged={load} />}
      {showForm && <BookingForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function BookingForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [venues, setVenues] = useState([]);
  const [packages, setPackages] = useState([]);
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ branchId: '', venueId: '', packageId: '', customerId: '', eventDate: '', guestCount: '', depositAmount: '', depositReceivedInAccountId: '', depositLiabilityAccountId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/banquet/venues').then(setVenues).catch(() => {});
    api.get('/banquet/packages').then(setPackages).catch(() => {});
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/org/accounts').then(setAccounts).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, guestCount: Number(form.guestCount) };
      if (form.depositAmount) {
        payload.depositAmount = Number(form.depositAmount);
        if (!form.depositReceivedInAccountId || !form.depositLiabilityAccountId) throw new Error(t('banquet.bothAccountsRequired'));
      } else { delete payload.depositAmount; delete payload.depositReceivedInAccountId; delete payload.depositLiabilityAccountId; }
      await api.post('/banquet/bookings', payload);
      toast(t('banquet.eventBooked'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto">
        <p className="font-display text-lg mb-4">{t('banquet.bookEvent')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('banquet.venue')}</label>
            <select required className="field-input" value={form.venueId} onChange={(e) => setForm({ ...form, venueId: e.target.value })}>
              <option value="">{t('banquet.selectEllipsis')}</option>
              {venues.map((v) => <option key={v._id} value={v._id}>{v.name} ({t('banquet.cap')}. {v.capacity})</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('banquet.package')}</label>
            <select required className="field-input" value={form.packageId} onChange={(e) => setForm({ ...form, packageId: e.target.value })}>
              <option value="">{t('banquet.selectEllipsis')}</option>
              {packages.map((p) => <option key={p._id} value={p._id}>{p.name} ({formatMoney(p.pricePerPerson)}/{t('banquet.person')})</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('banquet.branch')}</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">{t('banquet.selectEllipsis')}</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('banquet.customer')}</label>
            <select className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">{t('banquet.selectEllipsis')}</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">{t('banquet.eventDate')}</label><input type="date" required className="field-input" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} /></div>
            <div><label className="field-label">{t('banquet.guests')}</label><input type="number" required className="field-input num" value={form.guestCount} onChange={(e) => setForm({ ...form, guestCount: e.target.value })} /></div>
          </div>

          <div className="tear-line" />
          <div><label className="field-label">{t('banquet.depositOptional')}</label><input type="number" className="field-input num" value={form.depositAmount} onChange={(e) => setForm({ ...form, depositAmount: e.target.value })} /></div>
          {form.depositAmount && (
            <div className="grid grid-cols-2 gap-2">
              <select className="field-input" value={form.depositReceivedInAccountId} onChange={(e) => setForm({ ...form, depositReceivedInAccountId: e.target.value })}>
                <option value="">{t('banquet.receivedInto')}</option>
                {accounts.filter((a) => a.isPaymentAccount).map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select>
              <select className="field-input" value={form.depositLiabilityAccountId} onChange={(e) => setForm({ ...form, depositLiabilityAccountId: e.target.value })}>
                <option value="">{t('banquet.liabilityAccount')}</option>
                {accounts.filter((a) => a.type === 'liability').map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('banquet.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('banquet.booking') : t('banquet.book')}</button>
        </div>
      </form>
    </div>
  );
}

function BookingPanel({ booking, onClose, onChanged }) {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [warehouses, setWarehouses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [finalPaymentAccountId, setFinalPaymentAccountId] = useState('');
  const [forfeitPercent, setForfeitPercent] = useState(0);
  const [revenueAccountId, setRevenueAccountId] = useState('');
  const [refundAccountId, setRefundAccountId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (booking.branchId) api.get(`/org/warehouses?branchId=${booking.branchId}`).then(setWarehouses).catch(() => {});
    api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {});
  }, [booking._id]);

  async function complete() {
    setBusy(true);
    try {
      const result = await api.post(`/banquet/bookings/${booking._id}/complete`, { warehouseId, finalPaymentAccountId: finalPaymentAccountId || undefined });
      toast(t('banquet.billedAmount', { amount: formatMoney(result.grandTotal, company?.currency) }), 'success');
      onChanged(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function cancel() {
    setBusy(true);
    try {
      await api.post(`/banquet/bookings/${booking._id}/cancel`, {
        forfeitPercent: Number(forfeitPercent) || 0,
        revenueAccountId: revenueAccountId || undefined, refundAccountId: refundAccountId || undefined,
      });
      toast(t('banquet.bookingCancelled'), 'success');
      onChanged(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="w-full lg:w-96 shrink-0 card p-4 h-fit">
      <div className="flex items-center justify-between mb-1">
        <p className="font-display text-lg">{booking.venueId?.name}</p>
        <button className="btn-ghost !px-1.5 !py-1 text-xs" onClick={onClose}>{t('banquet.close')}</button>
      </div>
      <p className="text-sm text-ink-muted mb-4">{formatDate(booking.eventDate)} · <span className="num">{booking.guestCount}</span> {t('banquet.guests')}</p>

      {booking.status === 'booked' && (
        <>
          <p className="eyebrow mb-2">{t('banquet.completeEvent')}</p>
          <select className="field-input mb-2" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            <option value="">{t('banquet.warehouseEllipsis')}</option>
            {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
          </select>
          <select className="field-input mb-3" value={finalPaymentAccountId} onChange={(e) => setFinalPaymentAccountId(e.target.value)}>
            <option value="">{t('banquet.finalPaymentAccountEllipsis')}</option>
            {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
          <button className="btn-primary w-full mb-4" disabled={!warehouseId || busy} onClick={complete}>{t('banquet.completeAndBill')}</button>

          <div className="tear-line my-3" />
          <p className="eyebrow mb-2">{t('banquet.orCancel')}</p>
          {booking.depositAmount > 0 && (
            <>
              <label className="field-label">{t('banquet.forfeitPercentOfDeposit')}</label>
              <input type="number" min="0" max="100" className="field-input num mb-2" value={forfeitPercent} onChange={(e) => setForfeitPercent(e.target.value)} />
              <select className="field-input mb-2" value={revenueAccountId} onChange={(e) => setRevenueAccountId(e.target.value)}>
                <option value="">{t('banquet.cancellationFeeRevenueAccountEllipsis')}</option>
                {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select>
              <select className="field-input mb-2" value={refundAccountId} onChange={(e) => setRefundAccountId(e.target.value)}>
                <option value="">{t('banquet.refundAccountEllipsis')}</option>
                {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select>
            </>
          )}
          <button className="btn-secondary w-full" disabled={busy} onClick={cancel}>{t('banquet.cancelBooking')}</button>
        </>
      )}
      {booking.status === 'completed' && <span className="chip-accent">{t('banquet.completedAndBilled')}</span>}
      {booking.status === 'cancelled' && <span className="chip-danger">{t('banquet.cancelled')}</span>}
    </div>
  );
}

function VenuesTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [venues, setVenues] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingVenue, setEditingVenue] = useState(null); // null closed, {} new, {...} edit
  const [editingPackage, setEditingPackage] = useState(null);

  function load() {
    setLoading(true);
    Promise.all([api.get('/banquet/venues'), api.get('/banquet/packages')])
      .then(([v, p]) => { setVenues(v); setPackages(p); })
      .catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function handleRemoveVenue(v) {
    if (!window.confirm(t('banquet.confirmRemoveVenue', { name: v.name }))) return;
    try {
      await api.del(`/banquet/venues/${v._id}`);
      toast(t('banquet.venueRemoved'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function handleRemovePackage(p) {
    if (!window.confirm(t('banquet.confirmRemovePackage', { name: p.name }))) return;
    try {
      await api.del(`/banquet/packages/${p._id}`);
      toast(t('banquet.packageRemoved'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  if (loading) return <Loading />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="card p-4">
        <div className="flex justify-between items-center mb-3">
          <p className="eyebrow">{t('banquet.venues')}</p>
          <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setEditingVenue({})}>+ {t('banquet.addVenue')}</button>
        </div>
        {venues.length === 0 && <p className="text-sm text-ink-muted">{t('banquet.noneYet')}</p>}
        <div className="space-y-2">
          {venues.map((v) => (
            <div key={v._id} className="card p-3 bg-surface-sunken/40">
              <p className="text-sm font-semibold">{v.name}</p>
              <p className="text-xs text-ink-muted">{t('banquet.capacity')} <span className="num">{v.capacity}</span> · <span className="num">{formatMoney(v.baseRentalFee)}</span> {t('banquet.rental')}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <button className="btn-ghost !px-1.5 !py-0.5 text-xs" onClick={() => setEditingVenue(v)}>{t('banquet.edit')}</button>
                <button className="btn-ghost !px-1.5 !py-0.5 text-xs !text-danger" onClick={() => handleRemoveVenue(v)}>{t('banquet.remove')}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="card p-4">
        <div className="flex justify-between items-center mb-3">
          <p className="eyebrow">{t('banquet.packages')}</p>
          <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setEditingPackage({})}>+ {t('banquet.addPackage')}</button>
        </div>
        {packages.length === 0 && <p className="text-sm text-ink-muted">{t('banquet.noneYet')}</p>}
        <div className="space-y-2">
          {packages.map((p) => (
            <div key={p._id} className="card p-3 bg-surface-sunken/40">
              <p className="text-sm font-semibold">{p.name}</p>
              <p className="text-xs text-ink-muted"><span className="num">{formatMoney(p.pricePerPerson)}</span>/{t('banquet.person')} · {t('banquet.min')} <span className="num">{p.minGuests}</span> {t('banquet.guests')}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <button className="btn-ghost !px-1.5 !py-0.5 text-xs" onClick={() => setEditingPackage(p)}>{t('banquet.edit')}</button>
                <button className="btn-ghost !px-1.5 !py-0.5 text-xs !text-danger" onClick={() => handleRemovePackage(p)}>{t('banquet.remove')}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {editingVenue !== null && <VenueForm venue={editingVenue} onClose={() => setEditingVenue(null)} onSaved={() => { setEditingVenue(null); load(); }} />}
      {editingPackage !== null && <PackageForm pkg={editingPackage} onClose={() => setEditingPackage(null)} onSaved={() => { setEditingPackage(null); load(); }} />}
    </div>
  );
}

function VenueForm({ venue, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const isNew = !venue._id;
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    branchId: venue.branchId || '', name: venue.name || '', capacity: venue.capacity ?? '',
    baseRentalFee: venue.baseRentalFee ?? 0, rentalBillingProductId: venue.rentalBillingProductId || '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) {
      api.get('/org/branches').then(setBranches).catch(() => {});
      api.get('/products').then((rows) => setProducts(rows.filter((p) => p.trackingMode === 'service'))).catch(() => {});
    }
  }, [isNew]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isNew) {
        const product = products.find((p) => p._id === form.rentalBillingProductId);
        if (!product) throw new Error(t('banquet.selectBillingProductError'));
        await api.post('/banquet/venues', { ...form, capacity: Number(form.capacity), baseRentalFee: Number(form.baseRentalFee) || 0, rentalBillingVariantId: product.variants[0]?._id });
        toast(t('banquet.venueCreated'), 'success');
      } else {
        await api.put(`/banquet/venues/${venue._id}`, { name: form.name, capacity: Number(form.capacity), baseRentalFee: Number(form.baseRentalFee) || 0 });
        toast(t('banquet.venueUpdated'), 'success');
      }
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
        <p className="font-display text-lg mb-4">{isNew ? t('banquet.addVenue') : t('banquet.editVenue')}</p>
        <div className="space-y-3">
          {isNew && (
            <div>
              <label className="field-label">{t('banquet.branch')}</label>
              <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
                <option value="">{t('banquet.selectEllipsis')}</option>
                {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
            </div>
          )}
          <div><label className="field-label">{t('banquet.name')}</label><input required className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="field-label">{t('banquet.capacity')}</label><input type="number" required className="field-input num" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
          <div><label className="field-label">{t('banquet.baseRentalFee')}</label><input type="number" className="field-input num" value={form.baseRentalFee} onChange={(e) => setForm({ ...form, baseRentalFee: e.target.value })} /></div>
          {isNew && (
            <div>
              <label className="field-label">{t('banquet.billingProductService')}</label>
              <select required className="field-input" value={form.rentalBillingProductId} onChange={(e) => setForm({ ...form, rentalBillingProductId: e.target.value })}>
                <option value="">{t('banquet.selectEllipsis')}</option>
                {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('banquet.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('banquet.saving') : t('banquet.save')}</button>
        </div>
      </form>
    </div>
  );
}

function PackageForm({ pkg, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const isNew = !pkg._id;
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    name: pkg.name || '', pricePerPerson: pkg.pricePerPerson ?? '', minGuests: pkg.minGuests ?? 1, billingProductId: pkg.billingProductId || '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (isNew) api.get('/products').then((rows) => setProducts(rows.filter((p) => p.trackingMode === 'service'))).catch(() => {}); }, [isNew]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isNew) {
        const product = products.find((p) => p._id === form.billingProductId);
        if (!product) throw new Error(t('banquet.selectBillingProductError'));
        await api.post('/banquet/packages', { ...form, pricePerPerson: Number(form.pricePerPerson), minGuests: Number(form.minGuests), billingVariantId: product.variants[0]?._id });
        toast(t('banquet.packageCreated'), 'success');
      } else {
        await api.put(`/banquet/packages/${pkg._id}`, { name: form.name, pricePerPerson: Number(form.pricePerPerson), minGuests: Number(form.minGuests) });
        toast(t('banquet.packageUpdated'), 'success');
      }
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
        <p className="font-display text-lg mb-4">{isNew ? t('banquet.addPackage') : t('banquet.editPackage')}</p>
        <div className="space-y-3">
          <div><label className="field-label">{t('banquet.name')}</label><input required className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="field-label">{t('banquet.pricePerPerson')}</label><input type="number" required className="field-input num" value={form.pricePerPerson} onChange={(e) => setForm({ ...form, pricePerPerson: e.target.value })} /></div>
          <div><label className="field-label">{t('banquet.minimumGuests')}</label><input type="number" className="field-input num" value={form.minGuests} onChange={(e) => setForm({ ...form, minGuests: e.target.value })} /></div>
          {isNew && (
            <div>
              <label className="field-label">{t('banquet.billingProductService')}</label>
              <select required className="field-input" value={form.billingProductId} onChange={(e) => setForm({ ...form, billingProductId: e.target.value })}>
                <option value="">{t('banquet.selectEllipsis')}</option>
                {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('banquet.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('banquet.saving') : t('banquet.save')}</button>
        </div>
      </form>
    </div>
  );
}
