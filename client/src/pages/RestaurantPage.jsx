import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { Pencil, Trash2, Plus, X } from 'lucide-react';

const STATUS_CHIP = { free: 'chip-accent', occupied: 'chip-warning', reserved: 'chip-neutral' };
const STATUS_CARD = {
  free: 'border-rule-strong',
  occupied: 'border-warning bg-warning-soft/40',
  reserved: 'border-rule-strong bg-surface-sunken',
};
const ITEM_STATUS_NEXT = { pending: 'preparing', preparing: 'ready', ready: 'served', served: 'served' };
const ITEM_STATUS_CHIP = { pending: 'chip-neutral', preparing: 'chip-warning', ready: 'chip-accent', served: 'chip-neutral' };

export function RestaurantPage() {
  const toast = useToast();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTable, setEditingTable] = useState(null); // null closed, {} new, {...} edit
  const [orderTable, setOrderTable] = useState(null); // table currently opening/viewing an order for

  function load() {
    setLoading(true);
    api.get('/restaurant/tables').then(setTables).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function setReserved(table) {
    try {
      await api.patch(`/restaurant/tables/${table._id}/status`, { status: 'reserved' });
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function releaseTable(table) {
    try {
      await api.patch(`/restaurant/tables/${table._id}/status`, { status: 'free' });
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function handleRemoveTable(table) {
    if (!window.confirm(`Remove "${table.name}"?`)) return;
    try {
      await api.del(`/restaurant/tables/${table._id}`);
      toast('Table removed.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="eyebrow mb-1">Floor Logistics</p>
          <p className="page-title">Tables</p>
        </div>
        <button className="btn-primary flex items-center gap-1.5" onClick={() => setEditingTable({})}>
          <Plus size={14} /> Add table
        </button>
      </div>

      {loading && <Loading />}
      {!loading && tables.length === 0 && (
        <EmptyState title="No tables yet" description="Set up your floor before opening for service." action={<button className="btn-primary" onClick={() => setEditingTable({})}>Add a table</button>} />
      )}
      {!loading && tables.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {tables.map((t) => (
            <div key={t._id} className={`card p-4 border-2 ${STATUS_CARD[t.status]}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="font-display text-base font-semibold text-ink">{t.name}</p>
                <span className={STATUS_CHIP[t.status]}>{t.status}</span>
              </div>
              <p className="text-xs text-ink-muted mb-3">{t.seats} seats</p>
              <div className="flex flex-wrap gap-3 items-center">
                {t.status === 'free' && (
                  <>
                    <button className="text-xs font-semibold text-accent hover:text-accent-strong" onClick={() => setOrderTable(t)}>Open order</button>
                    <button className="text-xs font-semibold text-ink-muted hover:text-ink" onClick={() => setReserved(t)}>Reserve</button>
                  </>
                )}
                {t.status === 'occupied' && (
                  <button className="text-xs font-semibold text-accent hover:text-accent-strong" onClick={() => setOrderTable(t)}>View order</button>
                )}
                {t.status === 'reserved' && (
                  <button className="text-xs font-semibold text-ink-muted hover:text-ink" onClick={() => releaseTable(t)}>Release</button>
                )}
                <span className="flex-1" />
                <button className="text-ink-muted hover:text-accent-strong" onClick={() => setEditingTable(t)} aria-label="Edit table"><Pencil size={13} /></button>
                {t.status !== 'occupied' && (
                  <button className="text-ink-muted hover:text-danger" onClick={() => handleRemoveTable(t)} aria-label="Remove table"><Trash2 size={13} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editingTable !== null && (
        <TableForm table={editingTable} onClose={() => setEditingTable(null)} onSaved={() => { setEditingTable(null); load(); }} />
      )}
      {orderTable && (
        <OrderPanel table={orderTable} onClose={() => { setOrderTable(null); load(); }} />
      )}
    </div>
  );
}

function TableForm({ table, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !table._id;
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ branchId: table.branchId || '', name: table.name || '', seats: table.seats || 4 });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (isNew) api.get('/org/branches').then(setBranches).catch(() => {}); }, [isNew]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isNew) {
        await api.post('/restaurant/tables', { ...form, seats: Number(form.seats) });
        toast('Table added.', 'success');
      } else {
        await api.put(`/restaurant/tables/${table._id}`, { name: form.name, seats: Number(form.seats) });
        toast('Table updated.', 'success');
      }
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-xs shadow-lg">
        <p className="font-display text-lg font-semibold text-ink mb-4">{isNew ? 'Add table' : 'Edit table'}</p>
        <div className="space-y-3">
          {isNew && (
            <div>
              <label className="field-label">Branch</label>
              <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
                <option value="">Select…</option>
                {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
            </div>
          )}
          <div><label className="field-label">Name</label><input required autoFocus className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Table 4" /></div>
          <div><label className="field-label">Seats</label><input type="number" min="1" className="field-input num" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : isNew ? 'Add' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

/** The order workflow that was completely missing before: open an order against
 * a table, pick items, send to the kitchen, track each item's prep status,
 * add more rounds, and close the ticket once it's billed. */
function OrderPanel({ table, onClose }) {
  const toast = useToast();
  const [kot, setKot] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]); // items being added this round

  function load() {
    setLoading(true);
    Promise.all([
      api.get('/products').catch(() => []),
      table.status === 'occupied'
        ? api.get(`/restaurant/orders?tableId=${table._id}`).catch(() => [])
        : Promise.resolve([]),
    ]).then(([prods, kots]) => {
      setProducts(prods.filter((p) => (p.variants || []).length > 0));
      const open = kots.filter((k) => k.status !== 'closed').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      setKot(open || null);
    }).finally(() => setLoading(false));
  }
  useEffect(load, [table._id]);

  function addToCart(product) {
    setCart([...cart, {
      productId: product._id, variantId: product.variants[0]._id, name: product.name, quantity: 1,
    }]);
  }
  function updateQty(idx, qty) {
    setCart(cart.map((c, i) => (i === idx ? { ...c, quantity: Math.max(1, qty) } : c)));
  }
  function removeFromCart(idx) {
    setCart(cart.filter((_, i) => i !== idx));
  }

  async function sendToKitchen() {
    if (cart.length === 0) return;
    const items = cart.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity }));
    try {
      if (kot) {
        await api.post(`/restaurant/orders/${kot._id}/items`, { items });
      } else {
        await api.post('/restaurant/orders', { tableId: table._id, branchId: table.branchId, items });
      }
      toast('Sent to kitchen.', 'success');
      setCart([]);
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function advanceItem(item) {
    try {
      await api.patch(`/restaurant/orders/${kot._id}/items/${item._id}/status`, { status: ITEM_STATUS_NEXT[item.status] });
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function cancelOrder() {
    if (!window.confirm('Cancel this order and free the table? This does not bill anything.')) return;
    try {
      await api.del(`/restaurant/orders/${kot._id}`);
      toast('Order cancelled.', 'success');
      onClose();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-5 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-lg font-semibold text-ink">{table.name} — order</p>
          <button onClick={onClose} className="text-ink-muted hover:text-ink"><X size={18} /></button>
        </div>

        {loading && <Loading />}

        {!loading && (
          <div className="flex-1 overflow-y-auto grid sm:grid-cols-2 gap-4">
            <div>
              <p className="eyebrow mb-1.5">Menu</p>
              <div className="border border-rule rounded-lg max-h-64 overflow-y-auto">
                {products.map((p) => (
                  <button key={p._id} type="button" onClick={() => addToCart(p)} className="w-full text-left px-2.5 py-1.5 text-sm hover:bg-surface-sunken flex justify-between">
                    <span>{p.name}</span>
                    <span className="text-ink-muted num">{p.sellingPrice}</span>
                  </button>
                ))}
              </div>

              {cart.length > 0 && (
                <div className="mt-3">
                  <p className="eyebrow mb-1.5">Adding this round</p>
                  {cart.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm py-1">
                      <span className="flex-1">{c.name}</span>
                      <input type="number" min="1" className="field-input num !w-14 !py-0.5" value={c.quantity} onChange={(e) => updateQty(i, Number(e.target.value))} />
                      <button onClick={() => removeFromCart(i)} className="text-ink-muted hover:text-danger"><X size={14} /></button>
                    </div>
                  ))}
                  <button className="btn-primary w-full mt-2" onClick={sendToKitchen}>Send to kitchen</button>
                </div>
              )}
            </div>

            <div>
              <p className="eyebrow mb-1.5">Kitchen status</p>
              {!kot && <p className="text-sm text-ink-muted">No order sent yet — add items from the menu.</p>}
              {kot && (
                <div className="space-y-1.5">
                  {kot.items.map((item) => (
                    <div key={item._id} className="flex items-center justify-between text-sm border-b border-rule pb-1.5">
                      <span>{item.productId?.name || 'Item'} × {item.quantity}</span>
                      <button className={ITEM_STATUS_CHIP[item.status]} onClick={() => advanceItem(item)} disabled={item.status === 'served'}>
                        {item.status}
                      </button>
                    </div>
                  ))}
                  <button className="btn-secondary w-full mt-3" onClick={cancelOrder}>Cancel order</button>
                  <p className="text-xs text-ink-muted mt-1">Bill this table from the POS checkout screen, then close the ticket there.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
