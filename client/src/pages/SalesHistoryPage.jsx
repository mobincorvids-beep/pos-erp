import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
            <p className="page-title mb-1">{t('salesHistory.title')}</p>
            <p className="text-sm text-ink-muted">{t('salesHistory.subtitle')}</p>
          </div>
        </div>

        {loading && <Loading />}
        {!loading && sales.length === 0 && <EmptyState title={t('salesHistory.emptyTitle')} description={t('salesHistory.emptyDescription')} />}

        {!loading && sales.length > 0 && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-sunken/60 border-y border-rule">
                    <th className="py-3 px-4 eyebrow font-semibold">{t('salesHistory.colInvoice')}</th>
                    <th className="py-3 px-4 eyebrow font-semibold">{t('salesHistory.colCustomer')}</th>
                    <th className="py-3 px-4 eyebrow font-semibold">{t('salesHistory.colDate')}</th>
                    <th className="py-3 px-4 eyebrow font-semibold">{t('salesHistory.colStatus')}</th>
                    <th className="py-3 px-4 eyebrow font-semibold text-right">{t('salesHistory.colTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => {
                    const name = sale.customerId?.name || t('salesHistory.walkIn');
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
              <span className="text-xs text-ink-muted">{t('salesHistory.showing', { count: sales.length })}</span>
            </div>
          </div>
        )}
      </div>

      {selected && <SaleDetailPanel sale={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </div>
  );
}

function SaleDetailPanel({ sale, onClose, onChanged }) {
  const { t } = useTranslation();
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
      toast(t('salesHistory.saleVoided'), 'success');
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
      toast(t('salesHistory.returnProcessed'), 'success');
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
      toast(t('salesHistory.creditNoteIssued'), 'success');
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
        <button className="text-ink-muted hover:text-ink text-sm" onClick={onClose}>{t('common.close')}</button>
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
          <p className="text-xs text-ink-muted">{t('salesHistory.howManyReturn')}</p>
          {sale.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="truncate flex-1">{formatMoney(item.unitPrice, company?.currency)} {t('salesHistory.each')}</span>
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
        <span>{mode === 'return' ? t('salesHistory.returnTotal') : t('salesHistory.total')}</span>
        <span className="num">{formatMoney(mode === 'return' ? returnTotal : sale.totalAmount, company?.currency)}</span>
      </div>

      {sale.status === 'completed' && mode === 'view' && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setMode('return')}>{t('salesHistory.returnItems')}</button>
            <button className="btn-danger flex-1" onClick={() => setMode('void')}>{t('salesHistory.voidSale')}</button>
          </div>
          <button className="btn-secondary" onClick={() => { setCreditAmount(String(sale.totalAmount)); setMode('credit_note'); }}>{t('salesHistory.issueCreditNote')}</button>
        </div>
      )}

      {mode === 'credit_note' && (
        <div>
          <p className="text-xs text-ink-muted mb-2">{t('salesHistory.creditNoteHint')}</p>
          <label className="field-label">{t('salesHistory.fieldAmount')}</label>
          <input
            type="number" min="0" max={sale.totalAmount} step="0.01"
            className="field-input num mb-2" value={creditAmount}
            onChange={(e) => setCreditAmount(e.target.value)}
          />
          <label className="field-label">{t('salesHistory.fieldReason')}</label>
          <input className="field-input mb-2" value={creditReason} onChange={(e) => setCreditReason(e.target.value)} placeholder={t('salesHistory.reasonPlaceholderCredit')} />
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setMode('view')}>{t('common.back')}</button>
            <button
              className="btn-primary flex-1"
              disabled={busy || !creditAmount || Number(creditAmount) <= 0 || Number(creditAmount) > sale.totalAmount}
              onClick={handleIssueCreditNote}
            >
              {busy ? t('salesHistory.issuing') : t('salesHistory.issueCreditNote')}
            </button>
          </div>
        </div>
      )}

      {sale.status === 'completed' && mode === 'return' && (
        <div>
          <label className="field-label">{t('salesHistory.refundFrom')}</label>
          <select className="field-input mb-2" value={refundAccountId} onChange={(e) => setRefundAccountId(e.target.value)}>
            <option value="">{t('salesHistory.selectAccount')}</option>
            {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
          <label className="field-label">{t('salesHistory.fieldReason')}</label>
          <input className="field-input mb-2" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('salesHistory.reasonPlaceholderReturn')} />
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setMode('view')}>{t('common.back')}</button>
            <button className="btn-primary flex-1" disabled={busy || returnItems.length === 0 || !refundAccountId} onClick={handleReturn}>
              {busy ? t('salesHistory.processing') : t('salesHistory.processReturn')}
            </button>
          </div>
        </div>
      )}

      {sale.status === 'completed' && mode === 'void' && (
        <div>
          <label className="field-label">{t('salesHistory.voidReason')}</label>
          <input className="field-input mb-2" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('salesHistory.voidReasonPlaceholder')} />
          <p className="text-xs text-ink-muted mb-2">{t('salesHistory.voidHint')}</p>
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setMode('view')}>{t('common.back')}</button>
            <button className="btn-danger flex-1" disabled={busy} onClick={handleVoid}>
              {busy ? t('salesHistory.voiding') : t('salesHistory.confirmVoid')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
