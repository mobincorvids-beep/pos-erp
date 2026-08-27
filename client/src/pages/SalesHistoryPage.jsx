import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDateTime } from '../lib/format';

const STATUS_CHIP = { completed: 'chip-accent', returned: 'chip-warning', cancelled: 'chip-danger' };

const AVATAR_PALETTE = [
  'bg-accent-soft text-accent-strong border-accent-soft',
  'bg-info-soft text-info border-info-soft',
  'bg-warning-soft text-warning border-warning-soft',
  'bg-danger-soft text-danger border-danger-soft',
];

function avatarInitials(name) {
  if (!name) return 'WI';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || parts[0]?.[1] || '')).toUpperCase();
}

function avatarClass(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = (hash * 31 + name.charCodeAt(i)) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[hash];
}

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
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <p className="page-title mb-1">Sales history</p>
            <p className="text-sm text-ink-muted">Most recent 100 invoices. Click one to view or take an action.</p>
          </div>
        </div>

        {loading && <Loading />}
        {!loading && sales.length === 0 && <EmptyState title="No sales yet" description="Completed checkouts will show up here." />}

        {!loading && sales.length > 0 && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-sunken/60 border-y border-rule">
                    <th className="py-3 px-4 eyebrow font-semibold">Invoice</th>
                    <th className="py-3 px-4 eyebrow font-semibold">Customer</th>
                    <th className="py-3 px-4 eyebrow font-semibold">Date</th>
                    <th className="py-3 px-4 eyebrow font-semibold">Status</th>
                    <th className="py-3 px-4 eyebrow font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => {
                    const name = sale.customerId?.name || 'Walk-in';
                    return (
                      <tr
                        key={sale._id}
                        onClick={() => setSelected(sale)}
                        className={`border-b border-rule last:border-0 cursor-pointer transition-colors hover:bg-surface-sunken/50 ${selected?._id === sale._id ? 'bg-accent-soft/40' : ''}`}
                      >
                        <td className="py-3.5 px-4 num font-medium text-accent">{sale.invoiceNumber || sale.documentNumber}</td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <span className={`w-8 h-8 shrink-0 rounded-full border flex items-center justify-center text-xs font-semibold ${avatarClass(name)}`}>
                              {avatarInitials(name)}
                            </span>
                            <span className="font-medium text-ink">{name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-ink-muted">{formatDateTime(sale.createdAt)}</td>
                        <td className="py-3.5 px-4"><span className={STATUS_CHIP[sale.status] || 'chip-neutral'}>{sale.status}</span></td>
                        <td className="py-3.5 px-4 num font-medium text-right">{formatMoney(sale.totalAmount, company?.currency)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-rule flex items-center justify-between bg-surface">
              <span className="text-xs text-ink-muted">Showing {sales.length} {sales.length === 1 ? 'entry' : 'entries'}</span>
            </div>
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
  const [mode, setMode] = useState('view'); // view | return | void | credit_note
  const [reason, setReason] = useState('');
  const [refundAccountId, setRefundAccountId] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [returnQty, setReturnQty] = useState(() => sale.items.map(() => 0));
  const [busy, setBusy] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');

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

  async function handleIssueCreditNote() {
    const amount = Number(creditAmount);
    if (!amount || amount <= 0) return;
    setBusy(true);
    try {
      await api.post('/credit-notes', {
        customerId: sale.customerId?._id || sale.customerId,
        saleId: sale._id, amount, reason: creditReason,
      });
      toast('Credit note issued.', 'success');
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
        <p className="font-display font-bold text-lg num text-accent">{sale.invoiceNumber || sale.documentNumber}</p>
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
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setMode('return')}>Return items</button>
            <button className="btn-danger flex-1" onClick={() => setMode('void')}>Void sale</button>
          </div>
          <button className="btn-secondary" onClick={() => { setCreditAmount(String(sale.totalAmount)); setMode('credit_note'); }}>Issue credit note</button>
        </div>
      )}

      {mode === 'credit_note' && (
        <div>
          <p className="text-xs text-ink-muted mb-2">Issue a credit note against this invoice — reduces what the customer owes without moving any stock (e.g. a pricing correction or goodwill credit).</p>
          <label className="field-label">Amount</label>
          <input
            type="number" min="0" max={sale.totalAmount} step="0.01"
            className="field-input num mb-2" value={creditAmount}
            onChange={(e) => setCreditAmount(e.target.value)}
          />
          <label className="field-label">Reason</label>
          <input className="field-input mb-2" value={creditReason} onChange={(e) => setCreditReason(e.target.value)} placeholder="e.g. pricing correction, goodwill credit" />
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setMode('view')}>Back</button>
            <button
              className="btn-primary flex-1"
              disabled={busy || !creditAmount || Number(creditAmount) <= 0 || Number(creditAmount) > sale.totalAmount}
              onClick={handleIssueCreditNote}
            >
              {busy ? 'Issuing…' : 'Issue credit note'}
            </button>
          </div>
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
