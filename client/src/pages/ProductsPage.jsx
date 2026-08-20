import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function ProductsPage() {
  const { company } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/products').then(setProducts).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="page-title">Products</p>
          <p className="text-sm text-ink-muted mt-1">{products.length} product{products.length === 1 ? '' : 's'} in your catalog</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>New product</button>
      </div>

      {loading && <Loading />}

      {!loading && products.length === 0 && (
        <EmptyState
          title="No products yet"
          description="Add your first product to start selling and tracking stock."
          action={<button className="btn-primary" onClick={() => setShowForm(true)}>Add a product</button>}
        />
      )}

      {!loading && products.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">SKU</th>
                <th className="px-3 py-2 font-medium">Tracking</th>
                <th className="px-3 py-2 font-medium text-right">Cost</th>
                <th className="px-3 py-2 font-medium text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p._id} className="border-b border-rule last:border-0 hover:bg-paper">
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2 num text-ink-muted">{p.sku || '—'}</td>
                  <td className="px-3 py-2"><span className="chip-neutral capitalize">{p.trackingMode}</span></td>
                  <td className="px-3 py-2 num text-right">{formatMoney(p.costPrice, company?.currency)}</td>
                  <td className="px-3 py-2 num text-right text-accent-strong">{formatMoney(p.sellingPrice, company?.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <ProductForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function ProductForm({ onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', sku: '', barcode: '', costPrice: '', sellingPrice: '', trackingMode: 'simple' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/products', {
        name: form.name, sku: form.sku || undefined, barcode: form.barcode || undefined,
        trackingMode: form.trackingMode,
        costPrice: Number(form.costPrice) || 0, sellingPrice: Number(form.sellingPrice) || 0,
        variants: [{ sku: form.sku || undefined, barcode: form.barcode || undefined, sellingPrice: Number(form.sellingPrice) || 0 }],
      });
      toast('Product created.', 'success');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-md">
        <p className="font-display text-lg mb-4">New product</p>
        {error && <p className="chip-danger !inline-block w-full !rounded px-3 py-2 text-sm mb-3">{error}</p>}

        <div className="space-y-3">
          <div>
            <label className="field-label">Name</label>
            <input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">SKU</label>
              <input className="field-input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Barcode</label>
              <input className="field-input" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Cost price</label>
              <input type="number" step="0.01" className="field-input num" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
            </div>
            <div>
              <label className="field-label">Selling price</label>
              <input type="number" step="0.01" required className="field-input num" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="field-label">Tracking mode</label>
            <select className="field-input" value={form.trackingMode} onChange={(e) => setForm({ ...form, trackingMode: e.target.value })}>
              <option value="simple">Simple</option>
              <option value="variant">Variant (size/color)</option>
              <option value="batch">Batch/expiry</option>
              <option value="serial">Serial/IMEI</option>
              <option value="weight">Weight-based</option>
              <option value="bundle">Bundle</option>
              <option value="service">Service (no stock — a haircut, a room-night, a fee...)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save product'}</button>
        </div>
      </form>
    </div>
  );
}
