import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate, formatDateTime } from '../lib/format';

export function FleetPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('Vehicles');
  const TABS = [
    { key: 'Vehicles', icon: 'local_shipping', label: t('fleet.vehicles') },
    { key: 'Fuel Logs', icon: 'local_gas_station', label: t('fleet.fuelLogs') },
    { key: 'Trips', icon: 'route', label: t('fleet.trips') },
  ];
  return (
    <div>
      <div className="flex justify-between items-end flex-wrap gap-4 mb-6">
        <div>
          <p className="page-title">{t('fleet.title')}</p>
          <p className="text-sm text-ink-muted mt-1">{t('fleet.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {TABS.map((tb) => (
            <button key={tb.key} onClick={() => setTab(tb.key)} className={tab === tb.key ? 'pill-active' : 'pill'}>
              <span className="material-symbols-outlined text-sm mr-1 align-middle">{tb.icon}</span>
              {tb.label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'Vehicles' && <VehiclesTab />}
      {tab === 'Fuel Logs' && <FuelLogsTab />}
      {tab === 'Trips' && <TripsTab />}
    </div>
  );
}

const STATUS_CHIP = {
  active: 'chip-accent',
  maintenance: 'chip-warning',
  retired: 'chip-neutral',
  scheduled: 'chip-info',
  in_progress: 'chip-warning',
  completed: 'chip-accent',
  cancelled: 'chip-neutral',
};

function StatusChip({ status }) {
  const cls = STATUS_CHIP[status] || 'chip-neutral';
  return (
    <span className={`${cls} gap-1.5 capitalize`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {status?.replace('_', ' ')}
    </span>
  );
}

function Avatar({ name }) {
  const { t } = useTranslation();
  if (!name) {
    return <div className="w-8 h-8 rounded-full bg-surface-sunken border border-rule flex items-center justify-center text-[11px] font-semibold text-ink-muted">{t('fleet.unassignedInitials')}</div>;
  }
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return <div className="w-8 h-8 rounded-full bg-accent-soft border border-rule flex items-center justify-center text-[11px] font-semibold text-accent-strong">{initials}</div>;
}

function VehiclesTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  function load() {
    setLoading(true);
    api.get('/fleet/vehicles').then(setVehicles).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function retire(id) {
    if (!confirm(t('fleet.retireVehicleConfirm'))) return;
    try { await api.post(`/fleet/vehicles/${id}/retire`); load(); }
    catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="material-symbols-outlined text-sm">add</span>
          {t('fleet.newVehicle')}
        </button>
      </div>
      {loading && <Loading />}
      {!loading && vehicles.length === 0 && <EmptyState title={t('fleet.noVehiclesRegistered')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('fleet.registerOne')}</button>} />}
      {!loading && vehicles.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-rule flex justify-between items-center bg-surface-sunken/40">
            <p className="font-display text-lg font-semibold text-ink">{t('fleet.fleetStatus')}</p>
            <span className="eyebrow">{t('fleet.vehiclesCount', { count: vehicles.length })}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead>
                <tr className="border-b border-rule bg-surface-sunken/60">
                  <th className="py-3 px-5 eyebrow font-medium">{t('fleet.unit')}</th>
                  <th className="py-3 px-5 eyebrow font-medium">{t('fleet.typeSlashFuel')}</th>
                  <th className="py-3 px-5 eyebrow font-medium">{t('fleet.odometer')}</th>
                  <th className="py-3 px-5 eyebrow font-medium">{t('fleet.status')}</th>
                  <th className="py-3 px-5 eyebrow font-medium">{t('fleet.assignedDriver')}</th>
                  <th className="py-3 px-5 eyebrow font-medium text-right">{t('fleet.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {vehicles.map((v) => (
                  <tr key={v._id} className="hover:bg-accent-soft/30 transition-colors">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-surface-sunken flex items-center justify-center text-ink-muted shrink-0">
                          <span className="material-symbols-outlined">local_shipping</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-ink num">{v.registrationNumber}</p>
                          <p className="text-xs text-ink-muted">{v.make} {v.model} {v.year ? `(${v.year})` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-sm text-ink capitalize">{v.type} · {v.fuelType}</td>
                    <td className="py-3 px-5 text-sm text-ink-muted num">{t('fleet.odometerKm', { value: v.odometerReading })}</td>
                    <td className="py-3 px-5"><StatusChip status={v.status} /></td>
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2">
                        <Avatar name={v.assignedDriverId?.name} />
                        <span className={`text-sm ${v.assignedDriverId ? 'text-ink' : 'text-ink-muted italic'}`}>{v.assignedDriverId?.name || t('fleet.unassigned')}</span>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-right">
                      {v.status !== 'retired' ? (
                        <div className="flex gap-3 justify-end">
                          <button className="btn-ghost !text-accent !px-0 text-xs" onClick={() => setEditing(v)}>{t('fleet.edit')}</button>
                          <button className="btn-ghost !text-danger !px-0 text-xs" onClick={() => retire(v._id)}>{t('fleet.retire')}</button>
                        </div>
                      ) : <span className="text-xs text-ink-muted">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {showForm && <VehicleForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {editing && <VehicleForm vehicle={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function VehicleForm({ vehicle, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(vehicle ? {
    registrationNumber: vehicle.registrationNumber, make: vehicle.make || '', model: vehicle.model || '',
    year: vehicle.year || '', type: vehicle.type, fuelType: vehicle.fuelType,
    assignedDriverId: vehicle.assignedDriverId?._id || '', odometerReading: vehicle.odometerReading || 0, notes: vehicle.notes || '',
  } : { registrationNumber: '', make: '', model: '', year: '', type: 'car', fuelType: 'petrol', assignedDriverId: '', odometerReading: 0, notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/users').then(setUsers).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, year: form.year ? Number(form.year) : undefined, odometerReading: Number(form.odometerReading), assignedDriverId: form.assignedDriverId || undefined };
      if (vehicle) await api.put(`/fleet/vehicles/${vehicle._id}`, payload);
      else await api.post('/fleet/vehicles', payload);
      toast(vehicle ? t('fleet.vehicleUpdated') : t('fleet.vehicleRegistered'), 'success');
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
        <p className="font-display text-lg mb-4">{vehicle ? t('fleet.editVehicle') : t('fleet.newVehicle')}</p>
        <div className="space-y-3">
          <input required disabled={!!vehicle} className="field-input" placeholder={t('fleet.registrationNumber')} value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input className="field-input" placeholder={t('fleet.make')} value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} />
            <input className="field-input" placeholder={t('fleet.model')} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" className="field-input num" placeholder={t('fleet.year')} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
            <select className="field-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="car">{t('fleet.car')}</option><option value="van">{t('fleet.van')}</option><option value="truck">{t('fleet.truck')}</option>
              <option value="bike">{t('fleet.bike')}</option><option value="bus">{t('fleet.bus')}</option><option value="other">{t('fleet.other')}</option>
            </select>
          </div>
          <select className="field-input" value={form.fuelType} onChange={(e) => setForm({ ...form, fuelType: e.target.value })}>
            <option value="petrol">{t('fleet.petrol')}</option><option value="diesel">{t('fleet.diesel')}</option><option value="cng">{t('fleet.cng')}</option>
            <option value="electric">{t('fleet.electric')}</option><option value="hybrid">{t('fleet.hybrid')}</option><option value="other">{t('fleet.other')}</option>
          </select>
          <select className="field-input" value={form.assignedDriverId} onChange={(e) => setForm({ ...form, assignedDriverId: e.target.value })}>
            <option value="">{t('fleet.assignDriverOptionalEllipsis')}</option>
            {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
          <div><label className="field-label">{t('fleet.odometerReading')}</label><input type="number" min="0" className="field-input num" value={form.odometerReading} onChange={(e) => setForm({ ...form, odometerReading: e.target.value })} /></div>
          <textarea className="field-input" placeholder={t('fleet.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('fleet.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('fleet.savingEllipsis') : vehicle ? t('fleet.save') : t('fleet.register')}</button>
        </div>
      </form>
    </div>
  );
}

function FuelLogsTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/fleet/fuel-logs').then(setLogs).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="material-symbols-outlined text-sm">add</span>
          {t('fleet.logFuel')}
        </button>
      </div>
      {loading && <Loading />}
      {!loading && logs.length === 0 && <EmptyState title={t('fleet.noFuelLogs')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('fleet.logOne')}</button>} />}
      {!loading && logs.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-rule flex justify-between items-center bg-surface-sunken/40">
            <p className="font-display text-lg font-semibold text-ink">{t('fleet.fuelLogs')}</p>
            <span className="eyebrow">{t('fleet.entriesCount', { count: logs.length })}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-rule bg-surface-sunken/60">
                  <th className="py-3 px-5 eyebrow font-medium">{t('fleet.vehicle')}</th>
                  <th className="py-3 px-5 eyebrow font-medium">{t('fleet.date')}</th>
                  <th className="py-3 px-5 eyebrow font-medium">{t('fleet.quantity')}</th>
                  <th className="py-3 px-5 eyebrow font-medium">{t('fleet.odometer')}</th>
                  <th className="py-3 px-5 eyebrow font-medium text-right">{t('fleet.cost')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {logs.map((f) => (
                  <tr key={f._id} className="hover:bg-accent-soft/30 transition-colors">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-surface-sunken flex items-center justify-center text-ink-muted shrink-0">
                          <span className="material-symbols-outlined">local_gas_station</span>
                        </div>
                        <p className="text-sm font-semibold text-ink num">{f.vehicleId?.registrationNumber}</p>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-sm text-ink-muted">{formatDate(f.date)}</td>
                    <td className="py-3 px-5 text-sm text-ink num">{f.quantity}</td>
                    <td className="py-3 px-5 text-sm text-ink-muted num">{f.odometerReading}</td>
                    <td className="py-3 px-5 text-sm text-ink font-semibold text-right num">{formatMoney(f.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {showForm && <FuelLogForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function FuelLogForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [vehicles, setVehicles] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ vehicleId: '', odometerReading: '', quantity: '', cost: '', expenseAccountId: '', paymentAccountId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/fleet/vehicles').then(setVehicles).catch(() => {});
    api.get('/org/accounts').then(setAccounts).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/fleet/fuel-logs', {
        ...form, odometerReading: Number(form.odometerReading), quantity: Number(form.quantity), cost: Number(form.cost),
      });
      toast(t('fleet.fuelLogged'), 'success');
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
        <p className="font-display text-lg mb-4">{t('fleet.logFuel')}</p>
        <div className="space-y-3">
          <select required className="field-input" value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
            <option value="">{t('fleet.vehicleEllipsis')}</option>
            {vehicles.map((v) => <option key={v._id} value={v._id}>{v.registrationNumber}</option>)}
          </select>
          <div><label className="field-label">{t('fleet.odometerReading')}</label><input type="number" min="0" required className="field-input num" value={form.odometerReading} onChange={(e) => setForm({ ...form, odometerReading: e.target.value })} /></div>
          <div><label className="field-label">{t('fleet.quantity')}</label><input type="number" min="0" step="0.01" required className="field-input num" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
          <div><label className="field-label">{t('fleet.cost')}</label><input type="number" min="0" step="0.01" required className="field-input num" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></div>
          <div>
            <label className="field-label">{t('fleet.expenseAccount')}</label>
            <select required className="field-input" value={form.expenseAccountId} onChange={(e) => setForm({ ...form, expenseAccountId: e.target.value })}>
              <option value="">{t('fleet.selectEllipsis')}</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('fleet.paidFrom')}</label>
            <select required className="field-input" value={form.paymentAccountId} onChange={(e) => setForm({ ...form, paymentAccountId: e.target.value })}>
              <option value="">{t('fleet.selectEllipsis')}</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('fleet.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('fleet.savingEllipsis') : t('fleet.log')}</button>
        </div>
      </form>
    </div>
  );
}

function TripsTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [completing, setCompleting] = useState(null);

  function load() {
    setLoading(true);
    api.get('/fleet/trips').then(setTrips).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function cancel(id) {
    if (!confirm(t('fleet.cancelTripConfirm'))) return;
    try { await api.post(`/fleet/trips/${id}/cancel`); load(); }
    catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="material-symbols-outlined text-sm">add</span>
          {t('fleet.startTrip')}
        </button>
      </div>
      {loading && <Loading />}
      {!loading && trips.length === 0 && <EmptyState title={t('fleet.noTrips')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('fleet.startOne')}</button>} />}
      {!loading && trips.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-rule flex justify-between items-center bg-surface-sunken/40">
            <p className="font-display text-lg font-semibold text-ink">{t('fleet.trips')}</p>
            <span className="eyebrow">{t('fleet.tripsCount', { count: trips.length })}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-rule bg-surface-sunken/60">
                  <th className="py-3 px-5 eyebrow font-medium">{t('fleet.vehicleSlashDestination')}</th>
                  <th className="py-3 px-5 eyebrow font-medium">{t('fleet.driver')}</th>
                  <th className="py-3 px-5 eyebrow font-medium">{t('fleet.started')}</th>
                  <th className="py-3 px-5 eyebrow font-medium">{t('fleet.distance')}</th>
                  <th className="py-3 px-5 eyebrow font-medium">{t('fleet.status')}</th>
                  <th className="py-3 px-5 eyebrow font-medium text-right">{t('fleet.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {trips.map((t2) => (
                  <tr key={t2._id} className="hover:bg-accent-soft/30 transition-colors">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-surface-sunken flex items-center justify-center text-ink-muted shrink-0">
                          <span className="material-symbols-outlined">route</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-ink num">{t2.vehicleId?.registrationNumber}</p>
                          <p className="text-xs text-ink-muted">{t2.destination || t2.purpose || t('fleet.trip')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2">
                        <Avatar name={t2.driverId?.name} />
                        <span className={`text-sm ${t2.driverId ? 'text-ink' : 'text-ink-muted italic'}`}>{t2.driverId?.name || t('fleet.unassigned')}</span>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-sm text-ink-muted">{formatDateTime(t2.startTime)}</td>
                    <td className="py-3 px-5 text-sm text-ink-muted num">{t2.endOdometer != null ? t('fleet.distanceKm', { value: t2.endOdometer - t2.startOdometer }) : '-'}</td>
                    <td className="py-3 px-5"><StatusChip status={t2.status} /></td>
                    <td className="py-3 px-5 text-right">
                      {(t2.status === 'scheduled' || t2.status === 'in_progress') ? (
                        <div className="flex gap-3 justify-end">
                          <button className="btn-ghost !text-accent !px-0 text-xs" onClick={() => setCompleting(t2)}>{t('fleet.complete')}</button>
                          <button className="btn-ghost !text-danger !px-0 text-xs" onClick={() => cancel(t2._id)}>{t('fleet.cancel')}</button>
                        </div>
                      ) : <span className="text-xs text-ink-muted">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {showForm && <TripForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {completing && <CompleteTripForm trip={completing} onClose={() => setCompleting(null)} onSaved={() => { setCompleting(null); load(); }} />}
    </div>
  );
}

function TripForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [vehicles, setVehicles] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ vehicleId: '', driverId: '', purpose: '', destination: '', startOdometer: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/fleet/vehicles?status=active').then(setVehicles).catch(() => {});
    api.get('/users').then(setUsers).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/fleet/trips', {
        ...form, driverId: form.driverId || undefined,
        startOdometer: form.startOdometer !== '' ? Number(form.startOdometer) : undefined,
      });
      toast(t('fleet.tripStarted'), 'success');
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
        <p className="font-display text-lg mb-4">{t('fleet.startTrip')}</p>
        <div className="space-y-3">
          <select required className="field-input" value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
            <option value="">{t('fleet.vehicleEllipsis')}</option>
            {vehicles.map((v) => <option key={v._id} value={v._id}>{v.registrationNumber}</option>)}
          </select>
          <select className="field-input" value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })}>
            <option value="">{t('fleet.driverOptionalEllipsis')}</option>
            {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
          <input className="field-input" placeholder={t('fleet.purpose')} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
          <input className="field-input" placeholder={t('fleet.destination')} value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
          <div><label className="field-label">{t('fleet.startOdometerDefault')}</label><input type="number" min="0" className="field-input num" value={form.startOdometer} onChange={(e) => setForm({ ...form, startOdometer: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('fleet.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('fleet.startingEllipsis') : t('fleet.start')}</button>
        </div>
      </form>
    </div>
  );
}

function CompleteTripForm({ trip, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [endOdometer, setEndOdometer] = useState(trip.startOdometer);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/fleet/trips/${trip._id}/complete`, { endOdometer: Number(endOdometer), notes });
      toast(t('fleet.tripCompleted'), 'success');
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
        <p className="font-display text-lg mb-4">{t('fleet.completeTrip')}</p>
        <div className="space-y-3">
          <div><label className="field-label">{t('fleet.endOdometer')}</label><input type="number" min={trip.startOdometer} required className="field-input num" value={endOdometer} onChange={(e) => setEndOdometer(e.target.value)} /></div>
          <textarea className="field-input" placeholder={t('fleet.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('fleet.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('fleet.savingEllipsis') : t('fleet.complete')}</button>
        </div>
      </form>
    </div>
  );
}
