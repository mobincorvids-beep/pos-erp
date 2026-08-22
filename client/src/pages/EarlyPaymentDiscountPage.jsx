import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

export function EarlyPaymentDiscountPage() {
  const { company } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState(null);
  const [selected, setSelected] = useState(null);

  function load() {
    api.get('/purchase-orders').then((all) => setOrders(all.filter((po) => po.dueAmount > 0))).catch((err) => toast(err.message, 'error'));
  }
  useEffect(load, []);

  if (!orders) return <Loading />;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <p className="page-title mb-1">Early payment discount</p>
        <p className="text-sm text-ink-muted mb-4 max-w-lg">Set a real "2/10 net 30"-style term on any purchase order with a balance due, then pay early to take the discount — no third-party financier, just your own cash paid ahead of schedule.</p>

        {orders.length === 0 && <EmptyState title="No outstanding purchase orders" description="Every purchase order is either fully paid or has no balance due." />}
        {orders.length > 0 && (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                  <th className="px-3 py-2 font-medium">PO #</th>
                  <th className="px-3 py-2 font-medium">Ordered</th>
                  <th className="px-3 py-2 font-medium text-right">Due</th>
                  <th className="px-3 py-2 font-medium">Terms</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((po) => (
                  <tr key={po._id} onClick={() => setSelected(po)} className={`border-b border-rule last:border-0 cursor-pointer hover:bg-paper ${selected?._id === po._id ? 'bg-accent-soft/40' : ''}`}>
                    <td className="px-3 py-2 num">{po.poNumber}</td>
                    <td className="px-3 py-2 text-ink-muted">{formatDate(po.createdAt)}</td>
                    <td className="px-3 py-2 num text-right">{formatMoney(po.dueAmount, company?.currency)}</td>
                    <td className="px-3 py-2 text-ink-muted">{po.earlyPaymentDiscountPercent > 0 ? `${po.earlyPaymentDiscountPercent}% / ${po.earlyPaymentDiscountDays}d` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <PoDiscountPanel po={selected} onChanged={() => { load(); setSelected(null); }} onClose={() => setSelected(null)} />}
    </div>
  );
}

function PoDiscountPanel({ po, onChanged, onClose }) {
  const { company } = useAuth();
  const toast = useToast();
  const hasTerms = po.earlyPaymentDiscountPercent > 0;
  const [terms, setTerms] = useState({ paymentTermsDays: 30, earlyPaymentDiscountPercent: 2, earlyPaymentDiscountDays: 10 });
  const [check, setCheck] = useState(null);
  const [saving, setSaving] = useState(false);

  async function saveTerms(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/purchase-orders/early-payment/${po._id}/terms`, terms);
      toast('Discount terms set.', 'success');
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function checkEligibility() {
    try {
      const result = await api.get(`/purchase-orders/early-payment/${po._id}/calculate`);
      setCheck(result);
    } catch (err) {
      toast(err.message, 'error');
    }
  }
  useEffect(() => { if (hasTerms) checkEligibility(); }, [po._id]);

  return (
    <div className="w-full lg:w-96 shrink-0">
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-display text-lg">{po.poNumber}</p>
          <button className="btn-ghost text-xs" onClick={onClose}>Close</button>
        </div>

        {!hasTerms && (
          <form onSubmit={saveTerms} className="space-y-3">
            <p className="text-sm text-ink-muted">No discount terms set yet.</p>
            <div>
              <label className="field-label">Discount %</label>
              <input type="number" step="0.1" min="0" max="100" className="field-input num" value={terms.earlyPaymentDiscountPercent} onChange={(e) => setTerms({ ...terms, earlyPaymentDiscountPercent: Number(e.target.value) })} />
            </div>
            <div>
              <label className="field-label">Within how many days</label>
              <input type="number" min="0" className="field-input num" value={terms.earlyPaymentDiscountDays} onChange={(e) => setTerms({ ...terms, earlyPaymentDiscountDays: Number(e.target.value) })} />
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'Saving…' : 'Set terms'}</button>
          </form>
        )}

        {hasTerms && check && (
          <div>
            <p className="text-sm mb-2">{po.earlyPaymentDiscountPercent}% off if paid within {po.earlyPaymentDiscountDays} days.</p>
            {check.eligible ? (
              <>
                <p className="text-sm text-accent-strong font-medium mb-3">Eligible today — {formatMoney(check.discountAmount, company?.currency)} discount.</p>
                <PayForm po={po} onPaid={onChanged} />
              </>
            ) : (
              <p className="text-sm text-danger">{check.reason}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PayForm({ po, onPaid }) {
  const toast = useToast();
  const [accounts, setAccounts] = useState([]);
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [discountIncomeAccountId, setDiscountIncomeAccountId] = useState('');
  const [payableAccountId, setPayableAccountId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/accounts').then(setAccounts).catch(() => {}); }, []);

  async function pay(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await api.post(`/purchase-orders/early-payment/${po._id}/pay`, { paymentAccountId, discountIncomeAccountId, payableAccountId });
      toast(`Paid ${result.amountPaid} with a ${result.discountAmount} discount applied.`, 'success');
      onPaid();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={pay} className="space-y-2">
      <select required className="field-input !text-xs" value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}>
        <option value="">Pay from…</option>
        {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
      </select>
      <select required className="field-input !text-xs" value={payableAccountId} onChange={(e) => setPayableAccountId(e.target.value)}>
        <option value="">Payable account…</option>
        {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
      </select>
      <select required className="field-input !text-xs" value={discountIncomeAccountId} onChange={(e) => setDiscountIncomeAccountId(e.target.value)}>
        <option value="">Discount income account…</option>
        {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
      </select>
      <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'Paying…' : 'Pay with discount'}</button>
    </form>
  );
}
