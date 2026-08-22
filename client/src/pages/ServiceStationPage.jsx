import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

export function ServiceStationPage() {
  const [tab, setTab] = useState('vehicles');
  return (
    <div>
      <p className="page-title mb-4">Service Station</p>
      <div className="flex gap-1 border-b border-rule mb-5">
        {[['vehicles', 'Vehicles'], ['due', 'Service due']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === key ? 'border-accent text-accent-strong font-medium' : 'border-transparent text-ink-muted hover:text-ink'}`}>{label}</button>
        ))}
      </div>
      {tab === 'vehicles' && <VehiclesTab />}
      {tab === 'due' && <DueTab />}
    </div>
  );
}

function VehiclesTab() {
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
        <div className="flex justify-end mb-3"><button className="btn-primary" onClick={() => setShowForm(true)}>Register vehicle</button></div>
        {loading && <Loading />}
        {!loading && vehicles.length === 0 && <EmptyState title="No vehicles registered" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Register one</button>} />}
        {!loading && vehicles.length > 0 && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide"><th className="px-3 py-2 font-medium">Vehicle</th><th className="px-3 py-2 font-medium">Owner</th><th className="px-3 py-2 font-medium text-right">Mileage</th></tr></thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v._id} onClick={() => setSelected(v)} className={`border-b border-rule last:border-0 cursor-pointer hover:bg-paper ${selected?._id === v._id ? 'bg-accent-soft/40' : ''}`}>
                    <td className="px-3 py-2">{v.make} {v.model} ({v.year}) — {v.registrationNumber}</td>
                    <td className="px-3 py-2 text-ink-muted">{v.customerId?.name}</td>
                    <td className="px-3 py-2 num text-right">{v.currentMileage}</td>
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
      toast('Vehicle registered.', 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">Register vehicle</p>
        <div className="space-y-3">
          <div><label className="field-label">Owner</label><select required className="field-input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}><option value="">Select…</option>{customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Make" className="field-input" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} />
            <input placeholder="Model" className="field-input" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" placeholder="Year" className="field-input num" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
            <input placeholder="Reg. number" required className="field-input" value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} />
          </div>
          <div><label className="field-label">Current mileage</label><input type="number" className="field-input num" value={form.currentMileage} onChange={(e) => setForm({ ...form, currentMileage: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="field-label">Service every (mi)</label><input type="number" className="field-input num" value={form.serviceIntervalMileage} onChange={(e) => setForm({ ...form, serviceIntervalMileage: e.target.value })} /></div>
            <div><label className="field-label">Or every (months)</label><input type="number" className="field-input num" value={form.serviceIntervalMonths} onChange={(e) => setForm({ ...form, serviceIntervalMonths: e.target.value })} /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Register'}</button></div>
      </form>
    </div>
  );
}

function VehiclePanel({ vehicle, onClose, onChanged }) {
  const toast = useToast();
  const [mileage, setMileage] = useState(vehicle.currentMileage);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get(`/service-station/vehicles/${vehicle._id}/history`).then(setHistory).catch(() => {}); }, [vehicle._id]);

  async function updateMileage() {
    setBusy(true);
    try {
      await api.patch(`/service-station/vehicles/${vehicle._id}/mileage`, { mileage: Number(mileage) });
      toast('Mileage updated.', 'success');
      onChanged();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function recordServiceCompleted() {
    setBusy(true);
    try {
      await api.post(`/service-station/vehicles/${vehicle._id}/service-completed`, { mileageAtService: Number(mileage) });
      toast('Service recorded — next-due reset.', 'success');
      onChanged(); onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="w-full lg:w-96 shrink-0 card p-4 h-fit">
      <div className="flex items-center justify-between mb-3"><p className="font-display text-lg">{vehicle.make} {vehicle.model}</p><button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>Close</button></div>
      <p className="text-sm text-ink-muted mb-4">{vehicle.registrationNumber}</p>
      <label className="field-label">Update mileage</label>
      <input type="number" className="field-input num mb-2" value={mileage} onChange={(e) => setMileage(e.target.value)} />
      <button className="btn-secondary w-full mb-4" disabled={busy} onClick={updateMileage}>Update</button>
      <button className="btn-primary w-full mb-4" disabled={busy} onClick={recordServiceCompleted}>Record service completed here</button>
      <div className="tear-line my-3" />
      <p className="text-sm font-medium mb-2">Service history</p>
      {history.length === 0 && <p className="text-sm text-ink-muted">No job cards yet.</p>}
      {history.map((h) => <div key={h._id} className="text-sm border-b border-rule py-1.5">{h.itemDescription} — <span className="chip-neutral">{h.status}</span></div>)}
    </div>
  );
}

function DueTab() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/service-station/due').then(setRows).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (rows.length === 0) return <EmptyState title="Nothing due for service" />;
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide"><th className="px-3 py-2 font-medium">Vehicle</th><th className="px-3 py-2 font-medium">Owner</th><th className="px-3 py-2 font-medium text-right">Mileage</th></tr></thead>
        <tbody>{rows.map((v) => (<tr key={v._id} className="border-b border-rule last:border-0"><td className="px-3 py-2">{v.make} {v.model} — {v.registrationNumber}</td><td className="px-3 py-2 text-ink-muted">{v.customerId?.name}</td><td className="px-3 py-2 num text-right text-danger">{v.currentMileage}</td></tr>))}</tbody>
      </table>
    </div>
  );
}
