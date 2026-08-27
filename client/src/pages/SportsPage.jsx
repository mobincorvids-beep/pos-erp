import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

const STATUS_CHIP = { booked: 'chip-accent', cancelled: 'chip-danger' };

export function SportsPage() {
  const [tab, setTab] = useState('bookings');
  return (
    <div>
      <p className="eyebrow mb-1">Sports & facilities</p>
      <p className="page-title mb-5">Bookings & courts</p>
      <div className="flex gap-2 mb-5">
        {[['bookings', 'Bookings'], ['facilities', 'Facilities']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={tab === key ? 'pill-active' : 'pill'}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'bookings' ? <BookingsTab /> : <FacilitiesTab />}
    </div>
  );
}

function BookingsTab() {
  const { company } = useAuth();
  const toast = useToast();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/sports/bookings').then(setBookings).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function cancel(id) {
    try {
      await api.post(`/sports/bookings/${id}/cancel`, {});
      toast('Booking cancelled.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ Book a slot</button>
      </div>
      {loading && <Loading />}
      {!loading && bookings.length === 0 && <EmptyState title="No bookings yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Book one</button>} />}
      {!loading && bookings.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left bg-surface-sunken">
                <th className="px-4 py-2.5 eyebrow font-medium">Customer</th>
                <th className="px-4 py-2.5 eyebrow font-medium">From</th>
                <th className="px-4 py-2.5 eyebrow font-medium">To</th>
                <th className="px-4 py-2.5 eyebrow font-medium">Status</th>
                <th className="px-4 py-2.5 eyebrow font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b._id} className="border-b border-rule last:border-0 hover:bg-surface-sunken/60">
                  <td className="px-4 py-2.5 font-medium text-ink">{b.customerId?.name || '—'}</td>
                  <td className="px-4 py-2.5 num text-ink-muted">{new Date(b.startTime).toLocaleString()}</td>
                  <td className="px-4 py-2.5 num text-ink-muted">{new Date(b.endTime).toLocaleString()}</td>
                  <td className="px-4 py-2.5"><span className={STATUS_CHIP[b.status]}>{b.status}</span></td>
                  <td className="px-4 py-2.5 text-right">
                    {b.status === 'booked' && <button className="btn-ghost !text-danger" onClick={() => cancel(b._id)}>Cancel</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showForm && <BookingForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function BookingForm({ onClose, onSaved }) {
  const toast = useToast();
  const [facilities, setFacilities] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState({ facilityId: '', customerId: '', startTime: '', endTime: '', billingProductId: '', warehouseId: '', paymentAccountId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/sports/facilities').then(setFacilities).catch(() => {});
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/products').then((rows) => setProducts(rows.filter((p) => p.trackingMode === 'service'))).catch(() => {});
    api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {});
  }, []);

  const selectedFacility = facilities.find((f) => f._id === form.facilityId);
  useEffect(() => { if (selectedFacility?.branchId) api.get(`/org/warehouses?branchId=${selectedFacility.branchId}`).then(setWarehouses).catch(() => {}); }, [selectedFacility?.branchId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const product = products.find((p) => p._id === form.billingProductId);
      if (!product) throw new Error('Select a billing product — it must have trackingMode "service".');
      const { facilityId, ...rest } = form;
      await api.post(`/sports/facilities/${facilityId}/book`, { ...rest, billingVariantId: product.variants[0]?._id });
      toast('Slot booked.', 'success');
      onSaved();
    } catch (err) {
      // The real overlap-conflict message from the backend is shown as-is —
      // it already names the exact conflicting time range, more useful
      // than a generic "failed to book" the frontend could invent instead.
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 backdrop-blur-[1px] flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto">
        <p className="eyebrow mb-1">Sports & facilities</p>
        <p className="font-display text-lg font-bold text-ink mb-4">Book a slot</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Facility</label>
            <select required className="field-input" value={form.facilityId} onChange={(e) => setForm({ ...form, facilityId: e.target.value })}>
              <option value="">Select…</option>
              {facilities.map((f) => <option key={f._id} value={f._id}>{f.name} — {formatMoney(f.hourlyRate)}/hr</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Customer</label>
            <select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Select…</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">Start</label><input type="datetime-local" required className="field-input" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
            <div><label className="field-label">End</label><input type="datetime-local" required className="field-input" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
          </div>
          <div>
            <label className="field-label">Billing product (trackingMode "service")</label>
            <select required className="field-input" value={form.billingProductId} onChange={(e) => setForm({ ...form, billingProductId: e.target.value })}>
              <option value="">Select…</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Warehouse (for the Sale document)</label>
            <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} disabled={!selectedFacility}>
              <option value="">Select…</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Payment account</label>
            <select required className="field-input" value={form.paymentAccountId} onChange={(e) => setForm({ ...form, paymentAccountId: e.target.value })}>
              <option value="">Select…</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Booking…' : 'Book'}</button>
        </div>
      </form>
    </div>
  );
}

function FacilitiesTab() {
  const toast = useToast();
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/sports/facilities').then(setFacilities).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ Add facility</button>
      </div>
      {loading && <Loading />}
      {!loading && facilities.length === 0 && <EmptyState title="No facilities yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Add one</button>} />}
      {!loading && facilities.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {facilities.map((f) => (
            <div key={f._id} className="card p-4">
              <div className="w-9 h-9 rounded-lg bg-accent-soft text-accent-strong flex items-center justify-center text-sm font-semibold mb-3">
                {f.name.slice(0, 1).toUpperCase()}
              </div>
              <p className="text-sm font-semibold text-ink">{f.name}</p>
              <p className="num text-sm text-ink-muted mt-1">{formatMoney(f.hourlyRate)}/hr</p>
            </div>
          ))}
        </div>
      )}
      {showForm && <FacilityForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function FacilityForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ branchId: '', name: '', hourlyRate: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/sports/facilities', { ...form, hourlyRate: Number(form.hourlyRate) });
      toast('Facility added.', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 backdrop-blur-[1px] flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="eyebrow mb-1">Sports & facilities</p>
        <p className="font-display text-lg font-bold text-ink mb-4">Add facility</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">Name</label><input required className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Court 1, Field A…" /></div>
          <div><label className="field-label">Hourly rate</label><input type="number" required className="field-input num" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}
