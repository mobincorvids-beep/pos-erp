import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

export function ServiceStationPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('vehicles');
  return (
    <div>
      <p className="eyebrow mb-1">{t('serviceStation.workshop')}</p>
      <p className="page-title mb-4">{t('serviceStation.title')}</p>
      <div className="flex gap-2 mb-5">
        {[['vehicles', t('serviceStation.vehicles')], ['due', t('serviceStation.serviceDue')]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={tab === key ? 'pill-active' : 'pill'}>{label}</button>
        ))}
      </div>
      {tab === 'vehicles' && <VehiclesTab />}
      {tab === 'due' && <DueTab />}
    </div>
  );
}

function VehiclesTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);

  function load() {
    setLoading(true);
    api.get('/service-station/vehicles').then(setVehicles).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-ink-muted">{t('serviceStation.registeredVehiclesHint')}</p>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <span className="font-icon text-base leading-none">add</span>
            {t('serviceStation.registerVehicle')}
          </button>
        </div>
        {loading && <Loading />}
        {!loading && vehicles.length === 0 && <EmptyState title={t('serviceStation.noVehiclesRegistered')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('serviceStation.registerOne')}</button>} />}
        {!loading && vehicles.length > 0 && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-sunken text-left text-xs text-ink-muted uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-semibold">{t('serviceStation.vehicle')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('serviceStation.owner')}</th>
                  <th className="px-4 py-2.5 font-semibold text-right">{t('serviceStation.mileage')}</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v._id} onClick={() => setSelected(v)} className={`border-t border-rule cursor-pointer hover:bg-surface-sunken/50 transition-colors ${selected?._id === v._id ? 'bg-accent-soft/40' : ''}`}>
                    <td className="px-4 py-2.5 font-medium text-ink">{v.make} {v.model} ({v.year}): {v.registrationNumber}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{v.customerId?.name}</td>
                    <td className="px-4 py-2.5 num text-right">{v.currentMileage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selected && <VehiclePanel vehicle={selected} onClose={() => setSelected(null)} onChanged={load} />}
      {showForm && <VehicleForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function VehicleForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ customerId: '', make: '', model: '', year: '', registrationNumber: '', currentMileage: 0, serviceIntervalMileage: 5000, serviceIntervalMonths: 6 });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/customers').then(setCustomers).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/service-station/vehicles', { ...form, year: Number(form.year) || undefined, currentMileage: Number(form.currentMileage), serviceIntervalMileage: Number(form.serviceIntervalMileage), serviceIntervalMonths: Number(form.serviceIntervalMonths) });
      toast(t('serviceStation.vehicleRegistered'), 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/30 backdrop-blur-sm flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm shadow-lg">
        <p className="page-title text-lg mb-4">{t('serviceStation.registerVehicle')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('serviceStation.owner')}</label>
            <select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">{t('serviceStation.select')}</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder={t('serviceStation.make')} className="field-input" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} />
            <input placeholder={t('serviceStation.model')} className="field-input" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" placeholder={t('serviceStation.year')} className="field-input num" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
            <input placeholder={t('serviceStation.regNumber')} required className="field-input" value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} />
          </div>
          <div>
            <label className="field-label">{t('serviceStation.currentMileage')}</label>
            <input type="number" className="field-input num" value={form.currentMileage} onChange={(e) => setForm({ ...form, currentMileage: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">{t('serviceStation.serviceEveryMi')}</label>
              <input type="number" className="field-input num" value={form.serviceIntervalMileage} onChange={(e) => setForm({ ...form, serviceIntervalMileage: e.target.value })} />
            </div>
            <div>
              <label className="field-label">{t('serviceStation.orEveryMonths')}</label>
              <input type="number" className="field-input num" value={form.serviceIntervalMonths} onChange={(e) => setForm({ ...form, serviceIntervalMonths: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('serviceStation.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('serviceStation.saving') : t('serviceStation.register')}</button>
        </div>
      </form>
    </div>
  );
}

function VehiclePanel({ vehicle, onClose, onChanged }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [mileage, setMileage] = useState(vehicle.currentMileage);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get(`/service-station/vehicles/${vehicle._id}/history`).then(setHistory).catch(() => {}); }, [vehicle._id]);

  async function updateMileage() {
    setBusy(true);
    try {
      await api.patch(`/service-station/vehicles/${vehicle._id}/mileage`, { mileage: Number(mileage) });
      toast(t('serviceStation.mileageUpdated'), 'success');
      onChanged();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function recordServiceCompleted() {
    setBusy(true);
    try {
      await api.post(`/service-station/vehicles/${vehicle._id}/service-completed`, { mileageAtService: Number(mileage) });
      toast(t('serviceStation.serviceRecorded'), 'success');
      onChanged(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="w-full lg:w-96 shrink-0 card p-4 h-fit">
      <div className="flex items-center justify-between mb-3">
        <p className="page-title text-lg">{vehicle.make} {vehicle.model}</p>
        <button className="btn-ghost !px-0 text-xs" onClick={onClose}>{t('serviceStation.close')}</button>
      </div>
      <p className="text-sm text-ink-muted mb-4">{vehicle.registrationNumber}</p>
      <label className="field-label">{t('serviceStation.updateMileage')}</label>
      <input type="number" className="field-input num mb-2" value={mileage} onChange={(e) => setMileage(e.target.value)} />
      <button className="btn-secondary w-full mb-4" disabled={busy} onClick={updateMileage}>{t('serviceStation.update')}</button>
      <button className="btn-primary w-full mb-4" disabled={busy} onClick={recordServiceCompleted}>{t('serviceStation.recordServiceCompletedHere')}</button>
      <div className="tear-line my-3" />
      <p className="text-sm font-semibold text-ink mb-2">{t('serviceStation.serviceHistory')}</p>
      {history.length === 0 && <p className="text-sm text-ink-muted">{t('serviceStation.noJobCardsYet')}</p>}
      {history.map((h) => (
        <div key={h._id} className="flex items-center justify-between text-sm border-t border-rule py-1.5 first:border-0">
          <span className="text-ink">{h.itemDescription}</span>
          <span className="chip-neutral">{h.status}</span>
        </div>
      ))}
    </div>
  );
}

function DueTab() {
  const { t } = useTranslation();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/service-station/due').then(setRows).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (rows.length === 0) return <EmptyState title={t('serviceStation.nothingDueForService')} />;
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-sunken text-left text-xs text-ink-muted uppercase tracking-wide">
            <th className="px-4 py-2.5 font-semibold">{t('serviceStation.vehicle')}</th>
            <th className="px-4 py-2.5 font-semibold">{t('serviceStation.owner')}</th>
            <th className="px-4 py-2.5 font-semibold text-right">{t('serviceStation.mileage')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v._id} className="border-t border-rule hover:bg-surface-sunken/50 transition-colors">
              <td className="px-4 py-2.5 font-medium text-ink">{v.make} {v.model}: {v.registrationNumber}</td>
              <td className="px-4 py-2.5 text-ink-muted">{v.customerId?.name}</td>
              <td className="px-4 py-2.5 num text-right text-danger">{v.currentMileage}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
