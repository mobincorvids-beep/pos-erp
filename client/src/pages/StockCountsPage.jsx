import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatQty, formatDate } from '../lib/format';

const STATUS_CHIP = {
  in_progress: 'chip-info',
  submitted: 'chip-accent',
  completed: 'chip-accent',
  cancelled: 'chip-danger',
};

export function StockCountsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [counts, setCounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);

  function load() {
    setLoading(true);
    api.get('/stock-counts').then(setCounts).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function deleteCount(c) {
    if (!window.confirm(t('stockCounts.confirmDelete', { countNumber: c.countNumber }))) return;
    try {
      await api.del(`/stock-counts/${c._id}`);
      toast(t('stockCounts.stocktakeDeleted'), 'success');
      if (selected?._id === c._id) setSelected(null);
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <p className="page-title">{t('stockCounts.title')}</p>
          <p className="text-sm text-ink-muted mt-1">{t('stockCounts.subtitle')}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowNew(true)}>
          <span className="font-icon text-[18px] leading-none">add</span>
          {t('stockCounts.startAStocktake')}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0">
          {loading && <Loading />}
          {!loading && counts.length === 0 && <EmptyState title={t('stockCounts.noStocktakesYet')} description={t('stockCounts.noStocktakesDescription')} />}
          {!loading && counts.length > 0 && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead className="bg-surface-sunken">
                    <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                      <th className="py-3 px-4 font-semibold">{t('stockCounts.countNumber')}</th>
                      <th className="py-3 px-4 font-semibold">{t('stockCounts.date')}</th>
                      <th className="py-3 px-4 font-semibold">{t('stockCounts.status')}</th>
                      <th className="py-3 px-4 font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {counts.map((c) => (
                      <tr
                        key={c._id}
                        onClick={() => setSelected(c)}
                        className={`cursor-pointer transition-colors hover:bg-accent-soft/20 ${selected?._id === c._id ? 'bg-accent-soft/40' : ''}`}
                      >
                        <td className="py-3 px-4 num text-ink">{c.countNumber}</td>
                        <td className="py-3 px-4 text-ink-muted">{formatDate(c.createdAt)}</td>
                        <td className="py-3 px-4"><span className={STATUS_CHIP[c.status] || 'chip-neutral'}>{c.status.replace('_', ' ')}</span></td>
                        <td className="py-3 px-4 text-right">
                          {c.status === 'in_progress' ? (
                            <button
                              className="text-ink-muted hover:text-danger"
                              title={t('stockCounts.deleteStocktake')}
                              onClick={(e) => { e.stopPropagation(); deleteCount(c); }}
                            >
                              <span className="font-icon text-[18px] leading-none">delete</span>
                            </button>
                          ) : (
                            <span className="text-ink-muted/40" title={t('stockCounts.submittedCannotDeleteHint')}>
                              <span className="font-icon text-[18px] leading-none">delete</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        {selected && <StockCountPanel count={selected} onClose={() => setSelected(null)} onChanged={load} />}
      </div>
      {showNew && <NewStockCountModal onClose={() => setShowNew(false)} onCreated={load} />}
    </div>
  );
}

function NewStockCountModal({ onClose, onCreated }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/org/warehouses').then((rows) => {
      setWarehouses(rows);
      if (rows.length) setWarehouseId(rows[0]._id);
    }).catch((err) => toast(err.message, 'error'));
  }, []);

  async function start() {
    if (!warehouseId) return;
    setBusy(true);
    try {
      // Omitting variantIds counts every variant currently stocked in this warehouse.
      await api.post('/stock-counts', { warehouseId });
      toast(t('stockCounts.stocktakeStarted'), 'success');
      onCreated();
      onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="card p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <p className="font-display text-lg font-semibold mb-4">{t('stockCounts.startAStocktake')}</p>
        <label className="field-label">{t('stockCounts.warehouse')}</label>
        <select className="field-input mb-4" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
        </select>
        <p className="text-xs text-ink-muted mb-4">{t('stockCounts.startHint')}</p>
        <div className="flex gap-2 justify-end">
          <button className="btn-secondary" onClick={onClose}>{t('stockCounts.cancel')}</button>
          <button className="btn-primary" disabled={busy || !warehouseId} onClick={start}>{t('stockCounts.start')}</button>
        </div>
      </div>
    </div>
  );
}

