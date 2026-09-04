import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

const STATUS_CHIP = { pending: 'chip-warning', received: 'chip-accent' };
const COST_TYPES = ['customs_duty', 'freight', 'insurance', 'other'];

export function ImportExportPage() {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [receiving, setReceiving] = useState(null);

  function load() {
    setLoading(true);
    api.get('/import-export/shipments').then(setShipments).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="page-title">{t('importExport.title')}</p>
        <button className="btn-primary" onClick={() => setShowForm(true)}>{t('importExport.newShipment')}</button>
      </div>
      <p className="text-sm text-ink-muted mb-5 max-w-2xl">{t('importExport.subtitle')}</p>

      {loading && <Loading />}
      {!loading && shipments.length === 0 && (
        <EmptyState title={t('importExport.emptyTitle')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('importExport.createOne')}</button>} />
      )}
      {!loading && shipments.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule bg-surface-sunken text-left text-xs text-ink-muted uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-semibold">{t('importExport.supplier')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('importExport.items')}</th>
                  <th className="px-4 py-2.5 font-semibold text-right">{t('importExport.additionalCosts')}</th>
                  <th className="px-4 py-2.5 font-semibold">{t('importExport.status')}</th>
                  <th className="px-4 py-2.5 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s) => (
                  <tr key={s._id} className="border-b border-rule last:border-0 hover:bg-surface-sunken/60">
                    <td className="px-4 py-2.5 text-ink font-medium">{s.supplierId?.name || '-'}</td>
                    <td className="px-4 py-2.5 text-ink-muted">{s.items.length}</td>
                    <td className="px-4 py-2.5 num text-right">{formatMoney(s.additionalCosts.reduce((sum, c) => sum + c.amount, 0), company?.currency)}</td>
                    <td className="px-4 py-2.5"><span className={STATUS_CHIP[s.status]}>{s.status}</span></td>
                    <td className="px-4 py-2.5 text-right">
                      {s.status === 'pending' && <button className="btn-ghost !text-accent" onClick={() => setReceiving(s)}>{t('importExport.receive')}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && <ShipmentForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {receiving && <ReceiveForm shipment={receiving} onClose={() => setReceiving(null)} onReceived={() => { setReceiving(null); load(); }} />}
    </div>
  );
}

function ShipmentForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState([{ productId: '', variantId: '', quantity: '', unitPrice: '' }]);
  const [costs, setCosts] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/suppliers').then(setSuppliers).catch(() => {});
    api.get('/products').then(setProducts).catch(() => {});
    api.get('/org/accounts').then(setAccounts).catch(() => {});
  }, []);

  function updateItem(i, patch) {
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }
  function pickProduct(i, productId) {
    const product = products.find((p) => p._id === productId);
    updateItem(i, { productId, variantId: product?.variants?.[0]?._id || '' });
  }
  function updateCost(i, patch) {
    setCosts((prev) => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/import-export/shipments', {
        branchId, supplierId,
        items: items.filter((it) => it.productId).map((it) => ({ productId: it.productId, variantId: it.variantId, quantity: Number(it.quantity), unitPrice: Number(it.unitPrice) })),
        additionalCosts: costs.filter((c) => c.type).map((c) => ({ type: c.type, amount: Number(c.amount), accountId: c.accountId })),
      });
      toast(t('importExport.shipmentCreated'), 'success');
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
        <p className="font-display text-lg font-semibold text-ink mb-4">{t('importExport.newShipment')}</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <select required className="field-input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">{t('importExport.branchPlaceholder')}</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
          <select required className="field-input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">{t('importExport.supplierPlaceholder')}</option>
            {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>

        <p className="field-label mb-1.5">{t('importExport.itemsRawInvoicePrice')}</p>
        <div className="space-y-2 mb-2">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-4 gap-2">
              <select className="field-input col-span-2" value={it.productId} onChange={(e) => pickProduct(i, e.target.value)}>
                <option value="">{t('importExport.productPlaceholder')}</option>
                {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              <input type="number" min="1" className="field-input num" placeholder={t('importExport.qty')} value={it.quantity} onChange={(e) => updateItem(i, { quantity: e.target.value })} />
              <input type="number" step="0.01" className="field-input num" placeholder={t('importExport.unitPrice')} value={it.unitPrice} onChange={(e) => updateItem(i, { unitPrice: e.target.value })} />
            </div>
          ))}
        </div>
        <button type="button" className="btn-ghost !px-0 text-xs font-semibold mb-5" onClick={() => setItems([...items, { productId: '', variantId: '', quantity: '', unitPrice: '' }])}>
          {t('importExport.addItem')}
        </button>

        <p className="field-label mb-1.5">{t('importExport.additionalCostsAllocated')}</p>
        <div className="space-y-2 mb-2">
          {costs.map((c, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <select className="field-input" value={c.type} onChange={(e) => updateCost(i, { type: e.target.value })}>
                <option value="">{t('importExport.typePlaceholder')}</option>
                {COST_TYPES.map((ct) => <option key={ct} value={ct}>{ct.replace('_', ' ')}</option>)}
              </select>
              <input type="number" step="0.01" className="field-input num" placeholder={t('importExport.amount')} value={c.amount} onChange={(e) => updateCost(i, { amount: e.target.value })} />
              <select className="field-input" value={c.accountId} onChange={(e) => updateCost(i, { accountId: e.target.value })}>
                <option value="">{t('importExport.owedToPlaceholder')}</option>
                {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select>
            </div>
          ))}
        </div>
        <button type="button" className="btn-ghost !px-0 text-xs font-semibold mb-5" onClick={() => setCosts([...costs, { type: '', amount: '', accountId: '' }])}>
          {t('importExport.addCost')}
        </button>

        <div className="flex justify-end gap-2 pt-3 border-t border-rule">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('importExport.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('importExport.creating') : t('importExport.createShipment')}</button>
        </div>
      </form>
    </div>
  );
}

