import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

const TRACKING_LABELS = {
  simple: 'Simple',
  variant: 'Variant',
  batch: 'Batch/expiry',
  serial: 'Serial/IMEI',
  weight: 'Weight-based',
  bundle: 'Bundle',
  service: 'Service',
};

export function ProductsPage() {
  const { company } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null closed, {} new, {...} edit
  const [query, setQuery] = useState('');

  function load() {
    setLoading(true);
    api.get('/products').then(setProducts).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleRemove(p) {
    if (!window.confirm(`Remove "${p.name}" from your catalog? Past sales and stock history are unaffected.`)) return;
    try {
      await api.del(`/products/${p._id}`);
      toast('Product removed.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  const lowStockCount = products.filter((p) => p.reorderLevel != null && p.minStock != null && Number(p.minStock) <= Number(p.reorderLevel)).length;

  const filtered = products.filter((p) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="page-title">Products</p>
          <p className="text-sm text-ink-muted mt-1">{products.length} product{products.length === 1 ? '' : 's'} in your catalog</p>
        </div>
        <button className="btn-primary" onClick={() => setEditing({})}>
          <span className="font-icon text-[18px] leading-none">add</span>
          New product
        </button>
      </div>

      {loading && <Loading />}

      {!loading && products.length === 0 && (
        <EmptyState
          title="No products yet"
          description="Add your first product to start selling and tracking stock."
          action={<button className="btn-primary" onClick={() => setEditing({})}>Add a product</button>}
        />
      )}

      {!loading && products.length > 0 && (
        <>
          {/* Catalog overview strip */}
          <div className="grid grid-cols-12 gap-6 mb-6">
            <div className="col-span-12 lg:col-span-4 card p-6">
              <p className="font-display text-lg font-semibold text-accent mb-4">Catalog Overview</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-sunken p-4 rounded-lg">
                  <p className="eyebrow mb-1">Total items</p>
                  <p className="font-display text-3xl font-bold text-accent num">{products.length}</p>
                </div>
                <div className="bg-surface-sunken p-4 rounded-lg">
                  <p className="eyebrow mb-1">Reorder alerts</p>
                  <p className="font-display text-3xl font-bold text-danger num">{lowStockCount}</p>
                </div>
              </div>
            </div>
            <div className="col-span-12 lg:col-span-8 card p-6 flex flex-col justify-center">
              <p className="font-display text-lg font-semibold text-accent mb-2">Tracking modes in use</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(TRACKING_LABELS).map(([key, label]) => {
                  const count = products.filter((p) => p.trackingMode === key).length;
                  if (!count) return null;
                  return <span key={key} className="chip-neutral">{label} · <span className="num">{count}</span></span>;
                })}
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="p-5 border-b border-rule flex items-center justify-between gap-4 flex-wrap">
              <p className="font-display text-lg font-semibold text-accent">Current Catalog</p>
              <div className="relative">
                <span className="font-icon text-[18px] absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">search</span>
                <input
                  type="text"
                  className="field-input !w-64 pl-9"
                  placeholder="Search SKU or product…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left bg-surface-sunken">
                  <th className="px-6 py-3 font-semibold text-ink-muted text-xs uppercase tracking-wide">SKU</th>
                  <th className="px-6 py-3 font-semibold text-ink-muted text-xs uppercase tracking-wide">Product name</th>
                  <th className="px-6 py-3 font-semibold text-ink-muted text-xs uppercase tracking-wide">Tracking</th>
                  <th className="px-6 py-3 font-semibold text-ink-muted text-xs uppercase tracking-wide text-right">Cost</th>
                  <th className="px-6 py-3 font-semibold text-ink-muted text-xs uppercase tracking-wide text-right">Price</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const lowStock = p.reorderLevel != null && p.minStock != null && Number(p.minStock) <= Number(p.reorderLevel);
                  return (
                    <tr
                      key={p._id}
                      className={`border-b border-rule last:border-0 hover:bg-paper cursor-pointer group ${lowStock ? 'bg-danger-soft/30' : ''}`}
                      onClick={() => setEditing(p)}
                    >
                      <td className="px-6 py-3 num text-ink-muted">{p.sku || '—'}</td>
                      <td className="px-6 py-3 font-medium text-ink">
                        <span className="inline-flex items-center gap-2">
                          {p.name}
                          {lowStock && <span className="font-icon text-[16px] text-danger" title="Low stock">warning</span>}
                        </span>
                      </td>
                      <td className="px-6 py-3"><span className="chip-neutral capitalize">{TRACKING_LABELS[p.trackingMode] || p.trackingMode}</span></td>
                      <td className="px-6 py-3 num text-right">{formatMoney(p.costPrice, company?.currency)}</td>
                      <td className="px-6 py-3 num text-right text-accent-strong font-medium">{formatMoney(p.sellingPrice, company?.currency)}</td>
                      <td className="px-6 py-3 text-right whitespace-nowrap">
                        <button
                          className="btn-ghost !text-ink-muted !px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); setEditing(p); }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-ghost !text-danger !px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); handleRemove(p); }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-ink-muted">No products match "{query}".</td></tr>
                )}
              </tbody>
            </table>
            <div className="px-6 py-3 border-t border-rule bg-surface-sunken flex items-center justify-between">
              <span className="text-sm text-ink-muted">Showing {filtered.length} of {products.length} product{products.length === 1 ? '' : 's'}</span>
            </div>
          </div>
        </>
      )}

      {editing !== null && <ProductForm product={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function ProductForm({ product, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !product._id;
  const [form, setForm] = useState({
    name: product.name || '', sku: product.sku || '', barcode: product.barcode || '',
    costPrice: product.costPrice ?? '', sellingPrice: product.sellingPrice ?? '',
    minStock: product.minStock ?? '', reorderLevel: product.reorderLevel ?? '',
    trackingMode: product.trackingMode || 'simple',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (isNew) {
        await api.post('/products', {
          name: form.name, sku: form.sku || undefined, barcode: form.barcode || undefined,
          trackingMode: form.trackingMode,
          costPrice: Number(form.costPrice) || 0, sellingPrice: Number(form.sellingPrice) || 0,
          variants: [{ sku: form.sku || undefined, barcode: form.barcode || undefined, sellingPrice: Number(form.sellingPrice) || 0 }],
        });
        toast('Product created.', 'success');
      } else {
        await api.put(`/products/${product._id}`, {
          name: form.name, sku: form.sku || undefined, barcode: form.barcode || undefined,
          costPrice: Number(form.costPrice) || 0, sellingPrice: Number(form.sellingPrice) || 0,
          minStock: Number(form.minStock) || 0, reorderLevel: Number(form.reorderLevel) || 0,
        });
        toast('Product updated.', 'success');
      }
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
        <p className="font-display text-lg mb-4">{isNew ? 'New product' : 'Edit product'}</p>
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
          {!isNew && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Min stock</label>
                <input type="number" className="field-input num" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
              </div>
              <div>
                <label className="field-label">Reorder level</label>
                <input type="number" className="field-input num" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
              </div>
            </div>
          )}
          <div>
            <label className="field-label">Tracking mode</label>
            {isNew ? (
              <select className="field-input" value={form.trackingMode} onChange={(e) => setForm({ ...form, trackingMode: e.target.value })}>
                <option value="simple">Simple</option>
                <option value="variant">Variant (size/color)</option>
                <option value="batch">Batch/expiry</option>
                <option value="serial">Serial/IMEI</option>
                <option value="weight">Weight-based</option>
                <option value="bundle">Bundle</option>
                <option value="service">Service (no stock — a haircut, a room-night, a fee...)</option>
              </select>
            ) : (
              <p className="text-sm text-ink-muted">{form.trackingMode} <span className="text-xs">(can't be changed after creation — how stock is already tracked depends on it)</span></p>
            )}
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
