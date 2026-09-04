import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

const STATUS_CHIP = { open: 'chip-accent', closed: 'chip-neutral' };

export function RfqPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);

  function load() {
    setLoading(true);
    api.get('/rfqs').then(setRfqs).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      {loading && <Loading />}
      {!loading && rfqs.length === 0 && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="page-title">{t('rfq.title')}</p>
              <p className="text-sm text-ink-muted mt-1">{t('rfq.subtitle')}</p>
            </div>
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              <span className="material-symbols-outlined text-[18px]">add</span>
              {t('rfq.newRfq')}
            </button>
          </div>
          <EmptyState title={t('rfq.noRfqsYet')} description={t('rfq.emptyStateDescription')} action={<button className="btn-primary" onClick={() => setShowForm(true)}>{t('rfq.createAnRfq')}</button>} />
        </>
      )}
      {!loading && rfqs.length > 0 && (
        <div className="card overflow-hidden flex flex-col min-h-[70vh]">
          <div className="p-6 border-b border-rule flex justify-between items-center bg-surface">
            <div>
              <p className="page-title">{t('rfq.activeOpportunities')}</p>
              <p className="text-sm text-ink-muted mt-1">{t('rfq.manageDescription')}</p>
            </div>
            <button className="btn-primary" onClick={() => setShowForm(true)}>
              <span className="material-symbols-outlined text-[18px]">add</span>
              {t('rfq.newRfq')}
            </button>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-sunken border-b border-rule">
                  <th className="py-3 px-6 eyebrow">{t('rfq.items')}</th>
                  <th className="py-3 px-6 eyebrow">{t('rfq.status')}</th>
                  <th className="py-3 px-6 eyebrow">{t('rfq.created')}</th>
                  <th className="py-3 px-6"></th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {rfqs.map((r) => (
                  <tr key={r._id} className="border-b border-rule last:border-0 hover:bg-accent-soft/30 transition-colors cursor-pointer group" onClick={() => setSelected(r)}>
                    <td className="py-3 px-6 num text-ink">{t('rfq.itemCount', { count: r.items.length })}</td>
                    <td className="py-3 px-6"><span className={STATUS_CHIP[r.status]}>{r.status}</span></td>
                    <td className="py-3 px-6 text-ink-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-6 text-right">
                      <button className="btn-ghost !text-accent opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); setSelected(r); }}>{t('rfq.open')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && <RfqForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {selected && <RfqDetail rfq={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}

function RfqForm({ onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [lines, setLines] = useState([{ productId: '', variantId: '', quantity: 1 }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/org/branches').then(setBranches).catch(() => {});
    api.get('/products').then(setProducts).catch(() => {});
  }, []);

  function updateLine(i, patch) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }
  function pickProduct(i, productId) {
    const product = products.find((p) => p._id === productId);
    updateLine(i, { productId, variantId: product?.variants?.[0]?._id || '' });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/rfqs', {
        branchId,
        items: lines.filter((l) => l.productId).map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: Number(l.quantity) })),
      });
      toast(t('rfq.rfqCreated'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <p className="font-display text-lg font-bold text-ink mb-4">{t('rfq.newRfq')}</p>
        <select required className="field-input mb-3" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">{t('rfq.branch')}</option>
          {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>

        <p className="field-label mb-1">{t('rfq.itemsRequested')}</p>
        <div className="space-y-2 mb-2">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <select className="field-input col-span-2" value={line.productId} onChange={(e) => pickProduct(i, e.target.value)}>
                <option value="">{t('rfq.product')}</option>
                {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              <input type="number" min="1" className="field-input num" value={line.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} placeholder={t('rfq.qty')} />
            </div>
          ))}
        </div>
        <button type="button" className="btn-ghost !px-0 text-xs mb-4" onClick={() => setLines([...lines, { productId: '', variantId: '', quantity: 1 }])}>
          {t('rfq.addLine')}
        </button>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('rfq.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('rfq.creating') : t('rfq.createRfq')}</button>
        </div>
      </form>
    </div>
  );
}

function RfqDetail({ rfq, onClose, onChanged }) {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [quotations, setQuotations] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [converting, setConverting] = useState(false);

  function load() {
    api.get(`/rfqs/${rfq._id}/quotations`).then(setQuotations).catch(() => {});
    api.get(`/rfqs/${rfq._id}/compare`).then(setComparison).catch(() => {});
  }
  useEffect(load, [rfq._id]);

  async function convertToOrders() {
    setConverting(true);
    try {
      // The RFQ's own branchId already determines which branch — a second
      // warehouse prompt only picks which real warehouse within it receives
      // the resulting orders.
      const warehouses = await api.get(`/org/warehouses?branchId=${rfq.branchId}`);
      if (!warehouses.length) throw new Error(t('rfq.noWarehouseError'));
      const orders = await api.post(`/rfqs/${rfq._id}/convert-to-orders`, { branchId: rfq.branchId, warehouseId: warehouses[0]._id });
      toast(t('rfq.ordersCreated', { count: orders.length }), 'success');
      onChanged();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setConverting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <div className="card p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="eyebrow mb-1">{t('rfq.eyebrow')}</p>
            <p className="font-display text-lg font-bold text-ink">{t('rfq.itemsRequestedCount', { count: rfq.items.length })}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={STATUS_CHIP[rfq.status]}>{rfq.status}</span>
            <button className="btn-ghost" onClick={onClose}>{t('rfq.close')}</button>
          </div>
        </div>

        {rfq.status === 'open' && (
          <button className="btn-secondary text-xs mb-4" onClick={() => setShowQuoteForm(true)}>{t('rfq.submitSupplierQuotation')}</button>
        )}

        <p className="field-label mb-2">{t('rfq.quotationsReceived', { count: quotations.length })}</p>
        {quotations.length === 0 && <p className="text-sm text-ink-muted mb-4">{t('rfq.noQuotationsYet')}</p>}
        {quotations.length > 0 && (
          <div className="card overflow-hidden mb-5">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-surface-sunken border-b border-rule">
                  <th className="px-4 py-2.5 eyebrow">{t('rfq.supplier')}</th>
                  <th className="px-4 py-2.5 eyebrow text-right">{t('rfq.total')}</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((q) => (
                  <tr key={q._id} className="border-b border-rule last:border-0">
                    <td className="px-4 py-2.5">{q.supplierId?.name || '-'}</td>
                    <td className="px-4 py-2.5 num text-right">{formatMoney(q.totalAmount, company?.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {comparison?.bestByItem?.length > 0 && (
          <>
            <p className="field-label mb-2">{t('rfq.bestPricePerItem')}</p>
            <div className="card overflow-hidden mb-5">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-surface-sunken border-b border-rule">
                    <th className="px-4 py-2.5 eyebrow">{t('rfq.winningSupplier')}</th>
                    <th className="px-4 py-2.5 eyebrow text-right">{t('rfq.unitPrice')}</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.bestByItem.map((b, i) => (
                    <tr key={i} className="border-b border-rule last:border-0">
                      <td className="px-4 py-2.5">{b.supplierId?.name || '-'}</td>
                      <td className="px-4 py-2.5 num text-right">{formatMoney(b.unitPrice, company?.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rfq.status === 'open' && (
              <button className="btn-primary" onClick={convertToOrders} disabled={converting}>
                {converting ? t('rfq.converting') : t('rfq.convertToPurchaseOrders')}
              </button>
            )}
          </>
        )}

        {showQuoteForm && <QuoteForm rfq={rfq} onClose={() => setShowQuoteForm(false)} onSaved={() => { setShowQuoteForm(false); load(); }} />}
      </div>
    </div>
  );
}

function QuoteForm({ rfq, onClose, onSaved }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [prices, setPrices] = useState(rfq.items.map(() => ''));
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/suppliers').then(setSuppliers).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/rfqs/${rfq._id}/quotations`, {
        supplierId,
        items: rfq.items.map((item, i) => ({ productId: item.productId, variantId: item.variantId, unitPrice: Number(prices[i]) })),
      });
      toast(t('rfq.quotationSubmitted'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/30 flex items-center justify-center z-50 px-4">
      <form onSubmit={handleSubmit} className="card p-6 w-full max-w-sm">
        <p className="font-display text-lg font-bold text-ink mb-4">{t('rfq.submitAQuotation')}</p>
        <select required className="field-input mb-3" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          <option value="">{t('rfq.supplier')}</option>
          {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
        </select>
        <p className="field-label mb-1">{t('rfq.unitPricePerItem')}</p>
        <div className="space-y-2">
          {rfq.items.map((item, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 items-center">
              <span className="text-sm text-ink-muted">{t('rfq.itemN', { index: i + 1, qty: item.quantity })}</span>
              <input required type="number" step="0.01" min="0.01" className="field-input num" value={prices[i]} onChange={(e) => setPrices((p) => p.map((v, idx) => idx === i ? e.target.value : v))} placeholder={t('rfq.unitPrice')} />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('rfq.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? t('rfq.submitting') : t('rfq.submitQuotation')}</button>
        </div>
      </form>
    </div>
  );
}
