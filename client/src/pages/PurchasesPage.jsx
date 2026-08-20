import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

const STATUS_CHIP = { draft: 'chip-neutral', ordered: 'chip-info', partially_received: 'chip-warning', received: 'chip-accent', cancelled: 'chip-danger' };

export function PurchasesPage() {
  const { company } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api.get('/purchase-orders').then(setOrders).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <p className="page-title">Purchase orders</p>
          <button className="btn-primary" onClick={() => setShowForm(true)}>New purchase order</button>
        </div>

        {loading && <Loading />}
        {!loading && orders.length === 0 && (
          <EmptyState title="No purchase orders yet" description="Create one to order stock from a supplier." action={<button className="btn-primary" onClick={() => setShowForm(true)}>Create a PO</button>} />
        )}
        {!loading && orders.length > 0 && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                  <th className="px-3 py-2 font-medium">PO #</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((po) => (
                  <tr key={po._id} onClick={() => setSelected(po)} className={`border-b border-rule last:border-0 cursor-pointer hover:bg-paper ${selected?._id === po._id ? 'bg-accent-soft/40' : ''}`}>
                    <td className="px-3 py-2 num">{po.poNumber}</td>
                    <td className="px-3 py-2 text-ink-muted">{formatDate(po.createdAt)}</td>
                    <td className="px-3 py-2"><span className={STATUS_CHIP[po.status] || 'chip-neutral'}>{po.status.replace('_', ' ')}</span></td>
                    <td className="px-3 py-2 num text-right">{formatMoney(po.totalAmount, company?.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <PurchaseOrderPanel po={selected} onClose={() => setSelected(null)} onChanged={load} />}
      {showForm && <PurchaseOrderForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function PurchaseOrderPanel({ po: initialPo, onClose, onChanged }) {
  const { company } = useAuth();
  const toast = useToast();
  const [po, setPo] = useState(initialPo);
  const [grns, setGrns] = useState([]);
  const [loadingGrns, setLoadingGrns] = useState(true);
  const [showReceiveForm, setShowReceiveForm] = useState(false);
  const [busy, setBusy] = useState(false);

  function loadGrns() {
    setLoadingGrns(true);
    api.get(`/purchase-orders/${po._id}/grns`).then(setGrns).catch(() => {}).finally(() => setLoadingGrns(false));
  }
  function reloadPo() {
    api.get(`/purchase-orders/${po._id}`).then(setPo).catch(() => {});
  }
  useEffect(loadGrns, [po._id]);

  async function decide(approve) {
    setBusy(true);
    try {
      await api.post(`/purchase-orders/${po._id}/decide`, { approve });
      toast(approve ? 'PO approved.' : 'PO rejected.', 'success');
      onChanged();
      reloadPo();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function recordQC(grnId, itemId, passed) {
    try {
      await api.post(`/purchase-orders/grn/${grnId}/items/${itemId}/qc`, { passed });
      toast(passed ? 'Marked as passed QC.' : 'Marked as failed QC — stock reversed.', 'success');
      loadGrns();
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const fullyReceived = po.items.every((l) => l.quantityReceived >= l.quantityOrdered);

  return (
    <div className="w-full lg:w-[26rem] shrink-0 card p-4 h-fit">
      <div className="flex items-center justify-between mb-3">
        <p className="font-display text-lg num">{po.poNumber}</p>
        <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>Close</button>
      </div>

      <div className="space-y-1 text-sm mb-3">
        {po.items.map((item, i) => (
          <div key={i} className="flex justify-between">
            <span className="text-ink-muted">{formatMoney(item.unitCost, company?.currency)} × {item.quantityOrdered}</span>
            <span className="num text-ink-muted">recv. {item.quantityReceived}/{item.quantityOrdered}</span>
          </div>
        ))}
      </div>
      <div className="tear-line my-2" />
      <div className="flex justify-between text-base font-medium mb-4">
        <span>Total</span><span className="num">{formatMoney(po.totalAmount, company?.currency)}</span>
      </div>

      {po.status === 'draft' && (
        <div className="flex gap-2 mb-4">
          <button className="btn-primary flex-1" disabled={busy} onClick={() => decide(true)}>Approve</button>
          <button className="btn-secondary flex-1" disabled={busy} onClick={() => decide(false)}>Reject</button>
        </div>
      )}

      {['ordered', 'partially_received'].includes(po.status) && !fullyReceived && (
        <button className="btn-primary w-full mb-4" onClick={() => setShowReceiveForm(true)}>Receive goods</button>
      )}

      <p className="text-sm font-medium mb-2">Goods received notes</p>
      {loadingGrns && <p className="text-xs text-ink-muted">Loading…</p>}
      {!loadingGrns && grns.length === 0 && <p className="text-xs text-ink-muted">Nothing received yet.</p>}
      <div className="space-y-3">
        {grns.map((grn) => (
          <div key={grn._id} className="border border-rule rounded p-2.5">
            <div className="flex justify-between items-center mb-1.5">
              <span className="num text-xs text-ink-muted">{grn.grnNumber}</span>
              <span className="text-xs text-ink-muted">{formatDate(grn.receivedDate)}</span>
            </div>
            <div className="space-y-1.5">
              {grn.items.map((item) => (
                <div key={item._id} className="flex items-center justify-between text-xs">
                  <span className="num">{item.quantity} @ {formatMoney(item.unitCost, company?.currency)}</span>
                  {item.qcStatus === 'pending' ? (
                    <div className="flex gap-1">
                      <button className="btn-ghost !text-accent !px-1.5 !py-0.5 !text-xs" onClick={() => recordQC(grn._id, item._id, true)}>Pass</button>
                      <button className="btn-ghost !text-danger !px-1.5 !py-0.5 !text-xs" onClick={() => recordQC(grn._id, item._id, false)}>Fail</button>
                    </div>
                  ) : (
                    <span className={item.qcStatus === 'passed' ? 'chip-accent' : 'chip-danger'}>{item.qcStatus}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showReceiveForm && (
        <ReceiveGoodsForm
          po={po}
          onClose={() => setShowReceiveForm(false)}
          onReceived={() => { setShowReceiveForm(false); reloadPo(); loadGrns(); onChanged(); }}
        />
      )}
    </div>
  );
}

function ReceiveGoodsForm({ po, onClose, onReceived }) {
  const { company } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);

  const outstandingLines = po.items.filter((l) => l.quantityReceived < l.quantityOrdered);
  const [lines, setLines] = useState(() => outstandingLines.map((l) => ({
    purchaseOrderItemId: l._id, productId: l.productId, variantId: l.variantId,
    remaining: l.quantityOrdered - l.quantityReceived,
    quantity: l.quantityOrdered - l.quantityReceived,
    unitCost: l.unitCost,
    batchNumber: '', manufactureDate: '', expiryDate: '',
    serialNumbersText: '',
  })));

  useEffect(() => { api.get('/products').then(setProducts).catch(() => {}); }, []);

  function productFor(productId) {
    return products.find((p) => p._id === productId);
  }
  function updateLine(i, patch) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const items = lines
        .filter((l) => l.quantity > 0)
        .map((l) => {
          const item = {
            purchaseOrderItemId: l.purchaseOrderItemId, productId: l.productId, variantId: l.variantId,
            quantity: Number(l.quantity), unitCost: Number(l.unitCost),
          };
          if (l.batchNumber) {
            item.batchNumber = l.batchNumber;
            if (l.manufactureDate) item.manufactureDate = l.manufactureDate;
            if (l.expiryDate) item.expiryDate = l.expiryDate;
          }
          const product = productFor(l.productId);
          if (product?.trackingMode === 'serial') {
            const serialNumbers = l.serialNumbersText.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
            if (serialNumbers.length !== item.quantity) {
              throw new Error(`${product.name}: enter exactly ${item.quantity} serial number(s) — one per unit received (got ${serialNumbers.length}).`);
            }
            item.serialNumbers = serialNumbers;
          }
          return item;
        });
      if (items.length === 0) throw new Error('Enter a quantity for at least one line.');

      await api.post(`/purchase-orders/${po._id}/receive`, { warehouseId: po.warehouseId, items });
      toast('Goods received.', 'success');
      onReceived();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-50 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <p className="font-display text-lg mb-1">Receive goods</p>
        <p className="text-xs text-ink-muted mb-4">Against {po.poNumber}. Leave a line at 0 to skip it — partial receiving is fine, you can receive the rest later.</p>

        <div className="space-y-3">
          {lines.map((line, i) => {
            const product = productFor(line.productId);
            const needsBatch = product?.trackingMode === 'batch';
            const needsSerial = product?.trackingMode === 'serial';
            const enteredSerialCount = line.serialNumbersText.split(/[\n,]/).map((s) => s.trim()).filter(Boolean).length;
            return (
              <div key={line.purchaseOrderItemId} className="border border-rule rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">{product?.name || 'Product'}</p>
                  <span className="text-xs text-ink-muted num">{line.remaining} outstanding</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="field-label">Quantity received</label>
                    <input
                      type="number" min="0" max={line.remaining} className="field-input num"
                      value={line.quantity}
                      onChange={(e) => updateLine(i, { quantity: Math.max(0, Math.min(line.remaining, Number(e.target.value) || 0)) })}
                    />
                  </div>
                  <div>
                    <label className="field-label">Unit cost</label>
                    <input type="number" step="0.01" className="field-input num" value={line.unitCost} onChange={(e) => updateLine(i, { unitCost: e.target.value })} />
                  </div>
                </div>
                {needsBatch && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="field-label">Batch number</label>
                      <input className="field-input" value={line.batchNumber} onChange={(e) => updateLine(i, { batchNumber: e.target.value })} placeholder="Required for this product" />
                    </div>
                    <div>
                      <label className="field-label">Manufactured</label>
                      <input type="date" className="field-input" value={line.manufactureDate} onChange={(e) => updateLine(i, { manufactureDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="field-label">Expires</label>
                      <input type="date" className="field-input" value={line.expiryDate} onChange={(e) => updateLine(i, { expiryDate: e.target.value })} />
                    </div>
                  </div>
                )}
                {needsSerial && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="field-label !mb-0">Serial / IMEI numbers</label>
                      <span className={`text-xs num ${enteredSerialCount === line.quantity ? 'text-accent-strong' : 'text-warning'}`}>
                        {enteredSerialCount} / {line.quantity}
                      </span>
                    </div>
                    <textarea
                      className="field-input font-mono text-xs"
                      rows={3}
                      value={line.serialNumbersText}
                      onChange={(e) => updateLine(i, { serialNumbersText: e.target.value })}
                      placeholder="One per line or comma-separated — exactly one serial per unit received"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Receiving…' : 'Confirm receipt'}</button>
        </div>
      </form>
    </div>
  );
}

function PurchaseOrderForm({ onClose, onSaved }) {
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState([{ productId: '', variantId: '', quantityOrdered: 1, unitCost: 0 }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/suppliers').then(setSuppliers).catch(() => {});
    api.get('/products').then(setProducts).catch(() => {});
  }, []);
  useEffect(() => { if (branchId) api.get(`/org/warehouses?branchId=${branchId}`).then(setWarehouses).catch(() => {}); }, [branchId]);

  function updateLine(i, patch) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }
  function pickProduct(i, productId) {
    const product = products.find((p) => p._id === productId);
    updateLine(i, { productId, variantId: product?.variants?.[0]?._id || '', unitCost: product?.costPrice || 0 });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/purchase-orders', {
        branchId, warehouseId, supplierId,
        items: lines.filter((l) => l.productId).map((l) => ({ productId: l.productId, variantId: l.variantId, quantityOrdered: Number(l.quantityOrdered), unitCost: Number(l.unitCost) })),
      });
      toast('Purchase order created — awaiting approval.', 'success');
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
        <p className="font-display text-lg mb-4">New purchase order</p>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <select required className="field-input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">Branch…</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
          <select required className="field-input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} disabled={!branchId}>
            <option value="">Warehouse…</option>
            {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
          </select>
          <select required className="field-input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Supplier…</option>
            {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>

        <p className="field-label mb-1">Items</p>
        <div className="space-y-2 mb-2">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-4 gap-2">
              <select className="field-input col-span-2" value={line.productId} onChange={(e) => pickProduct(i, e.target.value)}>
                <option value="">Product…</option>
                {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              <input type="number" min="1" className="field-input num" value={line.quantityOrdered} onChange={(e) => updateLine(i, { quantityOrdered: e.target.value })} placeholder="Qty" />
              <input type="number" step="0.01" className="field-input num" value={line.unitCost} onChange={(e) => updateLine(i, { unitCost: e.target.value })} placeholder="Unit cost" />
            </div>
          ))}
        </div>
        <button type="button" className="btn-ghost !px-0 text-xs mb-4" onClick={() => setLines([...lines, { productId: '', variantId: '', quantityOrdered: 1, unitCost: 0 }])}>
          + Add line
        </button>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Create PO'}</button>
        </div>
      </form>
    </div>
  );
}
