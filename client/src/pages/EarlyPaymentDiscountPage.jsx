import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

export function EarlyPaymentDiscountPage() {
  const { t } = useTranslation();
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
        <p className="page-title">{t('earlyPaymentDiscount.title')}</p>
        <p className="text-sm text-ink-muted mt-1 max-w-lg">{t('earlyPaymentDiscount.subtitle')}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0">
          {orders.length === 0 && <EmptyState title={t('earlyPaymentDiscount.emptyTitle')} description={t('earlyPaymentDiscount.emptyDescription')} />}
          {orders.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-rule flex justify-between items-center bg-surface-sunken/40">
                <p className="font-display text-lg font-semibold text-ink">{t('earlyPaymentDiscount.outstandingPOs')}</p>
                <span className="eyebrow">{t('earlyPaymentDiscount.ordersCount', { count: orders.length })}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[560px]">
                  <thead>
                    <tr className="border-b border-rule bg-surface-sunken/60">
                      <th className="py-3 px-5 eyebrow font-medium">{t('earlyPaymentDiscount.poNumber')}</th>
                      <th className="py-3 px-5 eyebrow font-medium">{t('earlyPaymentDiscount.ordered')}</th>
                      <th className="py-3 px-5 eyebrow font-medium text-right">{t('earlyPaymentDiscount.due')}</th>
                      <th className="py-3 px-5 eyebrow font-medium">{t('earlyPaymentDiscount.terms')}</th>
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
                            ? <span className="chip-accent">{t('earlyPaymentDiscount.percentSlashDays', { percent: po.earlyPaymentDiscountPercent, days: po.earlyPaymentDiscountDays })}</span>
                            : <span className="chip-neutral">{t('earlyPaymentDiscount.noTerms')}</span>}
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
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const hasTerms = po.earlyPaymentDiscountPercent > 0;
  const [editing, setEditing] = useState(!hasTerms);
  const [terms, setTerms] = useState({
    paymentTermsDays: po.paymentTermsDays || 30,
    earlyPaymentDiscountPercent: hasTerms ? po.earlyPaymentDiscountPercent : 2,
    earlyPaymentDiscountDays: hasTerms ? po.earlyPaymentDiscountDays : 10,
  });
  const [check, setCheck] = useState(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function saveTerms(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/purchase-orders/early-payment/${po._id}/terms`, terms);
      toast(t('earlyPaymentDiscount.termsSaved'), 'success');
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function removeTerms() {
    if (!window.confirm(t('earlyPaymentDiscount.confirmRemove'))) return;
    setRemoving(true);
    try {
      await api.post(`/purchase-orders/early-payment/${po._id}/terms`, {
        paymentTermsDays: po.paymentTermsDays || 30,
        earlyPaymentDiscountPercent: 0,
        earlyPaymentDiscountDays: 0,
      });
      toast(t('earlyPaymentDiscount.termsRemoved'), 'success');
      onChanged();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setRemoving(false);
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
            <p className="eyebrow mb-1">{t('earlyPaymentDiscount.purchaseOrder')}</p>
            <p className="font-display text-lg font-bold text-ink num">{po.poNumber}</p>
          </div>
          <button className="btn-ghost text-xs" onClick={onClose}>{t('earlyPaymentDiscount.close')}</button>
        </div>

        {editing && (
          <form onSubmit={saveTerms} className="space-y-3">
            {!hasTerms && <p className="text-sm text-ink-muted">{t('earlyPaymentDiscount.noTermsYet')}</p>}
            <div>
              <label className="field-label">{t('earlyPaymentDiscount.discountPercent')}</label>
              <input type="number" step="0.1" min="0" max="100" className="field-input num" value={terms.earlyPaymentDiscountPercent} onChange={(e) => setTerms({ ...terms, earlyPaymentDiscountPercent: Number(e.target.value) })} />
            </div>
            <div>
              <label className="field-label">{t('earlyPaymentDiscount.withinDays')}</label>
              <input type="number" min="0" className="field-input num" value={terms.earlyPaymentDiscountDays} onChange={(e) => setTerms({ ...terms, earlyPaymentDiscountDays: Number(e.target.value) })} />
            </div>
            <div className="flex gap-2">
              {hasTerms && <button type="button" className="btn-secondary flex-1" onClick={() => setEditing(false)}>{t('earlyPaymentDiscount.cancel')}</button>}
              <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? t('earlyPaymentDiscount.saving') : hasTerms ? t('earlyPaymentDiscount.saveChanges') : t('earlyPaymentDiscount.setTerms')}</button>
            </div>
          </form>
        )}

        {!editing && hasTerms && (
          <div>
            <p className="text-sm text-ink mb-3">{t('earlyPaymentDiscount.offIfPaidWithin', { percent: po.earlyPaymentDiscountPercent, days: po.earlyPaymentDiscountDays })}</p>
            <div className="flex gap-2 mb-4">
              <button type="button" className="btn-secondary flex-1 text-xs" onClick={() => setEditing(true)}>{t('earlyPaymentDiscount.editTerms')}</button>
              <button type="button" disabled={removing} className="btn-danger flex-1 text-xs" onClick={removeTerms}>{removing ? t('earlyPaymentDiscount.removing') : t('earlyPaymentDiscount.removeTerms')}</button>
            </div>
            {check && (check.eligible ? (
              <>
                <div className="chip-accent mb-4">{t('earlyPaymentDiscount.eligibleToday', { amount: formatMoney(check.discountAmount, company?.currency) })}</div>
                <PayForm po={po} onPaid={onChanged} />
              </>
            ) : (
              <p className="text-sm text-danger">{check.reason}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PayForm({ po, onPaid }) {
  const { t } = useTranslation();
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
      toast(t('earlyPaymentDiscount.paidWithDiscount', { amount: result.amountPaid, discount: result.discountAmount }), 'success');
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
        <option value="">{t('earlyPaymentDiscount.payFrom')}</option>
        {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
      </select>
      <select required className="field-input" value={payableAccountId} onChange={(e) => setPayableAccountId(e.target.value)}>
        <option value="">{t('earlyPaymentDiscount.payableAccount')}</option>
        {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
      </select>
      <select required className="field-input" value={discountIncomeAccountId} onChange={(e) => setDiscountIncomeAccountId(e.target.value)}>
        <option value="">{t('earlyPaymentDiscount.discountIncomeAccount')}</option>
        {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
      </select>
      <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? t('earlyPaymentDiscount.paying') : t('earlyPaymentDiscount.payWithDiscount')}</button>
    </form>
  );
}
