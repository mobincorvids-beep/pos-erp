import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';

const STATUS_CHIP = { draft: 'chip-neutral', ordered: 'chip-info', partially_received: 'chip-warning', received: 'chip-accent', cancelled: 'chip-danger' };

export function PurchasesPage() {
  const { t } = useTranslation();
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
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="page-title mb-1">{t('purchases.title')}</p>
            <p className="text-sm text-ink-muted">{t('purchases.subtitle')}</p>
          </div>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t('purchases.newPurchaseOrder')}
          </button>
        </div>

        {loading && <Loading />}
        {!loading && orders.length === 0 && (
          <EmptyState title={t('purchases.emptyTitle')} description={t('purchases.emptyDescription')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('purchases.createPO')}</button>} />
        )}
        {!loading && orders.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-rule flex items-center justify-between">
              <p className="font-display text-lg font-semibold text-ink">{t('purchases.activePOs')}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-sunken/60 border-b border-rule">
                    <th className="px-5 py-3 eyebrow font-medium">{t('purchases.colPoNumber')}</th>
                    <th className="px-5 py-3 eyebrow font-medium">{t('purchases.colDate')}</th>
                    <th className="px-5 py-3 eyebrow font-medium">{t('purchases.colStatus')}</th>
                    <th className="px-5 py-3 eyebrow font-medium text-right">{t('purchases.colTotal')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule text-sm">
                  {orders.map((po) => (
                    <tr key={po._id} onClick={() => setSelected(po)} className={`cursor-pointer transition-colors hover:bg-accent-soft/30 ${selected?._id === po._id ? 'bg-accent-soft/40' : ''}`}>
                      <td className="px-5 py-4 num font-medium text-accent">{po.poNumber}</td>
                      <td className="px-5 py-4 text-ink-muted">{formatDate(po.createdAt)}</td>
                      <td className="px-5 py-4"><span className={STATUS_CHIP[po.status] || 'chip-neutral'}>{po.status.replace('_', ' ')}</span></td>
                      <td className="px-5 py-4 num text-right font-medium">{formatMoney(po.totalAmount, company?.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {selected && <PurchaseOrderPanel po={selected} onClose={() => setSelected(null)} onChanged={load} />}
      {showForm && <PurchaseOrderForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function PurchaseOrderPanel({ po: initialPo, onClose, onChanged }) {
  const { t } = useTranslation();
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
  // The list view's row doesn't carry the computed landed-cost allocation
  // (allocatedLandedCost/adjustedUnitCost per item) — fetch the full detail
  // once so that shows up immediately, not just after the first add/remove.
  useEffect(reloadPo, [po._id]);

  async function decide(approve) {
    setBusy(true);
    try {
      await api.post(`/purchase-orders/${po._id}/decide`, { approve });
      toast(approve ? t('purchases.poApproved') : t('purchases.poRejected'), 'success');
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
      toast(passed ? t('purchases.passedQC') : t('purchases.failedQC'), 'success');
      loadGrns();
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  /** Saves the free-text putaway location for one received line — informational only, doesn't move stock. */
  async function saveBinLocation(grnId, itemId, binLocation) {
    try {
      await api.put(`/purchase-orders/grn/${grnId}/items/${itemId}/bin-location`, { binLocation });
      toast(t('purchases.binLocationSaved'), 'success');
      loadGrns();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const fullyReceived = po.items.every((l) => l.quantityReceived >= l.quantityOrdered);

  return (
    <div className="w-full lg:w-[26rem] shrink-0 card p-5 h-fit">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="eyebrow mb-0.5">{t('purchases.purchaseOrder')}</p>
          <p className="font-display text-lg font-semibold num text-accent">{po.poNumber}</p>
        </div>
        <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>{t('common.close')}</button>
      </div>

      <div className="space-y-1.5 text-sm mb-3 bg-surface-sunken/50 rounded-lg p-3">
        {po.items.map((item, i) => (
          <div key={i} className="flex justify-between items-baseline">
            <span className="text-ink-muted">
              {formatMoney(item.unitCost, company?.currency)} × {item.quantityOrdered}
              {item.adjustedUnitCost != null && item.adjustedUnitCost !== item.unitCost && (
                <span className="num text-accent-strong ml-1.5" title={t('purchases.adjustedUnitCost')}>
                  → {formatMoney(item.adjustedUnitCost, company?.currency)}{t('purchases.perUnit')}
                </span>
              )}
            </span>
            <span className="num text-ink-muted">{t('purchases.recv', { received: item.quantityReceived, ordered: item.quantityOrdered })}</span>
          </div>
        ))}
      </div>
      <div className="tear-line my-2" />
      <div className="flex justify-between text-base font-medium mb-4">
        <span>{t('purchases.total')}</span><span className="num">{formatMoney(po.totalAmount, company?.currency)}</span>
      </div>

      <LandedCostsSection po={po} onChanged={reloadPo} />

      {po.status === 'draft' && (
        <div className="flex gap-2 mb-4">
          <button className="btn-primary flex-1" disabled={busy} onClick={() => decide(true)}>{t('purchases.approve')}</button>
          <button className="btn-secondary flex-1" disabled={busy} onClick={() => decide(false)}>{t('purchases.reject')}</button>
        </div>
      )}

      {['ordered', 'partially_received'].includes(po.status) && !fullyReceived && (
        <button className="btn-primary w-full mb-4" onClick={() => setShowReceiveForm(true)}>{t('purchases.receiveGoods')}</button>
      )}

      <p className="eyebrow mb-2">{t('purchases.goodsReceivedNotes')}</p>
      {loadingGrns && <p className="text-xs text-ink-muted">{t('common.loading')}</p>}
      {!loadingGrns && grns.length === 0 && <p className="text-xs text-ink-muted">{t('purchases.nothingReceivedYet')}</p>}
      <div className="space-y-3">
        {grns.map((grn) => (
          <div key={grn._id} className="border border-rule rounded-lg p-3">
            <div className="flex justify-between items-center mb-1.5">
              <span className="num text-xs text-ink-muted">{grn.grnNumber}</span>
              <span className="text-xs text-ink-muted">{formatDate(grn.receivedDate)}</span>
            </div>
            <div className="space-y-1.5">
              {grn.items.map((item) => (
                <div key={item._id} className="text-xs">
                  <div className="flex items-center justify-between">
                    <span className="num">{item.quantity} @ {formatMoney(item.unitCost, company?.currency)}</span>
                    {item.qcStatus === 'pending' ? (
                      <div className="flex gap-1">
                        <button className="btn-ghost !text-accent !px-1.5 !py-0.5 !text-xs" onClick={() => recordQC(grn._id, item._id, true)}>{t('purchases.pass')}</button>
                        <button className="btn-ghost !text-danger !px-1.5 !py-0.5 !text-xs" onClick={() => recordQC(grn._id, item._id, false)}>{t('purchases.fail')}</button>
                      </div>
                    ) : (
                      <span className={item.qcStatus === 'passed' ? 'chip-accent' : 'chip-danger'}>{item.qcStatus}</span>
                    )}
                  </div>
                  <BinLocationField
                    value={item.binLocation}
                    onSave={(value) => saveBinLocation(grn._id, item._id, value)}
                  />
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

/**
 * Freight, customs duty, insurance, handling fees, etc. incurred on the PO
 * as a whole — allocated across line items server-side (see
 * purchaseService.computeLandedCostAllocation) so each product's true
 * per-unit cost (used for COGS/inventory valuation on receipt) includes its
 * fair share, not just the vendor's unit price. Available while the PO
 * isn't cancelled, same as the backend guard.
 */
function LandedCostsSection({ po, onChanged }) {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [allocationMethod, setAllocationMethod] = useState('by_value');
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const landedCosts = po.landedCosts || [];
  const totalLandedCost = po.totalLandedCost ?? landedCosts.reduce((sum, c) => sum + c.amount, 0);

  async function submitAdd(e) {
    e.preventDefault();
    const amt = Number(amount);
    if (!description.trim() || Number.isNaN(amt) || amt < 0) {
      toast(t('purchases.landedCostSaveError'), 'error');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/purchase-orders/${po._id}/landed-costs`, { description: description.trim(), amount: amt, allocationMethod });
      toast(t('purchases.landedCostAdded'), 'success');
      setDescription(''); setAmount(''); setAllocationMethod('by_value'); setShowAdd(false);
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove(costId) {
    setRemovingId(costId);
    try {
      await api.del(`/purchase-orders/${po._id}/landed-costs/${costId}`);
      toast(t('purchases.landedCostRemoved'), 'success');
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setRemovingId(null);
    }
  }

  if (po.status === 'cancelled') return null;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <p className="eyebrow">{t('purchases.landedCosts')}</p>
        {!showAdd && (
          <button type="button" className="btn-ghost !px-0 !py-0 text-xs" onClick={() => setShowAdd(true)}>{t('purchases.addLandedCost')}</button>
        )}
      </div>
      <p className="text-xs text-ink-muted mb-2">{t('purchases.landedCostsHint')}</p>

      {landedCosts.length === 0 && !showAdd && (
        <p className="text-xs text-ink-muted mb-2">{t('purchases.noLandedCosts')}</p>
      )}

      {landedCosts.length > 0 && (
        <div className="space-y-1 mb-2">
          {landedCosts.map((cost) => (
            <div key={cost._id} className="flex items-center justify-between text-xs bg-surface-sunken/50 rounded-lg px-2.5 py-1.5">
              <div className="min-w-0">
                <span className="font-medium">{cost.description}</span>
                <span className="text-ink-muted ml-1.5">{cost.allocationMethod === 'by_quantity' ? t('purchases.allocateByQuantity') : t('purchases.allocateByValue')}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="num">{formatMoney(cost.amount, company?.currency)}</span>
                <button type="button" disabled={removingId === cost._id} className="text-ink-muted hover:text-danger" onClick={() => remove(cost._id)}>
                  <span className="material-symbols-outlined text-[16px] leading-none">close</span>
                </button>
              </div>
            </div>
          ))}
          <div className="flex justify-between text-xs font-medium pt-0.5">
            <span>{t('purchases.totalLandedCost')}</span>
            <span className="num">{formatMoney(totalLandedCost, company?.currency)}</span>
          </div>
        </div>
      )}

      {showAdd && (
        <form onSubmit={submitAdd} className="border border-rule rounded-lg p-2.5 bg-surface-sunken/30 space-y-2">
          <input className="field-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('purchases.descriptionPlaceholder')} />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" step="0.01" min="0" className="field-input num" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t('purchases.amountPlaceholder')} />
            <select className="field-input" value={allocationMethod} onChange={(e) => setAllocationMethod(e.target.value)}>
              <option value="by_value">{t('purchases.allocateByValue')}</option>
              <option value="by_quantity">{t('purchases.allocateByQuantity')}</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary !text-xs" onClick={() => setShowAdd(false)}>{t('common.cancel')}</button>
            <button type="submit" disabled={saving} className="btn-primary !text-xs">{saving ? t('common.saving') : t('purchases.addLandedCost')}</button>
          </div>
        </form>
      )}
      <div className="tear-line my-2" />
    </div>
  );
}

function ReceiveGoodsForm({ po, onClose, onReceived }) {
  const { t } = useTranslation();
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

  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => { api.get('/products').then(setProducts).catch(() => {}); }, []);

  function productFor(productId) {
    return products.find((p) => p._id === productId);
  }
  function updateLine(i, patch) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }

  /** Camera scan for goods receiving, matches the scanned barcode to a product already on this PO's outstanding lines and sets that line's received quantity to its full remaining amount (the common "scan it, it's all here" receiving flow). A code that doesn't match any outstanding line just gets reported, nothing else changes. */
  function handleBarcodeDetected(code) {
    setScannerOpen(false);
    const line = lines.find((l) => {
      const product = productFor(l.productId);
      return product?.barcode === code || product?.variants?.some((v) => v.barcode === code || v._id === l.variantId && v.barcode === code);
    });
    if (!line) {
      toast(t('purchases.noOutstandingLineMatch', { code }), 'error');
      return;
    }
    updateLine(lines.indexOf(line), { quantity: line.remaining });
    toast(t('purchases.setFullyReceived', { name: productFor(line.productId)?.name || t('purchases.item'), qty: line.remaining }), 'success');
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
              throw new Error(t('purchases.exactSerialError', { name: product.name, count: item.quantity, got: serialNumbers.length }));
            }
            item.serialNumbers = serialNumbers;
          }
          return item;
        });
      if (items.length === 0) throw new Error(t('purchases.enterQuantityError'));

      await api.post(`/purchase-orders/${po._id}/receive`, { warehouseId: po.warehouseId, items });
      toast(t('purchases.goodsReceived'), 'success');
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
        <div className="flex items-start justify-between gap-3 mb-1">
          <p className="font-display text-lg font-semibold text-ink">{t('purchases.receiveGoods')}</p>
          <button type="button" className="btn-secondary !text-xs shrink-0" onClick={() => setScannerOpen(true)}>
            <span className="font-icon text-[16px] leading-none">photo_camera</span>
            {t('purchases.scanBarcode')}
          </button>
        </div>
        <p className="text-xs text-ink-muted mb-4">{t('purchases.receiveAgainst')} <span className="num">{po.poNumber}</span>. {t('purchases.receiveHint')}</p>
        {scannerOpen && <BarcodeScannerModal onDetected={handleBarcodeDetected} onClose={() => setScannerOpen(false)} />}

        <div className="space-y-3">
          {lines.map((line, i) => {
            const product = productFor(line.productId);
            const needsBatch = product?.trackingMode === 'batch';
            const needsSerial = product?.trackingMode === 'serial';
            const enteredSerialCount = line.serialNumbersText.split(/[\n,]/).map((s) => s.trim()).filter(Boolean).length;
            return (
              <div key={line.purchaseOrderItemId} className="border border-rule rounded-lg p-3 bg-surface-sunken/30">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">{product?.name || t('purchases.item')}</p>
                  <span className="text-xs text-ink-muted num">{t('purchases.outstanding', { count: line.remaining })}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="field-label">{t('purchases.quantityReceived')}</label>
                    <input
                      type="number" min="0" max={line.remaining} className="field-input num"
                      value={line.quantity}
                      onChange={(e) => updateLine(i, { quantity: Math.max(0, Math.min(line.remaining, Number(e.target.value) || 0)) })}
                    />
                  </div>
                  <div>
                    <label className="field-label">{t('purchases.unitCost')}</label>
                    <input type="number" step="0.01" className="field-input num" value={line.unitCost} onChange={(e) => updateLine(i, { unitCost: e.target.value })} />
                  </div>
                </div>
                {needsBatch && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="field-label">{t('purchases.batchNumber')}</label>
                      <input className="field-input" value={line.batchNumber} onChange={(e) => updateLine(i, { batchNumber: e.target.value })} placeholder={t('purchases.batchRequiredPlaceholder')} />
                    </div>
                    <div>
                      <label className="field-label">{t('purchases.manufactured')}</label>
                      <input type="date" className="field-input" value={line.manufactureDate} onChange={(e) => updateLine(i, { manufactureDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="field-label">{t('purchases.expires')}</label>
                      <input type="date" className="field-input" value={line.expiryDate} onChange={(e) => updateLine(i, { expiryDate: e.target.value })} />
                    </div>
                  </div>
                )}
                {needsSerial && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="field-label !mb-0">{t('purchases.serialNumbers')}</label>
                      <span className={`text-xs num ${enteredSerialCount === line.quantity ? 'text-accent-strong' : 'text-warning'}`}>
                        {enteredSerialCount} / {line.quantity}
                      </span>
                    </div>
                    <textarea
                      className="field-input font-mono text-xs"
                      rows={3}
                      value={line.serialNumbersText}
                      onChange={(e) => updateLine(i, { serialNumbersText: e.target.value })}
                      placeholder={t('purchases.serialPlaceholder')}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('purchases.receiving') : t('purchases.confirmReceipt')}</button>
        </div>
      </form>
    </div>
  );
}

function PurchaseOrderForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const { company } = useAuth();
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

  // Optional foreign-currency denomination — collapsed by default so the
  // common (base-currency) case stays exactly as simple as before. When
  // set, this only drives the display-only converted total below; every
  // unitCost above is still entered/stored in the company's base currency.
  const [showCurrency, setShowCurrency] = useState(false);
  const [currency, setCurrency] = useState('');
  const [rate, setRate] = useState(null);
  const [rateLoading, setRateLoading] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/suppliers').then(setSuppliers).catch(() => {});
    api.get('/products').then(setProducts).catch(() => {});
  }, []);
  useEffect(() => { if (branchId) api.get(`/org/warehouses?branchId=${branchId}`).then(setWarehouses).catch(() => {}); }, [branchId]);

  useEffect(() => {
    if (!currency || !company?.currency || currency.toUpperCase() === company.currency.toUpperCase()) {
      setRate(null);
      return;
    }
    setRateLoading(true);
    api.get(`/currency/rate?from=${company.currency}&to=${currency}`)
      .then((r) => setRate(r.rate))
      .catch(() => setRate(null))
      .finally(() => setRateLoading(false));
  }, [currency, company?.currency]);

  const subtotal = lines.reduce((sum, l) => sum + (Number(l.quantityOrdered) || 0) * (Number(l.unitCost) || 0), 0);

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
        ...(showCurrency && currency ? { currency } : {}),
      });
      toast(t('purchases.poCreated'), 'success');
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
        <p className="font-display text-lg font-semibold text-ink mb-4">{t('purchases.newPOTitle')}</p>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <select required className="field-input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">{t('purchases.branchPlaceholder')}</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
          <select required className="field-input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} disabled={!branchId}>
            <option value="">{t('purchases.warehousePlaceholder')}</option>
            {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
          </select>
          <select required className="field-input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">{t('purchases.supplierPlaceholder')}</option>
            {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>

        <p className="field-label mb-1">{t('purchases.items')}</p>
        <div className="space-y-2 mb-2">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-4 gap-2">
              <select className="field-input col-span-2" value={line.productId} onChange={(e) => pickProduct(i, e.target.value)}>
                <option value="">{t('purchases.productPlaceholder')}</option>
                {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              <input type="number" min="1" className="field-input num" value={line.quantityOrdered} onChange={(e) => updateLine(i, { quantityOrdered: e.target.value })} placeholder={t('purchases.qtyPlaceholder')} />
              <input type="number" step="0.01" className="field-input num" value={line.unitCost} onChange={(e) => updateLine(i, { unitCost: e.target.value })} placeholder={t('purchases.unitCostPlaceholder')} />
            </div>
          ))}
        </div>
        <button type="button" className="btn-ghost !px-0 text-xs mb-4" onClick={() => setLines([...lines, { productId: '', variantId: '', quantityOrdered: 1, unitCost: 0 }])}>
          {t('purchases.addLine')}
        </button>

        {!showCurrency ? (
          <button type="button" className="btn-ghost !px-0 text-xs mb-4 block" onClick={() => setShowCurrency(true)}>
            Bill in a foreign currency (optional)
          </button>
        ) : (
          <div className="mb-4 rounded-lg border border-line-muted p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="field-label mb-0">Supplier currency</p>
              <button type="button" className="btn-ghost !px-0 text-xs" onClick={() => { setShowCurrency(false); setCurrency(''); }}>
                Use {company?.currency || 'base currency'} instead
              </button>
            </div>
            <select className="field-input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="">{company?.currency || 'Base currency'}</option>
              {['USD', 'EUR', 'GBP', 'AED', 'SAR'].filter((c) => c !== company?.currency).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {currency && (
              <p className="text-xs text-ink-muted mt-2">
                {rateLoading ? 'Fetching rate…' : rate
                  ? `Total ≈ ${formatMoney(subtotal * rate, currency)} (1 ${company?.currency} = ${rate} ${currency})`
                  : 'No rate available yet, enter a manual rate under Settings → Currency first.'}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('common.saving') : t('purchases.createPOBtn')}</button>
        </div>
      </form>
    </div>
  );
}

/** Inline, click-to-edit free-text putaway location for one GRN line — informational only, see GoodsReceivedNote.js's binLocation comment. */
function BinLocationField({ value, onSave }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        className="mt-1 flex items-center gap-1 text-ink-muted hover:text-accent"
        onClick={() => { setDraft(value || ''); setEditing(true); }}
      >
        <span className="text-[11px]">{t('purchases.binLocation')}:</span>
        <span className={value ? 'font-medium text-ink' : 'italic'}>{value || t('purchases.binLocationUnset')}</span>
      </button>
    );
  }

  async function save() {
    setSaving(true);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-1 flex items-center gap-1.5">
      <input
        autoFocus
        className="field-input !py-0.5 !text-xs flex-1"
        placeholder={t('purchases.binLocationPlaceholder')}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        disabled={saving}
      />
      <button type="button" className="btn-ghost !text-accent !px-1.5 !py-0.5 !text-xs" disabled={saving} onClick={save}>{t('common.save')}</button>
      <button type="button" className="btn-ghost !px-1.5 !py-0.5 !text-xs" disabled={saving} onClick={() => setEditing(false)}>{t('common.cancel')}</button>
    </div>
  );
}
