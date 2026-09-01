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
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="eyebrow mb-1">Textile operations</p>
          <p className="page-title">Fabric rolls</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <span className="material-symbols-outlined text-sm">add</span>
          Receive roll
        </button>
      </div>

      {loading && <Loading />}
      {!loading && rolls.length === 0 && <EmptyState title="No rolls yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Receive one</button>} />}
      {!loading && rolls.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rolls.map((r) => (
            <div key={r._id} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-ink flex items-center gap-2">
                  <span className="material-symbols-outlined text-accent text-base">texture</span>
                  {r.rollNumber}
                </p>
                <span className={STATUS_CHIP[r.status]}>{r.status}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-ink-muted">Remaining</span>
                <span className="num text-ink">{r.remainingLength}/{r.originalLength} {r.unitOfMeasure}</span>
              </div>
              {r.status !== 'exhausted' && <button className="btn-ghost !text-accent !px-0 text-xs mt-3" onClick={() => setCutting(r)}>Cut</button>}
            </div>
          ))}
        </div>
      )}
      {showForm && <RollForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {cutting && (
        <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
          <form onSubmit={cut} className="card p-5 w-full max-w-xs">
            <p className="font-display text-lg font-bold text-ink mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-accent">content_cut</span>
              Cut from {cutting.rollNumber}
            </p>
            <p className="text-sm text-ink-muted mb-4">{cutting.remainingLength} {cutting.unitOfMeasure} remaining</p>
            <div className="mb-4">
              <label className="field-label">Length to cut</label>
              <input type="number" required className="field-input num" value={cutLength} onChange={(e) => setCutLength(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setCutting(null)}>Cancel</button>
              <button type="submit" className="btn-primary">Cut</button>
            </div>
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
        <p className="font-display text-lg font-bold text-ink mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-accent">texture</span>
          Receive roll
        </p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Product</label>
            <select required className="field-input" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
              <option value="">Select…</option>
              {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Warehouse</label>
            <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}>
              <option value="">Select…</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Roll number</label>
            <input required className="field-input" value={form.rollNumber} onChange={(e) => setForm({ ...form, rollNumber: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">Length</label>
              <input type="number" required className="field-input num" value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Unit</label>
              <select className="field-input" value={form.unitOfMeasure} onChange={(e) => setForm({ ...form, unitOfMeasure: e.target.value })}>
                <option value="meters">Meters</option>
                <option value="yards">Yards</option>
              </select>
            </div>
          </div>
          <div>
            <label className="field-label">Remnant threshold</label>
            <input type="number" className="field-input num" value={form.remnantThreshold} onChange={(e) => setForm({ ...form, remnantThreshold: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Receive'}</button>
        </div>
      </form>
    </div>
  );
}
