import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';

export function FootwearPage() {
  const toast = useToast();
  const [curves, setCurves] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [applying, setApplying] = useState(null);
  const [totalQuantity, setTotalQuantity] = useState('');
  const [productId, setProductId] = useState('');
  const [result, setResult] = useState(null);

  function load() {
    setLoading(true);
    api.get('/footwear/size-curves').then(setCurves).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
    api.get('/products').then(setProducts).catch(() => {});
  }
  useEffect(load, []);

  async function apply(e) {
    e.preventDefault();
    try {
      const r = await api.post(`/footwear/size-curves/${applying._id}/apply`, { productId, totalQuantity: Number(totalQuantity) });
      setResult(r);
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="page-title">Size Curves</p>
        <button className="btn-primary" onClick={() => setShowForm(true)}>New curve</button>
      </div>
      {loading && <Loading />}
      {!loading && curves.length === 0 && <EmptyState title="No size curves yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Add one</button>} />}
      {!loading && curves.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {curves.map((c) => (
            <div key={c._id} className="card p-3">
              <p className="text-sm font-medium">{c.name}</p>
              {c.ratios.map((r, i) => <p key={i} className="text-xs text-ink-muted">Size {r.sizeLabel}: {r.percent}%</p>)}
              <button className="btn-ghost !text-accent !px-0 text-xs mt-2" onClick={() => { setApplying(c); setResult(null); }}>Apply to order</button>
            </div>
          ))}
        </div>
      )}
      {showForm && <CurveForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {applying && (
        <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
          <form onSubmit={apply} className="card p-5 w-full max-w-sm">
            <p className="font-display text-lg mb-4">Apply {applying.name}</p>
            <div className="space-y-3 mb-3">
              <select required className="field-input" value={productId} onChange={(e) => setProductId(e.target.value)}><option value="">Product…</option>{products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
              <input type="number" required placeholder="Total quantity to order" className="field-input num" value={totalQuantity} onChange={(e) => setTotalQuantity(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary w-full mb-3">Compute split</button>
            {result && (
              <div className="text-sm space-y-1">
                {result.map((r, i) => <div key={i} className="flex justify-between border-b border-rule py-1"><span>Size {r.sizeLabel}</span><span className="num">{r.quantity}</span></div>)}
              </div>
            )}
            <button type="button" className="btn-secondary w-full mt-3" onClick={() => setApplying(null)}>Close</button>
          </form>
        </div>
      )}
    </div>
  );
}

function CurveForm({ onClose, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [ratios, setRatios] = useState([{ sizeLabel: '', percent: '' }]);
  const [saving, setSaving] = useState(false);
  function update(i, patch) { setRatios((prev) => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r)); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/footwear/size-curves', { name, ratios: ratios.map((r) => ({ sizeLabel: r.sizeLabel, percent: Number(r.percent) })) });
      toast('Curve saved.', 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">New size curve</p>
        <input required placeholder="Name" className="field-input mb-3" value={name} onChange={(e) => setName(e.target.value)} />
        {ratios.map((r, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 mb-2">
            <input placeholder="Size label" className="field-input" value={r.sizeLabel} onChange={(e) => update(i, { sizeLabel: e.target.value })} />
            <input type="number" placeholder="Percent" className="field-input num" value={r.percent} onChange={(e) => update(i, { percent: e.target.value })} />
          </div>
        ))}
        <button type="button" className="btn-ghost !px-0 text-xs mb-4" onClick={() => setRatios([...ratios, { sizeLabel: '', percent: '' }])}>+ Add size</button>
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button></div>
      </form>
    </div>
  );
}
