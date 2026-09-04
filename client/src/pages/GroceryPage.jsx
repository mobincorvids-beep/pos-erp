import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { formatDate } from '../lib/format';

export function GroceryPage() {
  const { t } = useTranslation();
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
      <p className="eyebrow mb-1">{t('grocery.title')}</p>
      <p className="page-title mb-6">{t('grocery.fefoPickOrder')}</p>

      <div className="flex flex-wrap items-start gap-4">
        <form onSubmit={search} className="card p-5 w-full max-w-sm">
          <div className="space-y-3">
            <div>
              <label className="field-label">{t('grocery.warehouse')}</label>
              <select required className="field-input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                <option value="">{t('grocery.select')}</option>
                {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">{t('grocery.product')}</label>
              <select required className="field-input" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
                <option value="">{t('grocery.select')}</option>
                {products.map((p) => p.variants.map((v) => <option key={v._id} value={v._id}>{p.name}</option>))}
              </select>
            </div>
            <div>
              <label className="field-label">{t('grocery.quantityNeeded')}</label>
              <input type="number" required className="field-input num" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="btn-primary w-full mt-5">
            <span className="font-icon text-base leading-none">search</span>
            {t('grocery.getPickOrder')}
          </button>
        </form>

        {result && (
          <div className="card p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="eyebrow">{t('grocery.result')}</p>
              <span className={result.fullyCovered ? 'chip-accent' : 'chip-warning'}>
                {result.fullyCovered ? t('grocery.fullyCovered') : `${t('grocery.shortfall')}: ${result.shortfall}`}
              </span>
            </div>
            <p className="text-sm text-ink-muted mb-2">{t('grocery.takeInThisOrder')}</p>
            <div className="rounded-lg border border-rule divide-y divide-rule overflow-hidden">
              {result.allocations.map((a, i) => (
                <div key={i} className="flex justify-between items-center text-sm px-3 py-2 bg-surface">
                  <span className="text-ink">
                    {a.batchNumber || t('grocery.noBatch')}
                    {a.expiryDate && <span className="text-ink-muted"> ({t('grocery.exp')}. {formatDate(a.expiryDate)})</span>}
                  </span>
                  <span className="num font-semibold">{a.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
