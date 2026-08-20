import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDateTime } from '../lib/format';

const STATUS_CHIP = { completed: 'chip-accent', returned: 'chip-warning', cancelled: 'chip-danger' };

export function SalesHistoryPage() {
  const { company } = useAuth();
  const toast = useToast();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  function load() {
    setLoading(true);
    api.get('/sales?limit=100').then(setSales).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <p className="page-title mb-1">Sales history</p>
        <p className="text-sm text-ink-muted mb-4">Most recent 100 invoices. Click one to view or take an action.</p>

        {loading && <Loading />}
        {!loading && sales.length === 0 && <EmptyState title="No sales yet" description="Completed checkouts will show up here." />}

        {!loading && sales.length > 0 && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                  <th className="px-3 py-2 font-medium">Invoice</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr
                    key={sale._id}
                    onClick={() => setSelected(sale)}
                    className={`border-b border-rule last:border-0 cursor-pointer hover:bg-paper ${selected?._id === sale._id ? 'bg-accent-soft/40' : ''}`}
                  >
                    <td className="px-3 py-2 num">{sale.invoiceNumber || sale.documentNumber}</td>
                    <td className="px-3 py-2">{sale.customerId?.name || 'Walk-in'}</td>
                    <td className="px-3 py-2 text-ink-muted">{formatDateTime(sale.createdAt)}</td>
                    <td className="px-3 py-2"><span className={STATUS_CHIP[sale.status] || 'chip-neutral'}>{sale.status}</span></td>
                    <td className="px-3 py-2 num text-right">{formatMoney(sale.totalAmount, company?.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <SaleDetailPanel sale={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}

function SaleDetailPanel({ sale, onClose, onChanged }) {
  const { company } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState('view'); // view | return | void
  const [reason, setReason] = useState('');
  const [refundAccountId, setRefundAccountId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [returnQty, setReturnQty] = useState(() => sale.items.map(() => 0));
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get('/org/accounts?paymentOnly=true').then(setAccounts).catch(() => {}); }, []);

  async function handleVoid() {
    setBusy(true);
    try {
      await api.post(`/sales/${sale._id}/void`, { reason });
      toast('Sale voided.', 'success');
      onChanged();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const returnItems = sale.items
    .map((item, i) => ({ item, quantity: returnQty[i] }))
    .filter((r) => r.quantity > 0);
  const returnTotal = returnItems.reduce((sum, r) => sum + r.item.unitPrice * r.quantity, 0);

  async function handleReturn() {
    if (returnItems.length === 0 || !refundAccountId) return;
    setBusy(true);
    try {
      await api.post(`/sales/${sale._id}/return`, {
        items: returnItems.map((r) => ({ productId: r.item.productId, variantId: r.item.variantId, batchId: r.item.batchId, quantity: r.quantity })),
        refundAccountId, reason,
      });
      toast('Return processed.', 'success');
      onChanged();
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full lg:w-80 shrink-0 card p-4 h-fit">
      <div className="flex items-center justify-between mb-3">
        <p className="font-display text-lg num">{sale.invoiceNumber || sale.documentNumber}</p>
        <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>Close</button>
      </div>

      {mode === 'view' && (
        <div className="space-y-1 text-sm mb-3">
          {sale.items.map((item, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-ink-muted">{formatMoney(item.unitPrice, company?.currency)} × {item.quantity}</span>
              <span className="num">{formatMoney(item.lineTotal, company?.currency)}</span>
            </div>
          ))}
        </div>
      )}

      {mode === 'return' && (
        <div className="space-y-2 text-sm mb-3">
          <p className="text-xs text-ink-muted">How many of each item is being returned?</p>
          {sale.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="truncate flex-1">{formatMoney(item.unitPrice, company?.currency)} each</span>
              <input
                type="number" min="0" max={item.quantity}
                className="field-input num w-16 !py-1"
                value={returnQty[i]}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(item.quantity, Number(e.target.value) || 0));
                  setReturnQty((prev) => prev.map((q, idx) => idx === i ? v : q));
                }}
              />
              <span className="text-ink-muted text-xs">/ {item.quantity}</span>
            </div>
          ))}
        </div>
      )}

      <div className="tear-line my-2" />
      <div className="flex justify-between text-base font-medium mb-4">
        <span>{mode === 'return' ? 'Return total' : 'Total'}</span>
        <span className="num">{formatMoney(mode === 'return' ? returnTotal : sale.totalAmount, company?.currency)}</span>
      </div>

      {sale.status === 'completed' && mode === 'view' && (
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={() => setMode('return')}>Return items</button>
          <button className="btn-danger flex-1" onClick={() => setMode('void')}>Void sale</button>
        </div>
      )}

      {sale.status === 'completed' && mode === 'return' && (
        <div>
          <label className="field-label">Refund from</label>
          <select className="field-input mb-2" value={refundAccountId} onChange={(e) => setRefundAccountId(e.target.value)}>
            <option value="">Select account…</option>
            {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
          <label className="field-label">Reason</label>
          <input className="field-input mb-2" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. damaged, wrong item" />
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setMode('view')}>Back</button>
            <button className="btn-primary flex-1" disabled={busy || returnItems.length === 0 || !refundAccountId} onClick={handleReturn}>
              {busy ? 'Processing…' : 'Process return'}
            </button>
          </div>
        </div>
      )}

      {sale.status === 'completed' && mode === 'void' && (
        <div>
          <label className="field-label">Void reason</label>
          <input className="field-input mb-2" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. entered by mistake" />
          <p className="text-xs text-ink-muted mb-2">Voiding reverses stock and the ledger entirely — use this only when nothing should have been sold at all, not for a partial refund.</p>
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setMode('view')}>Back</button>
            <button className="btn-danger flex-1" disabled={busy} onClick={handleVoid}>
              {busy ? 'Voiding…' : 'Confirm void'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
