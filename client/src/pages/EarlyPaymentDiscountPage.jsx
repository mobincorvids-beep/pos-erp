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
    <div>
      <div className="mb-6">
        <p className="page-title">Early payment discount</p>
        <p className="text-sm text-ink-muted mt-1 max-w-lg">Set a real "2/10 net 30"-style term on any purchase order with a balance due, then pay early to take the discount, no third-party financier, just your own cash paid ahead of schedule.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0">
          {orders.length === 0 && <EmptyState title="No outstanding purchase orders" description="Every purchase order is either fully paid or has no balance due." />}
          {orders.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-rule flex justify-between items-center bg-surface-sunken/40">
                <p className="font-display text-lg font-semibold text-ink">Outstanding Purchase Orders</p>
                <span className="eyebrow">{orders.length} orders</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[560px]">
                  <thead>
                    <tr className="border-b border-rule bg-surface-sunken/60">
                      <th className="py-3 px-5 eyebrow font-medium">PO #</th>
                      <th className="py-3 px-5 eyebrow font-medium">Ordered</th>
                      <th className="py-3 px-5 eyebrow font-medium text-right">Due</th>
                      <th className="py-3 px-5 eyebrow font-medium">Terms</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {orders.map((po) => (
                      <tr key={po._id} onClick={() => setSelected(po)} className={`cursor-pointer hover:bg-accent-soft/30 transition-colors ${selected?._id === po._id ? 'bg-accent-soft/40' : ''}`}>
                        <td className="py-3 px-5 text-sm font-semibold text-ink num">{po.poNumber}</td>
                        <td className="py-3 px-5 text-sm text-ink-muted">{formatDate(po.createdAt)}</td>
                        <td className="py-3 px-5 text-sm text-ink font-semibold text-right num">{formatMoney(po.dueAmount, company?.currency)}</td>
                        <td className="py-3 px-5 text-sm text-ink-muted">
                          {po.earlyPaymentDiscountPercent > 0
                            ? <span className="chip-accent">{po.earlyPaymentDiscountPercent}% / {po.earlyPaymentDiscountDays}d</span>
                            : <span className="chip-neutral">No terms</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {selected && <PoDiscountPanel po={selected} onChanged={() => { load(); setSelected(null); }} onClose={() => setSelected(null)} />}
      </div>
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
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="eyebrow mb-1">Purchase Order</p>
            <p className="font-display text-lg font-bold text-ink num">{po.poNumber}</p>
          </div>
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
            <p className="text-sm text-ink mb-3">{po.earlyPaymentDiscountPercent}% off if paid within {po.earlyPaymentDiscountDays} days.</p>
            {check.eligible ? (
              <>
                <div className="chip-accent mb-4">Eligible today: {formatMoney(check.discountAmount, company?.currency)} discount</div>
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
      <select required className="field-input" value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}>
        <option value="">Pay from…</option>
        {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
      </select>
      <select required className="field-input" value={payableAccountId} onChange={(e) => setPayableAccountId(e.target.value)}>
        <option value="">Payable account…</option>
        {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
      </select>
      <select required className="field-input" value={discountIncomeAccountId} onChange={(e) => setDiscountIncomeAccountId(e.target.value)}>
        <option value="">Discount income account…</option>
        {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
      </select>
      <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'Paying…' : 'Pay with discount'}</button>
    </form>
  );
}
