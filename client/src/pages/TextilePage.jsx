import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';

const STATUS_CHIP = { active: 'chip-accent', remnant: 'chip-warning', exhausted: 'chip-neutral' };

export function TextilePage() {
  const toast = useToast();
  const [rolls, setRolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [cutting, setCutting] = useState(null);
  const [cutLength, setCutLength] = useState('');

  function load() {
    setLoading(true);
    api.get('/textile/rolls').then(setRolls).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function cut(e) {
    e.preventDefault();
    try {
      await api.post(`/textile/rolls/${cutting._id}/cut`, { lengthToCut: Number(cutLength) });
      toast('Cut recorded.', 'success');
      setCutting(null); setCutLength('');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="page-title">Fabric Rolls</p>
        <button className="btn-primary" onClick={() => setShowForm(true)}>Receive roll</button>
      </div>
      {loading && <Loading />}
      {!loading && rolls.length === 0 && <EmptyState title="No rolls yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Receive one</button>} />}
      {!loading && rolls.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {rolls.map((r) => (
            <div key={r._id} className="card p-3">
              <div className="flex items-center justify-between mb-1"><p className="text-sm font-medium">{r.rollNumber}</p><span className={STATUS_CHIP[r.status]}>{r.status}</span></div>
              <p className="text-xs text-ink-muted">{r.remainingLength}/{r.originalLength} {r.unitOfMeasure}</p>
              {r.status !== 'exhausted' && <button className="btn-ghost !text-accent !px-0 text-xs mt-2" onClick={() => setCutting(r)}>Cut</button>}
            </div>
          ))}
        </div>
      )}
      {showForm && <RollForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {cutting && (
        <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
          <form onSubmit={cut} className="card p-5 w-full max-w-xs">
            <p className="font-display text-lg mb-1">Cut from {cutting.rollNumber}</p>
            <p className="text-sm text-ink-muted mb-4">{cutting.remainingLength} {cutting.unitOfMeasure} remaining</p>
            <input type="number" required className="field-input num mb-4" value={cutLength} onChange={(e) => setCutLength(e.target.value)} placeholder="Length to cut" />
            <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setCutting(null)}>Cancel</button><button type="submit" className="btn-primary">Cut</button></div>
          </form>
        </div>
      )}
    </div>
  );
}

function RollForm({ onClose, onSaved }) {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState({ productId: '', warehouseId: '', rollNumber: '', unitOfMeasure: 'meters', length: '', unitCost: '', remnantThreshold: 5 });
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get('/products').then(setProducts).catch(() => {}); api.get('/org/warehouses').then(setWarehouses).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const product = products.find((p) => p._id === form.productId);
      await api.post('/textile/rolls', { ...form, variantId: product?.variants[0]?._id, length: Number(form.length), unitCost: Number(form.unitCost) || 0, remnantThreshold: Number(form.remnantThreshold) });
      toast('Roll received.', 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">Receive roll</p>
        <div className="space-y-3">
          <select required className="field-input" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}><option value="">Product…</option>{products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
          <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}><option value="">Warehouse…</option>{warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}</select>
          <input required placeholder="Roll number" className="field-input" value={form.rollNumber} onChange={(e) => setForm({ ...form, rollNumber: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" required placeholder="Length" className="field-input num" value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} />
            <select className="field-input" value={form.unitOfMeasure} onChange={(e) => setForm({ ...form, unitOfMeasure: e.target.value })}><option value="meters">Meters</option><option value="yards">Yards</option></select>
          </div>
          <input type="number" placeholder="Remnant threshold" className="field-input num" value={form.remnantThreshold} onChange={(e) => setForm({ ...form, remnantThreshold: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 mt-5"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Receive'}</button></div>
      </form>
    </div>
  );
}
