import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { formatDate } from '../lib/format';

export function GroceryPage() {
  const toast = useToast();
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get('/org/warehouses').then(setWarehouses).catch(() => {});
    api.get('/products').then((rows) => setProducts(rows.filter((p) => p.trackingMode === 'batch'))).catch(() => {});
  }, []);

  async function search(e) {
    e.preventDefault();
    try {
      const r = await api.get(`/grocery/pick-order?warehouseId=${warehouseId}&variantId=${variantId}&quantity=${quantity}`);
      setResult(r);
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <p className="page-title mb-4">FEFO Pick Order</p>
      <form onSubmit={search} className="card p-4 mb-4 max-w-sm">
        <div className="space-y-3">
          <div><label className="field-label">Warehouse</label><select required className="field-input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}><option value="">Select…</option>{warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}</select></div>
          <div>
            <label className="field-label">Product</label>
            <select required className="field-input" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
              <option value="">Select…</option>
              {products.map((p) => p.variants.map((v) => <option key={v._id} value={v._id}>{p.name}</option>))}
            </select>
          </div>
          <div><label className="field-label">Quantity needed</label><input type="number" required className="field-input num" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
        </div>
        <button type="submit" className="btn-primary w-full mt-4">Get pick order</button>
      </form>
      {result && (
        <div className="card p-4 max-w-sm">
          <p className={result.fullyCovered ? 'chip-accent' : 'chip-warning'}>{result.fullyCovered ? 'Fully covered' : `Shortfall: ${result.shortfall}`}</p>
          <p className="text-sm text-ink-muted mt-2 mb-2">Take in this order:</p>
          {result.allocations.map((a, i) => (
            <div key={i} className="flex justify-between text-sm border-b border-rule py-1.5">
              <span>{a.batchNumber || 'No batch'} {a.expiryDate && <span className="text-ink-muted">(exp. {formatDate(a.expiryDate)})</span>}</span>
              <span className="num">{a.quantity}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