function StockCountPanel({ count, onClose, onChanged }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [counted, setCounted] = useState(() => Object.fromEntries(count.items.map((i) => [i._id, i.countedQuantity ?? ''])));
  const [busy, setBusy] = useState(false);

  async function saveCounts() {
    setBusy(true);
    try {
      await api.patch(`/stock-counts/${count._id}/counts`, {
        counts: Object.entries(counted).filter(([, v]) => v !== '').map(([itemId, countedQuantity]) => ({ itemId, countedQuantity: Number(countedQuantity) })),
      });
      toast(t('stockCounts.countsSaved'), 'success');
      onChanged();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function submit() {
    setBusy(true);
    try {
      await api.post(`/stock-counts/${count._id}/submit`);
      toast(t('stockCounts.stocktakeSubmitted'), 'success');
      onChanged();
      onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function removeItem(item) {
    if (!window.confirm(t('stockCounts.confirmRemoveItem', { name: item.productId?.name || t('stockCounts.thisItem') }))) return;
    setBusy(true);
    try {
      await api.del(`/stock-counts/${count._id}/items/${item._id}`);
      toast(t('stockCounts.itemRemoved'), 'success');
      onChanged();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function deleteCount() {
    if (!window.confirm(t('stockCounts.confirmDelete', { countNumber: count.countNumber }))) return;
    setBusy(true);
    try {
      await api.del(`/stock-counts/${count._id}`);
      toast(t('stockCounts.stocktakeDeleted'), 'success');
      onChanged();
      onClose();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <div className="w-full lg:w-96 shrink-0 card p-5 h-fit">
      <div className="flex items-center justify-between mb-1">
        <p className="font-display text-lg font-semibold num text-ink">{count.countNumber}</p>
        <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>{t('stockCounts.close')}</button>
      </div>
      <p className="eyebrow mb-3">{t('stockCounts.varianceCount')}</p>

      <div className="space-y-1 max-h-80 overflow-y-auto mb-4 -mx-2">
        {count.items.map((item) => (
          <div key={item._id} className="flex items-center justify-between text-sm gap-2 px-2 py-2 rounded-lg hover:bg-surface-sunken">
            <span className="truncate">
              <span className="text-ink">{item.productId?.name || t('stockCounts.product')}</span>
              <span className="text-ink-muted num block text-xs">{t('stockCounts.systemQty', { qty: formatQty(item.systemQuantity) })}</span>
            </span>
            <input
              type="number" className="field-input num w-24" placeholder={t('stockCounts.counted')}
              value={counted[item._id]} onChange={(e) => setCounted({ ...counted, [item._id]: e.target.value })}
              disabled={count.status !== 'in_progress'}
            />
            {count.status === 'in_progress' && (
              <button
                className="text-ink-muted hover:text-danger shrink-0"
                title={t('stockCounts.removeItemFromStocktake')}
                disabled={busy}
                onClick={() => removeItem(item)}
              >
                <span className="font-icon text-[16px] leading-none">close</span>
              </button>
            )}
          </div>
        ))}
      </div>

      {count.status === 'in_progress' && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" disabled={busy} onClick={saveCounts}>{t('stockCounts.saveCounts')}</button>
            <button className="btn-primary flex-1" disabled={busy} onClick={submit}>{t('stockCounts.submit')}</button>
          </div>
          <button className="text-sm text-danger hover:underline self-start" disabled={busy} onClick={deleteCount}>
            {t('stockCounts.deleteThisStocktake')}
          </button>
        </div>
      )}
    </div>
  );
}
