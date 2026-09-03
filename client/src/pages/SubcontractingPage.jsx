import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatQty, formatMoney } from '../lib/format';

const STATUS_CHIP = {
  sent: 'chip-info',
  partially_received: 'chip-warning',
  received: 'chip-accent',
  closed: 'chip-neutral',
};

export function SubcontractingPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/subcontracting').then(setOrders).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  const openCount = orders.filter((o) => o.status === 'sent' || o.status === 'partially_received').length;

  return (
    <div>
      <div className="flex justify-between items-end mb-6">
        <div>
          <p className="page-title mb-1">{t('subcontracting.title', 'Subcontracting / Job Work')}</p>
          <p className="text-ink-muted">{t('subcontracting.subtitle', 'Track goods sent out for job-work and what came back')}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>{t('subcontracting.newOrder', 'New subcontract order')}</button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="card p-5">
              <p className="eyebrow mb-3">{t('subcontracting.open', 'Open with subcontractor')}</p>
              <p className="font-display text-3xl font-bold text-accent num">{openCount}</p>
            </div>
            <div className="card p-5">
              <p className="eyebrow mb-3">{t('subcontracting.total', 'Total orders')}</p>
              <p className="font-display text-3xl font-bold text-accent num">{orders.length}</p>
            </div>
          </div>

          <div className="card overflow-hidden">
            <p className="font-display text-lg font-semibold text-accent px-5 py-4 border-b border-rule">{t('subcontracting.ledger', 'Job-work orders')}</p>
            {loading && <div className="p-5"><Loading /></div>}
            {!loading && orders.length === 0 && (
              <div className="p-5">
                <EmptyState
                  title={t('subcontracting.emptyTitle', 'No subcontract orders yet')}
                  description={t('subcontracting.emptyDescription', 'Record goods sent out to a subcontractor (e.g. raw fabric for dyeing) to track what comes back.')}
                />
              </div>
            )}
            {!loading && orders.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken">
                    <th className="px-5 py-3 font-semibold">{t('subcontracting.orderNumber', 'Order #')}</th>
                    <th className="px-5 py-3 font-semibold">{t('subcontracting.sentDate', 'Sent')}</th>
                    <th className="px-5 py-3 font-semibold text-right">{t('subcontracting.jobWorkCost', 'Job-work cost')}</th>
                    <th className="px-5 py-3 font-semibold">{t('subcontracting.status', 'Status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o._id} onClick={() => setSelected(o)} className={`border-b border-rule last:border-0 cursor-pointer hover:bg-surface-sunken/60 transition-colors ${selected?._id === o._id ? 'bg-accent-soft/40' : ''}`}>
                      <td className="px-5 py-4 num font-semibold text-accent">{o.orderNumber}</td>
                      <td className="px-5 py-4 num text-ink-muted">{new Date(o.sentDate).toLocaleDateString()}</td>
                      <td className="px-5 py-4 num text-right">{formatMoney(o.subcontractingCost)}</td>
                      <td className="px-5 py-4"><span className={STATUS_CHIP[o.status] || 'chip-neutral'}>{o.status.replace('_', ' ')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        {selected && <SubcontractOrderPanel order={selected} onClose={() => setSelected(null)} onChanged={load} />}
      </div>

      {showForm && <SubcontractOrderForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function SubcontractOrderPanel({ order, onClose, onChanged }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [items, setItems] = useState([{ productId: '', variantId: '', quantity: 1 }]);
  const [products, setProducts] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get('/products').then(setProducts).catch(() => {}); }, []);

  function updateItem(i, patch) {
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }

  async function receive() {
    setBusy(true);
    try {
      const payload = items.filter((it) => it.productId).map((it) => {
        const p = products.find((pr) => pr._id === it.productId);
        return { productId: it.productId, variantId: p?.variants?.[0]?._id, quantity: Number(it.quantity) };
      });
      if (payload.length === 0) { toast(t('subcontracting.selectProduct', 'Select at least one product.'), 'error'); setBusy(false); return; }
      await api.post(`/subcontracting/${order._id}/receive`, { items: payload });
      toast(t('subcontracting.received', 'Goods received recorded.'), 'success');
      onChanged();
      onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function close() {
    setBusy(true);
    try {
      await api.post(`/subcontracting/${order._id}/close`);
      toast(t('subcontracting.closed', 'Order closed.'), 'success');
      onChanged();
      onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="w-full lg:w-96 shrink-0 card p-5 h-fit">
      <div className="flex items-center justify-between mb-3">
        <p className="font-display text-lg font-semibold text-accent num">{order.orderNumber}</p>
        <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>{t('common.close', 'Close')}</button>
      </div>

      <div className="mb-4">
        <p className="field-label mb-1">{t('subcontracting.itemsSent', 'Items sent')}</p>
        <ul className="text-sm space-y-1">
          {order.itemsSent.map((it, i) => <li key={i} className="num text-ink-muted">{formatQty(it.quantity)} × {it.productId?.name || it.productId}</li>)}
        </ul>
      </div>

      {order.itemsReceived.length > 0 && (
        <div className="mb-4">
          <p className="field-label mb-1">{t('subcontracting.itemsReceived', 'Items received so far')}</p>
          <ul className="text-sm space-y-1">
            {order.itemsReceived.map((it, i) => <li key={i} className="num text-ink-muted">{formatQty(it.quantity)} × {it.productId?.name || it.productId}</li>)}
          </ul>
        </div>
      )}

      {order.status !== 'closed' && order.status !== 'received' && (
        <div className="mb-4">
          <p className="field-label mb-1">{t('subcontracting.recordReceived', 'Record goods received')}</p>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-3 gap-2">
                <select className="field-input col-span-2" value={it.productId} onChange={(e) => updateItem(i, { productId: e.target.value })}>
                  <option value="">{t('subcontracting.productPlaceholder', 'Product…')}</option>
                  {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
                <input type="number" min="0.01" step="0.01" className="field-input num" value={it.quantity} onChange={(e) => updateItem(i, { quantity: e.target.value })} />
              </div>
            ))}
          </div>
          <button type="button" className="btn-ghost !px-0 text-xs mt-1" onClick={() => setItems([...items, { productId: '', variantId: '', quantity: 1 }])}>
            {t('subcontracting.addItem', '+ Add item')}
          </button>
          <button className="btn-primary w-full mt-2" disabled={busy} onClick={receive}>
            {busy ? t('subcontracting.saving', 'Saving…') : t('subcontracting.recordReceipt', 'Record receipt')}
          </button>
        </div>
      )}

      {order.status !== 'closed' && (
        <button className="btn-secondary w-full" disabled={busy} onClick={close}>{t('subcontracting.closeOrder', 'Close order (accept remaining wastage)')}</button>
      )}
      {order.status === 'closed' && <p className="text-sm text-accent-strong">{t('subcontracting.orderClosed', 'This order is closed.')}</p>}
    </div>
  );
}

function SubcontractOrderForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState({
    supplierId: '', branchId: '', warehouseId: '', sentDate: new Date().toISOString().slice(0, 10),
    expectedReturnDate: '', subcontractingCost: '', note: '',
  });
  const [items, setItems] = useState([{ productId: '', variantId: '', quantity: 1 }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/suppliers').then(setSuppliers).catch(() => {});
    api.get('/products').then(setProducts).catch(() => {});
    api.get('/org/branches').then(setBranches).catch(() => {});
  }, []);
  useEffect(() => { if (form.branchId) api.get(`/org/warehouses?branchId=${form.branchId}`).then(setWarehouses).catch(() => {}); }, [form.branchId]);

  function updateItem(i, patch) {
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const itemsSent = items.filter((it) => it.productId).map((it) => {
        const p = products.find((pr) => pr._id === it.productId);
        return { productId: it.productId, variantId: p?.variants?.[0]?._id, quantity: Number(it.quantity) };
      });
      await api.post('/subcontracting', {
        ...form,
        subcontractingCost: Number(form.subcontractingCost) || 0,
        expectedReturnDate: form.expectedReturnDate || undefined,
        itemsSent,
      });
      toast(t('subcontracting.orderCreated', 'Subcontract order created.'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <p className="font-display text-lg mb-4">{t('subcontracting.newOrder', 'New subcontract order')}</p>
        <div className="space-y-3 mb-4">
          <div>
            <label className="field-label">{t('subcontracting.subcontractor', 'Subcontractor (supplier)')}</label>
            <select required className="field-input" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
              <option value="">{t('common.select', 'Select…')}</option>
              {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">{t('subcontracting.branch', 'Branch')}</label>
              <select required className="field-input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
                <option value="">{t('common.select', 'Select…')}</option>
                {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">{t('subcontracting.warehouse', 'Warehouse')}</label>
              <select required className="field-input" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} disabled={!form.branchId}>
                <option value="">{t('common.select', 'Select…')}</option>
                {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">{t('subcontracting.sentDate', 'Sent')}</label>
              <input type="date" required className="field-input" value={form.sentDate} onChange={(e) => setForm({ ...form, sentDate: e.target.value })} />
            </div>
            <div>
              <label className="field-label">{t('subcontracting.expectedReturn', 'Expected return')}</label>
              <input type="date" className="field-input" value={form.expectedReturnDate} onChange={(e) => setForm({ ...form, expectedReturnDate: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="field-label">{t('subcontracting.jobWorkCost', 'Job-work cost')}</label>
            <input type="number" min="0" step="0.01" className="field-input num" value={form.subcontractingCost} onChange={(e) => setForm({ ...form, subcontractingCost: e.target.value })} />
          </div>
        </div>

        <p className="field-label mb-1">{t('subcontracting.itemsSent', 'Items sent')}</p>
        <div className="space-y-2 mb-2">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <select className="field-input col-span-2" value={it.productId} onChange={(e) => updateItem(i, { productId: e.target.value })}>
                <option value="">{t('subcontracting.productPlaceholder', 'Product…')}</option>
                {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              <input type="number" min="0.01" step="0.01" className="field-input num" value={it.quantity} onChange={(e) => updateItem(i, { quantity: e.target.value })} />
            </div>
          ))}
        </div>
        <button type="button" className="btn-ghost !px-0 text-xs mb-4" onClick={() => setItems([...items, { productId: '', variantId: '', quantity: 1 }])}>
          {t('subcontracting.addItem', '+ Add item')}
        </button>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel', 'Cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('subcontracting.saving', 'Saving…') : t('subcontracting.create', 'Create')}</button>
        </div>
      </form>
    </div>
  );
}
