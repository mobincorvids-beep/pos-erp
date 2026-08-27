import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function PetrolPumpPage() {
  const [tab, setTab] = useState('dispensers');
  return (
    <div>
      <p className="page-title mb-1">Petrol Pump</p>
      <p className="text-sm text-ink-muted mb-5">Dispensers, meter readings and shift reconciliation.</p>
      <div className="flex gap-1 border-b border-rule mb-5">
        {[['dispensers', 'Dispensers'], ['shifts', 'Shifts']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 transition-colors ${tab === key ? 'border-accent text-accent-strong font-semibold' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'dispensers' && <DispensersTab />}
      {tab === 'shifts' && <ShiftsTab />}
    </div>
  );
}

function DispensersTab() {
  const toast = useToast();
  const [dispensers, setDispensers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [opening, setOpening] = useState(null);

  function load() {
    setLoading(true);
    api.get('/petrol-pump/dispensers').then(setDispensers).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="eyebrow">{dispensers.length} dispenser{dispensers.length === 1 ? '' : 's'}</p>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="font-icon text-[18px] leading-none">add</span>
          Add dispenser
        </button>
      </div>
      {loading && <Loading />}
      {!loading && dispensers.length === 0 && <EmptyState title="No dispensers yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Add a dispenser</button>} />}
      {!loading && dispensers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {dispensers.map((d) => (
            <div key={d._id} className="card p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{d.name}</p>
                <span className="chip-neutral shrink-0">Meter</span>
              </div>
              <p className="text-2xl font-display font-bold num text-ink">{d.currentMeterReading}</p>
              <button className="btn-ghost !px-0 !py-0 h-auto justify-start text-xs !text-accent w-fit mt-1" onClick={() => setOpening(d)}>Open shift →</button>
            </div>
          ))}
        </div>
      )}
      {showForm && <DispenserForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {opening && <OpenShiftForm dispenser={opening} onClose={() => setOpening(null)} />}
    </div>
  );
}

function DispenserForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ branchId: '', name: '', productId: '', variantId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/products').then(setProducts).catch(() => {});
  }, []);

  const selectedProduct = products.find((p) => p._id === form.productId);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (!form.variantId) throw new Error('Select a product with a variant.');
      await api.post('/petrol-pump/dispensers', form);
      toast('Dispenser created.', 'success');
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
        <p className="font-display text-lg font-semibold mb-4">Add dispenser</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Branch</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">Name</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Pump 1 - Nozzle A" /></div>
          <div>
            <label className="field-label">Fuel product</label>
            <select required className="field-input" value={form.productId} onChange={(e) => {
              const product = products.find((p) => p._id === e.target.value);
              setForm({ ...form, productId: e.target.value, variantId: product?.variants?.[0]?._id || '' });
            }}>
              <option value="">Select…</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
            {form.productId && !selectedProduct?.variants?.length && <p className="text-xs text-warning mt-1">This product has no variants.</p>}
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

function OpenShiftForm({ dispenser, onClose }) {
  const toast = useToast();
  const [pricePerLitre, setPricePerLitre] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/petrol-pump/dispensers/${dispenser._id}/shifts/open`, { pricePerLitre: Number(pricePerLitre) });
      toast('Shift opened.', 'success');
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg font-semibold mb-1">Open shift — {dispenser.name}</p>
        <p className="text-sm text-ink-muted mb-4 num">Opening reading: {dispenser.currentMeterReading}</p>
        <div><label className="field-label">Price per litre</label><input type="number" step="0.01" required autoFocus className="field-input num" value={pricePerLitre} onChange={(e) => setPricePerLitre(e.target.value)} /></div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Opening…' : 'Open shift'}</button>
        </div>
      </form>
    </div>
  );
}

function ShiftsTab() {
  const { company } = useAuth();
  const toast = useToast();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(null);

  function load() {
    setLoading(true);
    api.get('/petrol-pump/shifts').then(setShifts).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  if (loading) return <Loading />;
  if (shifts.length === 0) return <EmptyState title="No shifts yet" />;

  return (
    <div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken">
                <th className="px-3 py-2.5 font-semibold">Dispenser</th>
                <th className="px-3 py-2.5 font-semibold">Opening</th>
                <th className="px-3 py-2.5 font-semibold">Closing</th>
                <th className="px-3 py-2.5 font-semibold">Litres sold</th>
                <th className="px-3 py-2.5 font-semibold">Price/L</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s._id} className="border-b border-rule last:border-0 hover:bg-surface-sunken/50">
                  <td className="px-3 py-2.5 font-medium text-ink">{s.dispenserId?.name || '—'}</td>
                  <td className="px-3 py-2.5 num">{s.openingReading}</td>
                  <td className="px-3 py-2.5 num">{s.closingReading ?? '—'}</td>
                  <td className="px-3 py-2.5 num">{s.litresSold ?? '—'}</td>
                  <td className="px-3 py-2.5 num">{formatMoney(s.pricePerLitre, company?.currency)}</td>
                  <td className="px-3 py-2.5"><span className={s.status === 'open' ? 'chip-warning' : 'chip-accent'}>{s.status}</span></td>
                  <td className="px-3 py-2.5">
                    {s.status === 'open' && <button className="btn-ghost !px-0 !py-0 h-auto !text-accent text-xs" onClick={() => setClosing(s)}>Close shift</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {closing && <CloseShiftForm shift={closing} onClose={() => setClosing(null)} onSaved={() => { setClosing(null); load(); }} />}
    </div>
  );
}

function CloseShiftForm({ shift, onClose, onSaved }) {
  const { company } = useAuth();
  const toast = useToast();
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ closingReading: '', warehouseId: '', billingProductId: '', billingVariantId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/warehouses').then(setWarehouses).catch(() => {});
    api.get('/products').then(setProducts).catch(() => {});
  }, []);

  const selectedProduct = products.find((p) => p._id === form.billingProductId);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (!form.billingVariantId) throw new Error('Select a billing product with a variant.');
      const result = await api.post(`/petrol-pump/shifts/${shift._id}/close`, { ...form, closingReading: Number(form.closingReading) });
      toast(`Shift closed — ${result.litresSold} L sold for ${formatMoney(result.totalAmount, company?.currency)}.`, 'success');
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
        <p className="font-display text-lg font-semibold mb-1">Close shift — {shift.dispenserId?.name || ''}</p>
        <p className="text-sm text-ink-muted mb-4 num">Opening reading: {shift.openingReading}</p>
        <div className="space-y-3">
          <div><label className="field-label">Closing reading</label><input type="number" step="0.001" required autoFocus className="field-input num" value={form.closingReading} onChange={(e) => setForm({ ...form, closingReading: e.target.value })} /></div>
          <div>
            <label className="field-label">Warehouse</label>
            <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}>
              <option value="">Select…</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Billing product (fuel grade)</label>
            <select required className="field-input" value={form.billingProductId} onChange={(e) => {
              const product = products.find((p) => p._id === e.target.value);
              setForm({ ...form, billingProductId: e.target.value, billingVariantId: product?.variants?.[0]?._id || '' });
            }}>
              <option value="">Select…</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
            {form.billingProductId && !selectedProduct?.variants?.length && <p className="text-xs text-warning mt-1">This product has no variants.</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Closing…' : 'Close shift'}</button>
        </div>
      </form>
    </div>
  );
}