function ReceiveForm({ shipment, onClose, onReceived }) {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [accounts, setAccounts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [inventoryAssetAccountId, setInventoryAssetAccountId] = useState('');
  const [supplierPayableAccountId, setSupplierPayableAccountId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/accounts').then(setAccounts).catch(() => {});
    if (shipment.branchId) api.get(`/org/warehouses?branchId=${shipment.branchId}`).then(setWarehouses).catch(() => {});
  }, []);

  const totalAdditionalCosts = shipment.additionalCosts.reduce((sum, c) => sum + c.amount, 0);
  const baseValue = shipment.items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await api.post(`/import-export/shipments/${shipment._id}/receive`, { warehouseId, inventoryAssetAccountId, supplierPayableAccountId });
      toast(t('importExport.receivedLandedCost', { amount: formatMoney(baseValue + totalAdditionalCosts, company?.currency) }), 'success');
      onReceived();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg font-semibold text-ink mb-1">{t('importExport.receiveShipment')}</p>
        <p className="text-sm text-ink-muted mb-4">{t('importExport.baseValueBreakdown', { base: formatMoney(baseValue, company?.currency), costs: formatMoney(totalAdditionalCosts, company?.currency), total: formatMoney(baseValue + totalAdditionalCosts, company?.currency) })}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('importExport.warehouse')}</label>
            <select required className="field-input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">{t('importExport.selectPlaceholder')}</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('importExport.inventoryAssetAccount')}</label>
            <select required className="field-input" value={inventoryAssetAccountId} onChange={(e) => setInventoryAssetAccountId(e.target.value)}>
              <option value="">{t('importExport.selectPlaceholder')}</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('importExport.supplierPayableAccount')}</label>
            <select required className="field-input" value={supplierPayableAccountId} onChange={(e) => setSupplierPayableAccountId(e.target.value)}>
              <option value="">{t('importExport.selectPlaceholder')}</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-3 border-t border-rule">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('importExport.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('importExport.receiving') : t('importExport.receiveAndAllocate')}</button>
        </div>
      </form>
    </div>
  );
}
