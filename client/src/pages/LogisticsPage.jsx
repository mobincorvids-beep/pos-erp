import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

const STATUS_CHIP = { planned: 'chip-warning', completed: 'chip-accent' };

export function LogisticsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('trips');
  return (
    <div>
      <div className="mb-6">
        <p className="page-title">{t('logistics.title')}</p>
        <p className="text-sm text-ink-muted mt-1">{t('logistics.subtitle')}</p>
      </div>
      <div className="flex gap-2 mb-6">
        {[['trips', t('logistics.trips')], ['fleet', t('logistics.fleet')]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={tab === key ? 'pill-active' : 'pill'}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'trips' ? <TripsTab /> : <FleetTab />}
    </div>
  );
}

function TripsTab() {
  const { t } = useTranslation();
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
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <span className="font-icon text-base leading-none">add</span>
            {t('logistics.startATrip')}
          </button>
        </div>
        {loading && <Loading />}
        {!loading && trips.length === 0 && <EmptyState title={t('logistics.noTripsYet')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('logistics.startOne')}</button>} />}
        {!loading && trips.length > 0 && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-sunken">
                <tr className="text-left text-xs text-ink-muted uppercase tracking-wide">
                  <th className="px-4 py-3 font-semibold">{t('logistics.vehicle')}</th>
                  <th className="px-4 py-3 font-semibold">{t('logistics.driver')}</th>
                  <th className="px-4 py-3 font-semibold">{t('logistics.deliveries')}</th>
                  <th className="px-4 py-3 font-semibold">{t('logistics.status')}</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((t2) => (
                  <tr
                    key={t2._id}
                    onClick={() => setSelected(t2)}
                    className={`border-t border-rule cursor-pointer hover:bg-paper transition-colors ${selected?._id === t2._id ? 'bg-accent-soft' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium text-ink">{t2.vehicleId?.registrationNumber || '-'}</td>
                    <td className="px-4 py-3">{t2.driverId?.name || '-'}</td>
                    <td className="px-4 py-3 num text-ink-muted">{t2.deliveries.length}</td>
                    <td className="px-4 py-3"><span className={STATUS_CHIP[t2.status]}>{t2.status}</span></td>
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
  const { t } = useTranslation();
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
      toast(t('logistics.tripStarted'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
        <p className="font-display text-lg font-bold text-ink mb-4">{t('logistics.startATrip')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('logistics.branch')}</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">{t('logistics.selectEllipsis')}</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('logistics.vehicle')}</label>
            <select required className="field-input" value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
              <option value="">{t('logistics.selectEllipsis')}</option>
              {vehicles.map((v) => <option key={v._id} value={v._id}>{v.registrationNumber}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('logistics.driver')}</label>
            <select required className="field-input" value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })}>
              <option value="">{t('logistics.selectEllipsis')}</option>
              {drivers.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('logistics.startOdometer')}</label>
            <input type="number" required className="field-input num" value={form.startOdometer} onChange={(e) => setForm({ ...form, startOdometer: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('logistics.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('logistics.starting') : t('logistics.startTrip')}</button>
        </div>
      </form>
    </div>
  );
}

function TripPanel({ trip, onClose, onChanged }) {
  const { t } = useTranslation();
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
      toast(t('logistics.deliveryAdded'), 'success');
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
      toast(
        t('logistics.tripCompletedSummary', {
          distanceKm: result.distanceKm,
          profit: formatMoney(result.profitability, company?.currency),
        }) + (result.costPerKm !== null ? `, ${formatMoney(result.costPerKm, company?.currency)}/km` : '') + '.',
        'success'
      );
      onChanged(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="w-full lg:w-96 shrink-0 card p-5 h-fit">
      <div className="flex items-center justify-between mb-1">
        <p className="font-display text-lg font-bold text-ink">{trip.vehicleId?.registrationNumber}</p>
        <button className="btn-ghost !px-2 !py-1 text-xs" onClick={onClose}>{t('logistics.close')}</button>
      </div>
      <p className="text-sm text-ink-muted mb-4">{trip.driverId?.name}: {t('logistics.startedAt')} <span className="num">{trip.startOdometer}</span></p>

      {trip.status === 'planned' && (
        <>
          <form onSubmit={addDelivery} className="flex gap-2 mb-4">
            <input type="number" placeholder={t('logistics.deliveryRevenue')} className="field-input num" value={revenue} onChange={(e) => setRevenue(e.target.value)} />
            <button type="submit" disabled={!revenue || busy} className="btn-secondary shrink-0">{t('logistics.add')}</button>
          </form>

          <div className="tear-line my-4" />
          <p className="eyebrow mb-3">{t('logistics.completeTrip')}</p>
          <div className="space-y-2 mb-3">
            <input type="number" required placeholder={t('logistics.endOdometer')} className="field-input num" value={endOdometer} onChange={(e) => setEndOdometer(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" placeholder={t('logistics.fuelCost')} className="field-input num" value={fuelCost} onChange={(e) => setFuelCost(e.target.value)} />
              <input type="number" placeholder={t('logistics.otherCosts')} className="field-input num" value={otherCosts} onChange={(e) => setOtherCosts(e.target.value)} />
            </div>
          </div>
          <button className="btn-primary w-full" disabled={!endOdometer || busy} onClick={complete}>{busy ? t('logistics.completing') : t('logistics.completeTrip')}</button>
        </>
      )}
      {trip.status === 'completed' && (
        <div className="chip-accent inline-flex">{t('logistics.tripCompleted')}</div>
      )}
    </div>
  );
}

function FleetTab() {
  const { t } = useTranslation();
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="eyebrow">{t('logistics.vehicles')}</p>
          <button className="btn-ghost !text-accent !px-2 !py-1 text-xs" onClick={() => setShowVehicleForm(true)}>
            <span className="font-icon text-sm leading-none">add</span>
            {t('logistics.add')}
          </button>
        </div>
        {vehicles.length === 0 && <EmptyState title={t('logistics.noVehiclesYet')} />}
        <div className="space-y-2">
          {vehicles.map((v) => (
            <div key={v._id} className="flex items-center gap-3 rounded-lg border border-rule bg-paper px-3 py-2 text-sm">
              <span className="font-icon text-ink-muted text-base leading-none">local_shipping</span>
              <span className="num text-ink font-medium">{v.registrationNumber}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="eyebrow">{t('logistics.drivers')}</p>
          <button className="btn-ghost !text-accent !px-2 !py-1 text-xs" onClick={() => setShowDriverForm(true)}>
            <span className="font-icon text-sm leading-none">add</span>
            {t('logistics.add')}
          </button>
        </div>
        {drivers.length === 0 && <EmptyState title={t('logistics.noDriversYet')} />}
        <div className="space-y-2">
          {drivers.map((d) => (
            <div key={d._id} className="flex items-center gap-3 rounded-lg border border-rule bg-paper px-3 py-2 text-sm">
              <span className="font-icon text-ink-muted text-base leading-none">person</span>
              <span className="text-ink font-medium">{d.name}</span>
            </div>
          ))}
        </div>
      </div>
      {showVehicleForm && <VehicleForm onClose={() => setShowVehicleForm(false)} onSaved={() => { setShowVehicleForm(false); load(); }} />}
      {showDriverForm && <DriverForm onClose={() => setShowDriverForm(false)} onSaved={() => { setShowDriverForm(false); load(); }} />}
    </div>
  );
}

function VehicleForm({ onClose, onSaved }) {
  const { t } = useTranslation();
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
      toast(t('logistics.vehicleAdded'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
        <p className="font-display text-lg font-bold text-ink mb-4">{t('logistics.addVehicle')}</p>
        <div className="space-y-3">
          <select required className="field-input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">{t('logistics.branchEllipsis')}</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
          <input required className="field-input" placeholder={t('logistics.registrationNumber')} value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('logistics.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('logistics.saving') : t('logistics.save')}</button>
        </div>
      </form>
    </div>
  );
}

function DriverForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/logistics/drivers', { name });
      toast(t('logistics.driverAdded'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
        <p className="font-display text-lg font-bold text-ink mb-4">{t('logistics.addDriver')}</p>
        <input required className="field-input" placeholder={t('logistics.name')} value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('logistics.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('logistics.saving') : t('logistics.save')}</button>
        </div>
      </form>
    </div>
  );
}
