import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

const STATUS_CHIP = { planned: 'chip-warning', completed: 'chip-accent' };

export function LogisticsPage() {
  const [tab, setTab] = useState('trips');
  return (
    <div>
      <p className="page-title mb-4">Logistics</p>
      <div className="flex gap-1 border-b border-rule mb-5">
        {[['trips', 'Trips'], ['fleet', 'Fleet']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === key ? 'border-accent text-accent-strong font-medium' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'trips' ? <TripsTab /> : <FleetTab />}
    </div>
  );
}

function TripsTab() {
  const { company } = useAuth();
  const toast = useToast();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/logistics/trips').then(setTrips).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex justify-end mb-3">
          <button className="btn-primary" onClick={() => setShowForm(true)}>Start a trip</button>
        </div>
        {loading && <Loading />}
        {!loading && trips.length === 0 && <EmptyState title="No trips yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Start one</button>} />}
        {!loading && trips.length > 0 && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                  <th className="px-3 py-2 font-medium">Vehicle</th>
                  <th className="px-3 py-2 font-medium">Driver</th>
                  <th className="px-3 py-2 font-medium">Deliveries</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((t) => (
                  <tr key={t._id} onClick={() => setSelected(t)} className={`border-b border-rule last:border-0 cursor-pointer hover:bg-paper ${selected?._id === t._id ? 'bg-accent-soft/40' : ''}`}>
                    <td className="px-3 py-2">{t.vehicleId?.registrationNumber || '—'}</td>
                    <td className="px-3 py-2">{t.driverId?.name || '—'}</td>
                    <td className="px-3 py-2 text-ink-muted">{t.deliveries.length}</td>
                    <td className="px-3 py-2"><span className={STATUS_CHIP[t.status]}>{t.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selected && <TripPanel trip={selected} onClose={() => setSelected(null)} onChanged={load} />}
      {showForm && <TripForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function TripForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState({ branchId: '', vehicleId: '', driverId: '', startOdometer: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/logistics/vehicles').then(setVehicles).catch(() => {});
    api.get('/logistics/drivers').then(setDrivers).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/logistics/trips', { ...form, startOdometer: Number(form.startOdometer) });
      toast('Trip started.', 'success');
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
        <p className="font-display text-lg mb-4">Start a trip</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Vehicle</label>
            <select required className="field-input" value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
              <option value="">Select…</option>
              {vehicles.map((v) => <option key={v._id} value={v._id}>{v.registrationNumber}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Driver</label>
            <select required className="field-input" value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })}>
              <option value="">Select…</option>
              {drivers.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">Start odometer</label><input type="number" required className="field-input num" value={form.startOdometer} onChange={(e) => setForm({ ...form, startOdometer: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Starting…' : 'Start trip'}</button>
        </div>
      </form>
    </div>
  );
}

function TripPanel({ trip, onClose, onChanged }) {
  const { company } = useAuth();
  const toast = useToast();
  const [revenue, setRevenue] = useState('');
  const [endOdometer, setEndOdometer] = useState('');
  const [fuelCost, setFuelCost] = useState('');
  const [otherCosts, setOtherCosts] = useState('');
  const [busy, setBusy] = useState(false);

  async function addDelivery(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/logistics/trips/${trip._id}/deliveries`, { revenue: Number(revenue) });
      toast('Delivery added.', 'success');
      setRevenue('');
      onChanged();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function complete() {
    setBusy(true);
    try {
      const result = await api.post(`/logistics/trips/${trip._id}/complete`, {
        endOdometer: Number(endOdometer), fuelCost: fuelCost ? Number(fuelCost) : undefined, otherCosts: otherCosts ? Number(otherCosts) : undefined,
      });
      toast(`Trip completed — ${result.distanceKm}km, ${formatMoney(result.profitability, company?.currency)} profit${result.costPerKm !== null ? `, ${formatMoney(result.costPerKm, company?.currency)}/km` : ''}.`, 'success');
      onChanged(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="w-full lg:w-96 shrink-0 card p-4 h-fit">
      <div className="flex items-center justify-between mb-3">
        <p className="font-display text-lg">{trip.vehicleId?.registrationNumber}</p>
        <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>Close</button>
      </div>
      <p className="text-sm text-ink-muted mb-4">{trip.driverId?.name} — started at {trip.startOdometer}</p>

      {trip.status === 'planned' && (
        <>
          <form onSubmit={addDelivery} className="flex gap-2 mb-4">
            <input type="number" placeholder="Delivery revenue" className="field-input num" value={revenue} onChange={(e) => setRevenue(e.target.value)} />
            <button type="submit" disabled={!revenue || busy} className="btn-secondary shrink-0">Add</button>
          </form>

          <div className="tear-line my-3" />
          <p className="text-sm font-medium mb-2">Complete trip</p>
          <div className="space-y-2 mb-2">
            <input type="number" required placeholder="End odometer" className="field-input num" value={endOdometer} onChange={(e) => setEndOdometer(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" placeholder="Fuel cost" className="field-input num" value={fuelCost} onChange={(e) => setFuelCost(e.target.value)} />
              <input type="number" placeholder="Other costs" className="field-input num" value={otherCosts} onChange={(e) => setOtherCosts(e.target.value)} />
            </div>
          </div>
          <button className="btn-primary w-full" disabled={!endOdometer || busy} onClick={complete}>{busy ? 'Completing…' : 'Complete trip'}</button>
        </>
      )}
      {trip.status === 'completed' && <p className="text-sm text-accent-strong">Trip completed.</p>}
    </div>
  );
}

function FleetTab() {
  const toast = useToast();
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [showDriverForm, setShowDriverForm] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([api.get('/logistics/vehicles'), api.get('/logistics/drivers')])
      .then(([v, d]) => { setVehicles(v); setDrivers(d); })
      .catch((err) => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  if (loading) return <Loading />;

  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="font-medium text-sm">Vehicles</p>
          <button className="btn-ghost !text-accent text-xs" onClick={() => setShowVehicleForm(true)}>+ Add</button>
        </div>
        {vehicles.length === 0 && <EmptyState title="No vehicles yet" />}
        {vehicles.map((v) => <div key={v._id} className="card p-2 mb-2 text-sm">{v.registrationNumber}</div>)}
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="font-medium text-sm">Drivers</p>
          <button className="btn-ghost !text-accent text-xs" onClick={() => setShowDriverForm(true)}>+ Add</button>
        </div>
        {drivers.length === 0 && <EmptyState title="No drivers yet" />}
        {drivers.map((d) => <div key={d._id} className="card p-2 mb-2 text-sm">{d.name}</div>)}
      </div>
      {showVehicleForm && <VehicleForm onClose={() => setShowVehicleForm(false)} onSaved={() => { setShowVehicleForm(false); load(); }} />}
      {showDriverForm && <DriverForm onClose={() => setShowDriverForm(false)} onSaved={() => { setShowDriverForm(false); load(); }} />}
    </div>
  );
}

function VehicleForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/logistics/vehicles', { branchId, registrationNumber });
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
          <select required className="field-input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Branch…</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
          <input required className="field-input" placeholder="Registration number" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

function DriverForm({ onClose, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/logistics/drivers', { name });
      toast('Driver added.', 'success');
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
        <p className="font-display text-lg mb-4">Add driver</p>
        <input required className="field-input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}
