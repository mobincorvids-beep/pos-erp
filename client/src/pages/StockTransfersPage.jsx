import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

const STATUS_CHIP = {
  in_transit: 'chip-warning',
  completed: 'chip-accent',
  cancelled: 'chip-danger',
};

export function StockTransfersPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  function load() {
    setLoading(true);
    api.get('/stock-transfers').then(setTransfers).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function receive(id) {
    try {
      await api.post(`/stock-transfers/${id}/receive`);
      toast(t('stockTransfers.transferReceived'), 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <p className="page-title">{t('stockTransfers.title')}</p>
          <p className="text-sm text-ink-muted mt-1">{t('stockTransfers.subtitle')}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowNew(true)}>
          <span className="font-icon text-[18px] leading-none">add</span>
          {t('stockTransfers.newTransfer')}
        </button>
      </div>

      {loading && <Loading />}
      {!loading && transfers.length === 0 && (
        <EmptyState title={t('stockTransfers.noTransfersYet')} description={t('stockTransfers.subtitle')} />
      )}
      {!loading && transfers.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="bg-surface-sunken">
                <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                  <th className="py-3 px-4 font-semibold">{t('stockTransfers.date')}</th>
                  <th className="py-3 px-4 font-semibold">{t('stockTransfers.items')}</th>
                  <th className="py-3 px-4 font-semibold">{t('stockTransfers.status')}</th>
                  <th className="py-3 px-4 font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {transfers.map((t2) => (
                  <tr key={t2._id} className="transition-colors hover:bg-accent-soft/20">
                    <td className="py-3 px-4 text-ink-muted">{formatDate(t2.createdAt)}</td>
                    <td className="py-3 px-4 num text-ink">{t('stockTransfers.unitsLines', { units: t2.items.reduce((s, i) => s + i.quantity, 0), lines: t2.items.length })}</td>
                    <td className="py-3 px-4"><span className={STATUS_CHIP[t2.status] || 'chip-neutral'}>{t2.status.replace('_', ' ')}</span></td>
                    <td className="py-3 px-4 text-right">
                      {t2.status === 'in_transit' && <button className="btn-ghost !text-accent" onClick={() => receive(t2._id)}>{t('stockTransfers.markReceived')}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {showNew && <NewTransferModal onClose={() => setShowNew(false)} onCreated={load} />}
    </div>
  );
}

function NewTransferModal({ onClose, onCreated }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [receiveImmediately, setReceiveImmediately] = useState(false);
  const [lines, setLines] = useState([{ productId: '', quantity: '' }]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/org/warehouses'), api.get('/products')]).then(([w, p]) => {
      setWarehouses(w);
      setProducts(p);
      if (w.length > 1) { setFromWarehouseId(w[0]._id); setToWarehouseId(w[1]._id); }
      else if (w.length) setFromWarehouseId(w[0]._id);
    }).catch((err) => toast(err.message, 'error'));
  }, []);

  function updateLine(i, patch) {
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() { setLines([...lines, { productId: '', quantity: '' }]); }
  function removeLine(i) { setLines(lines.filter((_, idx) => idx !== i)); }

  async function submit() {
    if (!fromWarehouseId || !toWarehouseId) return toast(t('stockTransfers.chooseBothWarehouses'), 'error');
    if (fromWarehouseId === toWarehouseId) return toast(t('stockTransfers.sourceDestMustDiffer'), 'error');
    const items = lines
      .filter((l) => l.productId && Number(l.quantity) > 0)
      .map((l) => {
        const product = products.find((p) => p._id === l.productId);
        const variant = product?.variants?.[0];
        return { productId: l.productId, variantId: variant?._id, quantity: Number(l.quantity) };
      })
      .filter((l) => l.variantId);
    if (items.length === 0) return toast(t('stockTransfers.addAtLeastOneProduct'), 'error');

    setBusy(true);
    try {
      await api.post('/stock-transfers', { fromWarehouseId, toWarehouseId, items, receiveImmediately });
      toast(receiveImmediately ? t('stockTransfers.transferCompleted') : t('stockTransfers.transferInitiated'), 'success');
      onCreated();
      onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="card p-5 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <p className="font-display text-lg font-semibold mb-4">{t('stockTransfers.newStockTransfer')}</p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="field-label">{t('stockTransfers.fromWarehouse')}</label>
            <select className="field-input" value={fromWarehouseId} onChange={(e) => setFromWarehouseId(e.target.value)}>
              <option value="">{t('stockTransfers.select')}</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('stockTransfers.toWarehouse')}</label>
            <select className="field-input" value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)}>
              <option value="">{t('stockTransfers.select')}</option>
              {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
        </div>

        <label className="field-label">{t('stockTransfers.items')}</label>
        <div className="space-y-2 mb-3">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-2">
              <select className="field-input flex-1" value={line.productId} onChange={(e) => updateLine(i, { productId: e.target.value })}>
                <option value="">{t('stockTransfers.selectProduct')}</option>
                {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              <input
                type="number" className="field-input w-24" placeholder={t('stockTransfers.qty')}
                value={line.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })}
              />
              {lines.length > 1 && <button className="btn-ghost !text-danger" onClick={() => removeLine(i)}>&times;</button>}
            </div>
          ))}
        </div>
        <button className="btn-ghost !text-accent mb-4" onClick={addLine}>
          <span className="font-icon text-[16px] leading-none">add</span>
          {t('stockTransfers.addAnotherItem')}
        </button>

        <label className="flex items-center gap-2 text-sm mb-4">
          <input type="checkbox" checked={receiveImmediately} onChange={(e) => setReceiveImmediately(e.target.checked)} />
          {t('stockTransfers.receiveImmediately')}
        </label>

        <div className="flex gap-2 justify-end">
          <button className="btn-secondary" onClick={onClose}>{t('stockTransfers.cancel')}</button>
          <button className="btn-primary" disabled={busy} onClick={submit}>{t('stockTransfers.createTransfer')}</button>
        </div>
      </div>
    </div>
  );
}
