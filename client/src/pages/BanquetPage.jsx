import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

const STATUS_CHIP = { booked: 'chip-neutral', completed: 'chip-accent', cancelled: 'chip-danger' };

export function BanquetPage() {
  const [tab, setTab] = useState('bookings');
  return (
    <div>
      <p className="page-title mb-4">Banquet</p>
      <div className="flex gap-1 border-b border-rule mb-5">
        {[['bookings', 'Bookings'], ['venues', 'Venues & packages']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === key ? 'border-accent text-accent-strong font-medium' : 'border-transparent text-ink-muted hover:text-ink'}`}>
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
        <div className="flex justify-end mb-3">
          <button className="btn-primary" onClick={() => setShowForm(true)}>Book event</button>
        </div>
        {loading && <Loading />}
        {!loading && bookings.length === 0 && <EmptyState title="No bookings yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Book one</button>} />}
        {!loading && bookings.length > 0 && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                  <th className="px-3 py-2 font-medium">Venue</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium text-right">Guests</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b._id} onClick={() => setSelected(b)} className={`border-b border-rule last:border-0 cursor-pointer hover:bg-paper ${selected?._id === b._id ? 'bg-accent-soft/40' : ''}`}>
                    <td className="px-3 py-2">{b.venueId?.name}</td>
                    <td className="px-3 py-2">{b.customerId?.name || '—'}</td>
                    <td className="px-3 py-2 text-ink-muted">{formatDate(b.eventDate)}</td>
                    <td className="px-3 py-2 num text-right">{b.guestCount}</td>
                    <td className="px-3 py-2"><span className={STATUS_CHIP[b.status]}>{b.status}</span></td>
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
        if (!form.depositReceivedInAccountId || !form.depositLiabilityAccountId) throw new Error('Both accounts are required for a deposit.');
      } else { delete payload.depositAmount; delete payload.depositReceivedInAccountId; delete payload.depositLiabilityAccountId; }
      await api.post('/banquet/bookings', payload);
      toast('Event booked.', 'success');
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
        <p className="font-display text-lg mb-4">Book event</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Venue</label>
            <select required className="field-input" value={form.venueId} onChange={(e) => setForm({ ...form, venueId: e.target.value })}>
              <option value="">Select…</option>
              {venues.map((v) => <option key={v._id} value={v._id}>{v.name} (cap. {v.capacity})</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Package</label>
            <select required className="field-input" value={form.packageId} onChange={(e) => setForm({ ...form, packageId: e.target.value })}>
              <option value="">Select…</option>
              {packages.map((p) => <option key={p._id} value={p._id}>{p.name} ({formatMoney(p.pricePerPerson)}/person)</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Customer</label>
            <select className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Select…</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">Event date</label><input type="date" required className="field-input" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} /></div>
            <div><label className="field-label">Guests</label><input type="number" required className="field-input num" value={form.guestCount} onChange={(e) => setForm({ ...form, guestCount: e.target.value })} /></div>
          </div>

          <div className="tear-line" />
          <div><label className="field-label">Deposit (optional)</label><input type="number" className="field-input num" value={form.depositAmount} onChange={(e) => setForm({ ...form, depositAmount: e.target.value })} /></div>
          {form.depositAmount && (
            <div className="grid grid-cols-2 gap-2">
              <select className="field-input" value={form.depositReceivedInAccountId} onChange={(e) => setForm({ ...form, depositReceivedInAccountId: e.target.value })}>
                <option value="">Received into…</option>
                {accounts.filter((a) => a.isPaymentAccount).map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select>
              <select className="field-input" value={form.depositLiabilityAccountId} onChange={(e) => setForm({ ...form, depositLiabilityAccountId: e.target.value })}>
                <option value="">Liability account…</option>
                {accounts.filter((a) => a.type === 'liability').map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Booking…' : 'Book'}</button>
        </div>
      </form>
    </div>
  );
}

function BookingPanel({ booking, onClose, onChanged }) {
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
      toast(`Billed ${formatMoney(result.grandTotal, company?.currency)}.`, 'success');
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
      toast('Booking cancelled.', 'success');
      onChanged(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="w-full lg:w-96 shrink-0 card p-4 h-fit">
      <div className="flex items-center justify-between mb-3">
        <p className="font-display text-lg">{booking.venueId?.name}</p>
        <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>Close</button>
      </div>
      <p className="text-sm text-ink-muted mb-4">{formatDate(booking.eventDate)} · {booking.guestCount} guests</p>

      {booking.status === 'booked' && (
        <>
          <p className="text-sm font-medium mb-2">Complete event</p>
          <select className="field-input mb-2" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            <option value="">Warehouse…</option>
            {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
          </select>
          <select className="field-input mb-3" value={finalPaymentAccountId} onChange={(e) => setFinalPaymentAccountId(e.target.value)}>
            <option value="">Final payment account (if balance remains)…</option>
            {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
          <button className="btn-primary w-full mb-4" disabled={!warehouseId || busy} onClick={complete}>Complete & bill</button>

          <div className="tear-line my-3" />
          <p className="text-sm font-medium mb-2">Or cancel</p>
          {booking.depositAmount > 0 && (
            <>
              <label className="field-label">Forfeit % of deposit</label>
              <input type="number" min="0" max="100" className="field-input num mb-2" value={forfeitPercent} onChange={(e) => setForfeitPercent(e.target.value)} />
              <select className="field-input mb-2" value={revenueAccountId} onChange={(e) => setRevenueAccountId(e.target.value)}>
                <option value="">Cancellation fee revenue account…</option>
                {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select>
              <select className="field-input mb-2" value={refundAccountId} onChange={(e) => setRefundAccountId(e.target.value)}>
                <option value="">Refund account…</option>
                {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select>
            </>
          )}
          <button className="btn-secondary w-full" disabled={busy} onClick={cancel}>Cancel booking</button>
        </>
      )}
      {booking.status === 'completed' && <p className="text-sm text-accent-strong">Completed and billed.</p>}
      {booking.status === 'cancelled' && <p className="text-sm text-danger">Cancelled.</p>}
    </div>
  );
}

function VenuesTab() {
  const toast = useToast();
  const [venues, setVenues] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showVenueForm, setShowVenueForm] = useState(false);
  const [showPackageForm, setShowPackageForm] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([api.get('/banquet/venues'), api.get('/banquet/packages')])
      .then(([v, p]) => { setVenues(v); setPackages(p); })
      .catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  if (loading) return <Loading />;

  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium">Venues</p>
          <button className="btn-ghost !text-accent !px-0 text-xs" onClick={() => setShowVenueForm(true)}>+ Add</button>
        </div>
        {venues.length === 0 && <p className="text-sm text-ink-muted">None yet.</p>}
        <div className="space-y-2">
          {venues.map((v) => (
            <div key={v._id} className="card p-3">
              <p className="text-sm font-medium">{v.name}</p>
              <p className="text-xs text-ink-muted">Capacity {v.capacity} · {formatMoney(v.baseRentalFee)} rental</p>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium">Packages</p>
          <button className="btn-ghost !text-accent !px-0 text-xs" onClick={() => setShowPackageForm(true)}>+ Add</button>
        </div>
        {packages.length === 0 && <p className="text-sm text-ink-muted">None yet.</p>}
        <div className="space-y-2">
          {packages.map((p) => (
            <div key={p._id} className="card p-3">
              <p className="text-sm font-medium">{p.name}</p>
              <p className="text-xs text-ink-muted">{formatMoney(p.pricePerPerson)}/person · min {p.minGuests} guests</p>
            </div>
          ))}
        </div>
      </div>
      {showVenueForm && <VenueForm onClose={() => setShowVenueForm(false)} onSaved={() => { setShowVenueForm(false); load(); }} />}
      {showPackageForm && <PackageForm onClose={() => setShowPackageForm(false)} onSaved={() => { setShowPackageForm(false); load(); }} />}
    </div>
  );
}

function VenueForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ branchId: '', name: '', capacity: '', baseRentalFee: 0, rentalBillingProductId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/products').then((rows) => setProducts(rows.filter((p) => p.trackingMode === 'service'))).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const product = products.find((p) => p._id === form.rentalBillingProductId);
      if (!product) throw new Error('Select a billing product (trackingMode "service").');
      await api.post('/banquet/venues', { ...form, capacity: Number(form.capacity), baseRentalFee: Number(form.baseRentalFee) || 0, rentalBillingVariantId: product.variants[0]?._id });
      toast('Venue created.', 'success');
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
        <p className="font-display text-lg mb-4">Add venue</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">Name</label><input required className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="field-label">Capacity</label><input type="number" required className="field-input num" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
          <div><label className="field-label">Base rental fee</label><input type="number" className="field-input num" value={form.baseRentalFee} onChange={(e) => setForm({ ...form, baseRentalFee: e.target.value })} /></div>
          <div>
            <label className="field-label">Billing product (trackingMode "service")</label>
            <select required className="field-input" value={form.rentalBillingProductId} onChange={(e) => setForm({ ...form, rentalBillingProductId: e.target.value })}>
              <option value="">Select…</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

function PackageForm({ onClose, onSaved }) {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ name: '', pricePerPerson: '', minGuests: 1, billingProductId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/products').then((rows) => setProducts(rows.filter((p) => p.trackingMode === 'service'))).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const product = products.find((p) => p._id === form.billingProductId);
      if (!product) throw new Error('Select a billing product.');
      await api.post('/banquet/packages', { ...form, pricePerPerson: Number(form.pricePerPerson), minGuests: Number(form.minGuests), billingVariantId: product.variants[0]?._id });
      toast('Package created.', 'success');
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
        <p className="font-display text-lg mb-4">Add package</p>
        <div className="space-y-3">
          <div><label className="field-label">Name</label><input required className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="field-label">Price per person</label><input type="number" required className="field-input num" value={form.pricePerPerson} onChange={(e) => setForm({ ...form, pricePerPerson: e.target.value })} /></div>
          <div><label className="field-label">Minimum guests</label><input type="number" className="field-input num" value={form.minGuests} onChange={(e) => setForm({ ...form, minGuests: e.target.value })} /></div>
          <div>
            <label className="field-label">Billing product (trackingMode "service")</label>
            <select required className="field-input" value={form.billingProductId} onChange={(e) => setForm({ ...form, billingProductId: e.target.value })}>
              <option value="">Select…</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}
