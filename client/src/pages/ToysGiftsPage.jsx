import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

export function ToysGiftsPage() {
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
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex justify-end mb-3"><button className="btn-primary" onClick={() => setShowForm(true)}>New registry</button></div>
        {loading && <Loading />}
        {!loading && registries.length === 0 && <EmptyState title="No registries yet" action={<button className="btn-primary" onClick={() => setShowForm(true)}>Create one</button>} />}
        {!loading && registries.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {registries.map((r) => (
              <div key={r._id} onClick={() => setSelected(r)} className="card p-3 cursor-pointer hover:bg-paper">
                <p className="text-sm font-medium">{r.occasion}</p>
                <p className="text-xs text-ink-muted">{r.ownerCustomerId?.name}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      {selected && <RegistryPanel registryId={selected._id} onClose={() => setSelected(null)} />}
      {showForm && <RegistryForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function RegistryForm({ onClose, onSaved }) {
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
      toast('Registry created.', 'success');
      onSaved();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto">
        <p className="font-display text-lg mb-4">New gift registry</p>
        <div className="space-y-3 mb-3">
          <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}><option value="">Branch…</option>{branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}</select>
          <select required className="field-input" value={form.ownerCustomerId} onChange={(e) => setForm({ ...form, ownerCustomerId: e.target.value })}><option value="">Registry owner…</option>{customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
          <input placeholder="Occasion" className="field-input" value={form.occasion} onChange={(e) => setForm({ ...form, occasion: e.target.value })} />
        </div>
        <p className="field-label mb-1">Wanted items</p>
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 mb-2">
            <select className="field-input col-span-2" value={it.productId} onChange={(e) => updateItem(i, { productId: e.target.value })}><option value="">Product…</option>{products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select>
            <input type="number" className="field-input num" value={it.desiredQuantity} onChange={(e) => updateItem(i, { desiredQuantity: e.target.value })} />
          </div>
        ))}
        <button type="button" className="btn-ghost !px-0 text-xs mb-4" onClick={() => setItems([...items, { productId: '', desiredQuantity: 1 }])}>+ Add item</button>
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create'}</button></div>
      </form>
    </div>
  );
}

function RegistryPanel({ registryId, onClose }) {
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
      toast('Gift purchased!', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  if (!registry) return null;
  return (
    <div className="w-full lg:w-96 shrink-0 card p-4 h-fit">
      <div className="flex items-center justify-between mb-3"><p className="font-display text-lg">{registry.occasion}</p><button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>Close</button></div>
      <p className="text-sm text-ink-muted mb-4">For {registry.ownerCustomerId?.name}</p>
      {registry.items.map((item) => (
        <div key={item._id} className="border-b border-rule py-3">
          <p className="text-sm font-medium">{item.productId?.name}</p>
          <p className="text-xs text-ink-muted mb-2">{item.purchasedQuantity}/{item.desiredQuantity} claimed</p>
          {item.purchasedQuantity < item.desiredQuantity && (
            <div className="space-y-1.5">
              <select className="field-input !text-xs" value={purchaseState[item._id]?.customerId || ''} onChange={(e) => setPurchaseState({ ...purchaseState, [item._id]: { ...purchaseState[item._id], customerId: e.target.value } })}><option value="">Buyer…</option>{customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
              <select className="field-input !text-xs" value={purchaseState[item._id]?.warehouseId || ''} onChange={(e) => setPurchaseState({ ...purchaseState, [item._id]: { ...purchaseState[item._id], warehouseId: e.target.value } })}><option value="">Warehouse…</option>{warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}</select>
              <select className="field-input !text-xs" value={purchaseState[item._id]?.paymentAccountId || ''} onChange={(e) => setPurchaseState({ ...purchaseState, [item._id]: { ...purchaseState[item._id], paymentAccountId: e.target.value } })}><option value="">Payment account…</option>{accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}</select>
              <div className="flex gap-1">
                <input type="number" min="1" placeholder="Qty" className="field-input !text-xs w-16" value={purchaseState[item._id]?.quantity || 1} onChange={(e) => setPurchaseState({ ...purchaseState, [item._id]: { ...purchaseState[item._id], quantity: e.target.value } })} />
                <button className="btn-primary flex-1 !text-xs" onClick={() => purchase(item._id)}>Buy this gift</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
