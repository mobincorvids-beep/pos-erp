import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function CarRentalPage() {
  const [tab, setTab] = useState('fleet');
  return (
    <div>
      <p className="page-title mb-4">Car Rental</p>
      <div className="flex gap-1 border-b border-rule mb-5">
        {[['fleet', 'Fleet'], ['bookings', 'Bookings']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === key ? 'border-accent text-accent-strong font-medium' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'fleet' && <FleetTab />}
      {tab === 'bookings' && <BookingsTab />}
    </div>
  );
}

function FleetTab() {
  const { company } = useAuth();
  const toast = useToast();
  const [fleet, setFleet] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/car-rental/fleet').then(setFleet).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>Add vehicle</button>
      </div>
      {loading && <Loading />}
      {!loading && fleet.length === 0 && <EmptyState title="No vehicles yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Add a vehicle</button>} />}
      {!loading && fleet.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {fleet.map((v) => (
            <div key={v._id} className="card p-3">
              <p className="text-sm font-medium">{v.vehicleClass}</p>
              <p className="text-xs text-ink-muted mt-1">{v.registrationNumber}</p>
              <p className="num text-sm text-accent-strong mt-1">{formatMoney(v.dailyRate, company?.currency)}/day</p>
              <p className="text-xs text-ink-muted mt-1 capitalize">{v.status}</p>
            </div>
          ))}
        </div>
      )}
      {showForm && <VehicleForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function VehicleForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ branchId: '', vehicleClass: '', registrationNumber: '', dailyRate: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/car-rental/fleet', { ...form, dailyRate: Number(form.dailyRate) });
      toast('Vehicle added.', 'success');
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
        <p className="font-display text-lg mb-4">Add vehicle</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">Vehicle class</label><input required autoFocus className="field-input" value={form.vehicleClass} onChange={(e) => setForm({ ...form, vehicleClass: e.target.value })} placeholder="e.g. Sedan" /></div>
          <div><label className="field-label">Registration number</label><input required className="field-input" value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} /></div>
          <div><label className="field-label">Daily rate</label><input type="number" required className="field-input num" value={form.dailyRate} onChange={(e) => setForm({ ...form, dailyRate: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

function BookingsTab() {
  const toast = useToast();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [returning, setReturning] = useState(null);

  function load() {
    setLoading(true);
    api.get('/car-rental/bookings').then(setBookings).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>New booking</button>
      </div>
      {loading && <Loading />}
      {!loading && bookings.length === 0 && <EmptyState title="No bookings yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Create a booking</button>} />}
      {!loading && bookings.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {bookings.map((b) => (
            <div key={b._id} className="card p-3">
              <p className="text-sm font-medium">{b.vehicleClass}</p>
              <p className="text-xs text-ink-muted mt-1">{b.startDate?.slice(0, 10)} → {b.endDate?.slice(0, 10)}</p>
              <p className="text-xs text-ink-muted mt-1 capitalize">{b.status}</p>
              {b.status !== 'returned' && b.status !== 'completed' && b.status !== 'cancelled' && (
                <button className="btn-ghost !text-accent !px-0 text-xs mt-2" onClick={() => setReturning(b)}>Return vehicle</button>
              )}
            </div>
          ))}
        </div>
      )}
      {showForm && <BookingForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {returning && <ReturnForm booking={returning} onClose={() => setReturning(null)} onSaved={() => { setReturning(null); load(); }} />}
    </div>
  );
}

function BookingForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [fleet, setFleet] = useState([]);
  const [form, setForm] = useState({ branchId: '', vehicleClass: '', customerId: '', startDate: '', endDate: '', rentalBillingProductId: '', rentalBillingVariantId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/products').then(setProducts).catch(() => {});
    api.get('/car-rental/fleet').then(setFleet).catch(() => {});
  }, []);

  const vehicleClasses = [...new Set(fleet.map((v) => v.vehicleClass))];
  const selectedProduct = products.find((p) => p._id === form.rentalBillingProductId);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/car-rental/bookings', form);
      toast('Booking created.', 'success');
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
        <p className="font-display text-lg mb-4">New booking</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Vehicle class</label>
            {vehicleClasses.length > 0 ? (
              <select required className="field-input" value={form.vehicleClass} onChange={(e) => setForm({ ...form, vehicleClass: e.target.value })}>
                <option value="">Select…</option>
                {vehicleClasses.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <input required className="field-input" value={form.vehicleClass} onChange={(e) => setForm({ ...form, vehicleClass: e.target.value })} placeholder="e.g. Sedan" />
            )}
          </div>
          <div>
            <label className="field-label">Customer</label>
            <select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">Select…</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">Start date</label><input type="date" required className="field-input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><label className="field-label">End date</label><input type="date" required className="field-input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
          </div>
          <div>
            <label className="field-label">Billing product</label>
            <select required className="field-input" value={form.rentalBillingProductId} onChange={(e) => setForm({ ...form, rentalBillingProductId: e.target.value, rentalBillingVariantId: '' })}>
              <option value="">Select…</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          {selectedProduct && (
            <div>
              <label className="field-label">Variant</label>
              <select required className="field-input" value={form.rentalBillingVariantId} onChange={(e) => setForm({ ...form, rentalBillingVariantId: e.target.value })}>
                <option value="">Select…</option>
                {selectedProduct.variants?.map((v) => <option key={v._id} value={v._id}>{v.name || v.sku || v._id}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

function ReturnForm({ booking, onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); }, []);
  useEffect(() => { if (branchId) api.get(`/org/warehouses?branchId=${branchId}`).then(setWarehouses).catch(() => {}); }, [branchId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/car-rental/bookings/${booking._id}/return`, { warehouseId });
      toast('Vehicle returned.', 'success');
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
        <p className="font-display text-lg mb-4">Return vehicle — {booking.vehicleClass}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Warehouse</label>
            <select required className="field-input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} disabled={!branchId}>
              <option value="">Select…</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Returning…' : 'Return'}</button>
        </div>
      </form>
    </div>
  );
}
