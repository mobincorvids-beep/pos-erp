import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

const STATUS_CHIP = { booked: 'chip-neutral', completed: 'chip-accent', cancelled: 'chip-danger' };

export function TravelPage() {
  const { company } = useAuth();
  const toast = useToast();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/travel/bookings').then(setBookings).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  const total = bookings.length;
  const completed = bookings.filter((b) => b.status === 'completed').length;
  const nextUpcoming = bookings
    .filter((b) => b.status === 'booked')
    .sort((a, b) => new Date(a.travelDate) - new Date(b.travelDate))[0];

  return (
    <div>
      <div className="flex justify-between items-end mb-6 flex-wrap gap-3">
        <div>
          <p className="eyebrow mb-1">Travel</p>
          <p className="page-title">Bookings &amp; packages</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>Book a package</button>
      </div>

      {!loading && total > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="card p-5">
            <p className="eyebrow">Total bookings</p>
            <p className="font-display text-3xl font-bold text-ink mt-3 num">{total}</p>
          </div>
          <div className="card p-5">
            <p className="eyebrow">Completed</p>
            <div className="flex items-baseline gap-2 mt-3">
              <p className="font-display text-3xl font-bold text-ink num">{completed}</p>
              <span className="text-sm text-ink-muted num">/ {total}</span>
            </div>
            <div className="w-full bg-surface-sunken rounded-full h-2 mt-3">
              <div className="bg-accent h-2 rounded-full" style={{ width: `${total ? (completed / total) * 100 : 0}%` }} />
            </div>
          </div>
          <div className="rounded-xl bg-accent text-white p-5 flex flex-col justify-between">
            <p className="eyebrow !text-white/70">Next departure</p>
            {nextUpcoming ? (
              <div className="mt-3">
                <p className="font-display text-xl font-bold">{nextUpcoming.packageName}</p>
                <p className="text-sm text-white/80 mt-1">{formatDate(nextUpcoming.travelDate)} · {nextUpcoming.destination}</p>
              </div>
            ) : (
              <p className="text-sm text-white/80 mt-3">No upcoming departures</p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0">
          {loading && <Loading />}
          {!loading && bookings.length === 0 && (
            <EmptyState title="No bookings yet" description="Book with an optional deposit — bill the remainder when the trip is finalized." action={<button className="btn-primary" onClick={() => setShowForm(true)}>Book one</button>} />
          )}
          {!loading && bookings.length > 0 && (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                    <th className="px-4 py-3 font-medium">Package</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Travel date</th>
                    <th className="px-4 py-3 font-medium text-right">Price</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b._id} onClick={() => setSelected(b)} className={`border-b border-rule last:border-0 cursor-pointer hover:bg-paper transition-colors ${selected?._id === b._id ? 'bg-accent-soft/40' : ''}`}>
                      <td className="px-4 py-3">{b.packageName} <span className="text-ink-muted text-xs">{b.destination}</span></td>
                      <td className="px-4 py-3">{b.customerId?.name || '—'}</td>
                      <td className="px-4 py-3 text-ink-muted">{formatDate(b.travelDate)}</td>
                      <td className="px-4 py-3 num text-right">{formatMoney(b.price, company?.currency)}</td>
                      <td className="px-4 py-3"><span className={STATUS_CHIP[b.status]}>{b.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {selected && <BookingPanel booking={selected} onClose={() => setSelected(null)} onChanged={load} />}
      </div>
      {showForm && <BookingForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function BookingForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ branchId: '', customerId: '', packageName: '', destination: '', travelDate: '', price: '', billingProductId: '', depositAmount: '', depositReceivedInAccountId: '', depositLiabilityAccountId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/products').then((rows) => setProducts(rows.filter((p) => p.trackingMode === 'service'))).catch(() => {});
    api.get('/org/accounts').then(setAccounts).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const product = products.find((p) => p._id === form.billingProductId);
      if (!product) throw new Error('Select a billing product — it must have trackingMode "service".');
      const payload = { ...form, price: Number(form.price), billingVariantId: product.variants[0]?._id };
      if (form.depositAmount) {
        payload.depositAmount = Number(form.depositAmount);
        if (!form.depositReceivedInAccountId || !form.depositLiabilityAccountId) {
          throw new Error('Both the receiving account and the liability account are required when taking a deposit.');
        }
      } else {
        delete payload.depositAmount; delete payload.depositReceivedInAccountId; delete payload.depositLiabilityAccountId;
      }
      await api.post('/travel/bookings', payload);
      toast('Package booked.', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm max-h-[85vh] overflow-y-auto">
        <p className="font-display text-lg font-bold text-ink mb-4">Book a package</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Customer</label>
            <select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Select…</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">Package name</label><input required className="field-input" value={form.packageName} onChange={(e) => setForm({ ...form, packageName: e.target.value })} placeholder="5-Day Istanbul Tour" /></div>
          <div><label className="field-label">Destination</label><input className="field-input" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">Travel date</label><input type="date" required className="field-input" value={form.travelDate} onChange={(e) => setForm({ ...form, travelDate: e.target.value })} /></div>
            <div><label className="field-label">Price</label><input type="number" required className="field-input num" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
          </div>
          <div>
            <label className="field-label">Billing product (trackingMode "service")</label>
            <select required className="field-input" value={form.billingProductId} onChange={(e) => setForm({ ...form, billingProductId: e.target.value })}>
              <option value="">Select…</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>

          <div className="tear-line" />
          <p className="text-xs text-ink-muted">Optional advance deposit — posts as a liability until the trip is finalized.</p>
          <div><label className="field-label">Deposit amount</label><input type="number" className="field-input num" value={form.depositAmount} onChange={(e) => setForm({ ...form, depositAmount: e.target.value })} placeholder="Leave blank for none" /></div>
          {form.depositAmount && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="field-label">Received into</label>
                <select className="field-input" value={form.depositReceivedInAccountId} onChange={(e) => setForm({ ...form, depositReceivedInAccountId: e.target.value })}>
                  <option value="">Select…</option>
                  {accounts.filter((a) => a.isPaymentAccount).map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Liability account</label>
                <select className="field-input" value={form.depositLiabilityAccountId} onChange={(e) => setForm({ ...form, depositLiabilityAccountId: e.target.value })}>
                  <option value="">Select…</option>
                  {accounts.filter((a) => a.type === 'liability').map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
                </select>
              </div>
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
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState({ packageName: booking.packageName, destination: booking.destination || '', travelDate: booking.travelDate?.slice(0, 10) || '', price: booking.price });
  const [refundPercent, setRefundPercent] = useState(100);
  const [refundAccountId, setRefundAccountId] = useState('');
  const [forfeitRevenueAccountId, setForfeitRevenueAccountId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (booking.branchId) api.get(`/org/warehouses?branchId=${booking.branchId}`).then(setWarehouses).catch(() => {});
    if (booking.depositAmount > 0) api.get('/org/accounts').then(setAccounts).catch(() => {});
  }, [booking._id]);

  async function saveEdit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put(`/travel/bookings/${booking._id}`, { ...editForm, price: Number(editForm.price) });
      toast('Booking updated.', 'success');
      setShowEditForm(false);
      onChanged(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function finalize() {
    setBusy(true);
    try {
      await api.post(`/travel/bookings/${booking._id}/finalize`, { warehouseId });
      toast('Trip finalized and billed.', 'success');
      onChanged(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function cancel(e) {
    e?.preventDefault();
    setBusy(true);
    try {
      const body = booking.depositAmount > 0 ? { refundPercent: Number(refundPercent), refundAccountId: refundAccountId || undefined, forfeitRevenueAccountId: forfeitRevenueAccountId || undefined } : {};
      await api.post(`/travel/bookings/${booking._id}/cancel`, body);
      toast('Booking cancelled.', 'success');
      onChanged(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="w-full lg:w-96 shrink-0 card p-5 h-fit">
      <div className="flex items-center justify-between mb-3">
        <p className="font-display text-lg font-bold text-ink">{booking.packageName}</p>
        <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>Close</button>
      </div>
      <p className="text-sm text-ink-muted mb-1">{booking.destination}</p>
      <p className="text-sm text-ink-muted mb-4">{formatDate(booking.travelDate)} · {formatMoney(booking.price, company?.currency)}</p>
      {booking.depositAmount > 0 && <p className="text-sm mb-4">Deposit already taken: {formatMoney(booking.depositAmount, company?.currency)}</p>}

      {booking.status === 'booked' && !showCancelForm && !showEditForm && (
        <>
          <select className="field-input mb-2" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            <option value="">Warehouse (for the Sale document)…</option>
            {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
          </select>
          <div className="flex gap-2 mb-2">
            <button className="btn-primary flex-1" disabled={!warehouseId || busy} onClick={finalize}>{busy ? 'Finalizing…' : 'Finalize & bill'}</button>
            <button className="btn-secondary" disabled={busy} onClick={() => booking.depositAmount > 0 ? setShowCancelForm(true) : cancel()}>Cancel</button>
          </div>
          <button className="btn-ghost !text-accent !px-0 text-sm" onClick={() => setShowEditForm(true)}>Edit details</button>
        </>
      )}

      {booking.status === 'booked' && showEditForm && (
        <form onSubmit={saveEdit} className="space-y-2">
          <div><label className="field-label">Package name</label><input required className="field-input" value={editForm.packageName} onChange={(e) => setEditForm({ ...editForm, packageName: e.target.value })} /></div>
          <div><label className="field-label">Destination</label><input className="field-input" value={editForm.destination} onChange={(e) => setEditForm({ ...editForm, destination: e.target.value })} /></div>
          <div><label className="field-label">Travel date</label><input type="date" required className="field-input" value={editForm.travelDate} onChange={(e) => setEditForm({ ...editForm, travelDate: e.target.value })} /></div>
          <div>
            <label className="field-label">Price</label>
            <input type="number" required disabled={booking.depositAmount > 0} className="field-input num" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
            {booking.depositAmount > 0 && <p className="text-xs text-ink-muted mt-1">Price is locked — a deposit has already been posted against it.</p>}
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" className="btn-secondary flex-1" onClick={() => setShowEditForm(false)}>Back</button>
            <button type="submit" disabled={busy} className="btn-primary flex-1">{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      )}

      {booking.status === 'booked' && showCancelForm && (
        <form onSubmit={cancel} className="space-y-2">
          <p className="text-sm text-ink-muted">This deposit was already received — decide how much to refund vs. keep as forfeited revenue.</p>
          <div>
            <label className="field-label">Refund %</label>
            <input type="number" min="0" max="100" className="field-input num" value={refundPercent} onChange={(e) => setRefundPercent(e.target.value)} />
          </div>
          {Number(refundPercent) > 0 && (
            <div>
              <label className="field-label">Refund from account</label>
              <select required className="field-input" value={refundAccountId} onChange={(e) => setRefundAccountId(e.target.value)}>
                <option value="">Select…</option>
                {accounts.filter((a) => a.isPaymentAccount).map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select>
            </div>
          )}
          {Number(refundPercent) < 100 && (
            <div>
              <label className="field-label">Forfeited revenue account</label>
              <select required className="field-input" value={forfeitRevenueAccountId} onChange={(e) => setForfeitRevenueAccountId(e.target.value)}>
                <option value="">Select…</option>
                {accounts.filter((a) => a.type === 'income').map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" className="btn-secondary flex-1" onClick={() => setShowCancelForm(false)}>Back</button>
            <button type="submit" disabled={busy} className="btn-primary flex-1 !bg-danger">{busy ? 'Cancelling…' : 'Confirm cancel'}</button>
          </div>
        </form>
      )}

      {booking.status === 'completed' && <p className="text-sm text-accent-strong">Finalized and billed.</p>}
      {booking.status === 'cancelled' && <p className="text-sm text-danger">Cancelled.</p>}
    </div>
  );
}
