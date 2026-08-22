import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

const STATUS_CHIP = { open: 'chip-accent', closed: 'chip-neutral' };

export function RfqPage() {
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
      <div className="flex items-center justify-between mb-4">
        <p className="page-title">RFQs</p>
        <button className="btn-primary" onClick={() => setShowForm(true)}>New RFQ</button>
      </div>

      {loading && <Loading />}
      {!loading && rfqs.length === 0 && (
        <EmptyState title="No RFQs yet" description="Send the same item list to several suppliers and let the system find the cheapest price per item, not just an overall winner." action={<button className="btn-primary" onClick={() => setShowForm(true)}>Create an RFQ</button>} />
      )}
      {!loading && rfqs.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-3 py-2 font-medium">Items</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rfqs.map((r) => (
                <tr key={r._id} className="border-b border-rule last:border-0">
                  <td className="px-3 py-2">{r.items.length} item{r.items.length !== 1 ? 's' : ''}</td>
                  <td className="px-3 py-2"><span className={STATUS_CHIP[r.status]}>{r.status}</span></td>
                  <td className="px-3 py-2 text-ink-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-right">
                    <button className="btn-ghost !text-accent" onClick={() => setSelected(r)}>Open</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <RfqForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
      {selected && <RfqDetail rfq={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}

function RfqForm({ onClose, onSaved }) {
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
      toast('RFQ created.', 'success');
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
        <p className="font-display text-lg mb-4">New RFQ</p>
        <select required className="field-input mb-3" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">Branch…</option>
          {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>

        <p className="field-label mb-1">Items requested</p>
        <div className="space-y-2 mb-2">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <select className="field-input col-span-2" value={line.productId} onChange={(e) => pickProduct(i, e.target.value)}>
                <option value="">Product…</option>
                {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
              <input type="number" min="1" className="field-input num" value={line.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} placeholder="Qty" />
            </div>
          ))}
        </div>
        <button type="button" className="btn-ghost !px-0 text-xs mb-4" onClick={() => setLines([...lines, { productId: '', variantId: '', quantity: 1 }])}>
          + Add line
        </button>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating…' : 'Create RFQ'}</button>
        </div>
      </form>
    </div>
  );
}

function RfqDetail({ rfq, onClose, onChanged }) {
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
      if (!warehouses.length) throw new Error('This branch has no warehouse to receive into.');
      const orders = await api.post(`/rfqs/${rfq._id}/convert-to-orders`, { branchId: rfq.branchId, warehouseId: warehouses[0]._id });
      toast(`Created ${orders.length} purchase order${orders.length !== 1 ? 's' : ''}, split by winning supplier.`, 'success');
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
      <div className="card p-5 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="font-display text-lg">RFQ — {rfq.items.length} item{rfq.items.length !== 1 ? 's' : ''}</p>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>

        {rfq.status === 'open' && (
          <button className="btn-secondary text-xs mb-4" onClick={() => setShowQuoteForm(true)}>+ Submit a supplier quotation</button>
        )}

        <p className="field-label mb-2">Quotations received ({quotations.length})</p>
        {quotations.length === 0 && <p className="text-sm text-ink-muted mb-4">No quotations yet.</p>}
        {quotations.length > 0 && (
          <div className="card overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                  <th className="px-3 py-2 font-medium">Supplier</th>
                  <th className="px-3 py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((q) => (
                  <tr key={q._id} className="border-b border-rule last:border-0">
                    <td className="px-3 py-2">{q.supplierId?.name || '—'}</td>
                    <td className="px-3 py-2 num text-right">{formatMoney(q.totalAmount, company?.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {comparison?.bestByItem?.length > 0 && (
          <>
            <p className="field-label mb-2">Best price per item</p>
            <div className="card overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                    <th className="px-3 py-2 font-medium">Winning supplier</th>
                    <th className="px-3 py-2 font-medium text-right">Unit price</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.bestByItem.map((b, i) => (
                    <tr key={i} className="border-b border-rule last:border-0">
                      <td className="px-3 py-2">{b.supplierId?.name || '—'}</td>
                      <td className="px-3 py-2 num text-right">{formatMoney(b.unitPrice, company?.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rfq.status === 'open' && (
              <button className="btn-primary" onClick={convertToOrders} disabled={converting}>
                {converting ? 'Converting…' : 'Convert to purchase orders'}
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
      toast('Quotation submitted.', 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/30 flex items-center justify-center z-50 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-4">Submit a quotation</p>
        <select required className="field-input mb-3" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          <option value="">Supplier…</option>
          {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
        </select>
        <p className="field-label mb-1">Unit price per requested item</p>
        <div className="space-y-2">
          {rfq.items.map((item, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 items-center">
              <span className="text-sm text-ink-muted">Item {i + 1} (qty {item.quantity})</span>
              <input required type="number" step="0.01" min="0.01" className="field-input num" value={prices[i]} onChange={(e) => setPrices((p) => p.map((v, idx) => idx === i ? e.target.value : v))} placeholder="Unit price" />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Submitting…' : 'Submit quotation'}</button>
        </div>
      </form>
    </div>
  );
}
