import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function ToysGiftsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [registries, setRegistries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);

  function load() {
    setLoading(true);
    api.get('/toys-gifts/registries').then(setRegistries).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <p className="eyebrow mb-1">{t('toysGifts.eyebrow')}</p>
      <p className="page-title mb-5">{t('toysGifts.title')}</p>
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex justify-end mb-3">
            <button className="btn-primary" onClick={() => setShowForm(true)}>{t('toysGifts.newRegistry')}</button>
          </div>
          {loading && <Loading />}
          {!loading && registries.length === 0 && <EmptyState title={t('toysGifts.noRegistriesYet')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('toysGifts.createOne')}</button>} />}
          {!loading && registries.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {registries.map((r) => (
                <button
                  key={r._id}
                  onClick={() => setSelected(r)}
                  className={`card p-4 text-left transition-colors hover:bg-surface-sunken ${selected?._id === r._id ? 'border-accent' : ''}`}
                >
                  <div className="w-9 h-9 rounded-lg bg-accent-soft text-accent-strong flex items-center justify-center text-sm font-semibold mb-3">
                    {r.occasion?.slice(0, 1).toUpperCase() || '?'}
                  </div>
                  <p className="text-sm font-semibold text-ink">{r.occasion}</p>
                  <p className="text-xs text-ink-muted mt-1">{r.ownerCustomerId?.name}</p>
                </button>
              ))}
            </div>
          )}
        </div>
        {selected && <RegistryPanel registryId={selected._id} onClose={() => setSelected(null)} />}
      </div>
      {showForm && <RegistryForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function RegistryForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ branchId: '', ownerCustomerId: '', occasion: '' });
  const [items, setItems] = useState([{ productId: '', desiredQuantity: 1 }]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get('/org/branches').then(setBranches).catch(() => {}); api.get('/customers').then(setCustomers).catch(() => {}); api.get('/products').then(setProducts).catch(() => {}); }, []);
  function updateItem(i, patch) { setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it)); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const resolvedItems = items.filter((i) => i.productId).map((i) => {
        const product = products.find((p) => p._id === i.productId);
        return { productId: i.productId, variantId: product?.variants[0]?._id, desiredQuantity: Number(i.desiredQuantity) };
      });
      await api.post('/toys-gifts/registries', { ...form, items: resolvedItems });
      toast(t('toysGifts.registryCreated'), 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 backdrop-blur-[1px] flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto">
        <p className="eyebrow mb-1">{t('toysGifts.eyebrow')}</p>
        <p className="font-display text-lg font-bold text-ink mb-4">{t('toysGifts.newGiftRegistry')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('toysGifts.branch')}</label>
            <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">{t('toysGifts.select')}</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('toysGifts.registryOwner')}</label>
            <select required className="field-input" value={form.ownerCustomerId} onChange={(e) => setForm({ ...form, ownerCustomerId: e.target.value })}>
              <option value="">{t('toysGifts.select')}</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('toysGifts.occasion')}</label>
            <input className="field-input" placeholder={t('toysGifts.occasionPlaceholder')} value={form.occasion} onChange={(e) => setForm({ ...form, occasion: e.target.value })} />
          </div>
        </div>

        <p className="field-label mt-4 mb-1.5">{t('toysGifts.wantedItems')}</p>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <select className="field-input col-span-2" value={it.productId} onChange={(e) => updateItem(i, { productId: e.target.value })}>
                <option value="">{t('toysGifts.productEllipsis')}</option>
                {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              <input type="number" min="1" className="field-input num" value={it.desiredQuantity} onChange={(e) => updateItem(i, { desiredQuantity: e.target.value })} />
            </div>
          ))}
        </div>
        <button type="button" className="btn-ghost !px-0 text-xs mt-2 mb-1" onClick={() => setItems([...items, { productId: '', desiredQuantity: 1 }])}>{t('toysGifts.addItem')}</button>

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('toysGifts.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('toysGifts.creating') : t('toysGifts.create')}</button>
        </div>
      </form>
    </div>
  );
}

function RegistryPanel({ registryId, onClose }) {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [registry, setRegistry] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [purchaseState, setPurchaseState] = useState({});

  function load() { api.get(`/toys-gifts/registries/${registryId}`).then(setRegistry).catch((err) => toast(err.message, 'error')); }
  useEffect(() => { load(); api.get('/customers').then(setCustomers).catch(() => {}); api.get('/org/warehouses').then(setWarehouses).catch(() => {}); api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {}); }, [registryId]);

  async function purchase(itemId) {
    const state = purchaseState[itemId] || {};
    try {
      await api.post(`/toys-gifts/registries/${registryId}/items/${itemId}/purchase`, {
        quantity: Number(state.quantity || 1), purchasingCustomerId: state.customerId, warehouseId: state.warehouseId, paymentAccountId: state.paymentAccountId,
      });
      toast(t('toysGifts.giftPurchased'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  if (!registry) return null;
  return (
    <div className="w-full lg:w-96 shrink-0 card p-4 h-fit">
      <div className="flex items-center justify-between mb-1">
        <p className="font-display text-lg font-bold text-ink">{registry.occasion}</p>
        <button className="btn-ghost !px-2 !py-1 text-xs" onClick={onClose}>{t('toysGifts.close')}</button>
      </div>
      <p className="text-sm text-ink-muted mb-4">{t('toysGifts.forOwner', { name: registry.ownerCustomerId?.name })}</p>
      <div className="divide-y divide-rule">
        {registry.items.map((item) => {
          const claimed = item.purchasedQuantity >= item.desiredQuantity;
          return (
            <div key={item._id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-ink">{item.productId?.name}</p>
                <span className={claimed ? 'chip-accent' : 'chip-neutral'}>{item.purchasedQuantity}/{item.desiredQuantity}</span>
              </div>
              {!claimed && (
                <div className="space-y-1.5 mt-2">
                  <select className="field-input !text-xs !py-1.5" value={purchaseState[item._id]?.customerId || ''} onChange={(e) => setPurchaseState({ ...purchaseState, [item._id]: { ...purchaseState[item._id], customerId: e.target.value } })}>
                    <option value="">{t('toysGifts.buyerEllipsis')}</option>
                    {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                  <select className="field-input !text-xs !py-1.5" value={purchaseState[item._id]?.warehouseId || ''} onChange={(e) => setPurchaseState({ ...purchaseState, [item._id]: { ...purchaseState[item._id], warehouseId: e.target.value } })}>
                    <option value="">{t('toysGifts.warehouseEllipsis')}</option>
                    {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
                  </select>
                  <select className="field-input !text-xs !py-1.5" value={purchaseState[item._id]?.paymentAccountId || ''} onChange={(e) => setPurchaseState({ ...purchaseState, [item._id]: { ...purchaseState[item._id], paymentAccountId: e.target.value } })}>
                    <option value="">{t('toysGifts.paymentAccountEllipsis')}</option>
                    {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
                  </select>
                  <div className="flex gap-1.5">
                    <input type="number" min="1" placeholder={t('toysGifts.qty')} className="field-input num !text-xs !py-1.5 w-16" value={purchaseState[item._id]?.quantity || 1} onChange={(e) => setPurchaseState({ ...purchaseState, [item._id]: { ...purchaseState[item._id], quantity: e.target.value } })} />
                    <button className="btn-primary flex-1 !text-xs !py-1.5" onClick={() => purchase(item._id)}>{t('toysGifts.buyThisGift')}</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
