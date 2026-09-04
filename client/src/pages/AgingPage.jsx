import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

const BUCKET_CHIP = { '0-30': 'chip-neutral', '31-60': 'chip-warning', '61-90': 'chip-danger', '90+': 'chip-danger' };

export function AgingPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('ar');

  return (
    <div>
      <p className="page-title">{t('aging.title')}</p>
      <p className="text-sm text-ink-muted mt-1 mb-5">{t('aging.subtitle')}</p>
      <div className="flex gap-1 border-b border-rule mb-5">
        {[['ar', t('aging.receivablesAr')], ['ap', t('aging.payablesAp')]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 font-semibold ${tab === key ? 'border-accent text-accent' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'ar' ? <ArAgingTab /> : <ApAgingTab />}
    </div>
  );
}

function ArAgingTab() {
  const { t } = useTranslation();
  const { company, can } = useAuth();
  const toast = useToast();
  const [report, setReport] = useState(null);
  const [writingOff, setWritingOff] = useState(null);

  function load() {
    api.get('/reports/ar-aging').then(setReport).catch((err) => toast(err.message, 'error'));
  }
  useEffect(load, []);

  if (!report) return <Loading />;
  if (report.rows.length === 0) return <EmptyState title={t('aging.noOutstandingReceivables')} description={t('aging.arEmptyDescription')} />;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {Object.entries(report.buckets).map(([bucket, amount]) => (
          <div key={bucket} className="card p-4">
            <p className="eyebrow">{bucket} {t('aging.days')}</p>
            <p className={`font-display text-2xl mt-1 num ${bucket === '61-90' || bucket === '90+' ? 'text-danger' : 'text-ink'}`}>{formatMoney(amount, company?.currency)}</p>
          </div>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-rule">
          <p className="font-display text-lg text-ink">{t('aging.agingLedgerDetail')}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-5 py-3 font-semibold">{t('aging.invoice')}</th>
                <th className="px-5 py-3 font-semibold">{t('aging.customer')}</th>
                <th className="px-5 py-3 font-semibold text-right">{t('aging.daysOverdue')}</th>
                <th className="px-5 py-3 font-semibold text-center">{t('aging.bucket')}</th>
                <th className="px-5 py-3 font-semibold text-right">{t('aging.due')}</th>
                <th className="px-5 py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <tr key={r.saleId} className={`border-b border-rule last:border-0 hover:bg-surface-sunken transition-colors ${(r.bucket === '61-90' || r.bucket === '90+') ? 'bg-danger-soft/30' : ''}`}>
                  <td className="px-5 py-3 text-ink-muted num">{r.invoiceNumber}</td>
                  <td className="px-5 py-3 text-ink font-medium">{r.customerName}</td>
                  <td className="px-5 py-3 text-right num text-ink-muted">{r.daysOverdue}</td>
                  <td className="px-5 py-3 text-center"><span className={BUCKET_CHIP[r.bucket]}>{r.bucket}</span></td>
                  <td className={`px-5 py-3 num text-right ${(r.bucket === '61-90' || r.bucket === '90+') ? 'text-danger font-semibold' : 'text-ink'}`}>{formatMoney(r.dueAmount, company?.currency)}</td>
                  <td className="px-5 py-3 text-right">
                    {can('reports.financial') && <button className="btn-ghost !text-danger" onClick={() => setWritingOff(r)}>{t('aging.writeOff')}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {writingOff && <WriteOffForm row={writingOff} onClose={() => setWritingOff(null)} onSaved={() => { setWritingOff(null); load(); }} />}
    </>
  );
}

function WriteOffForm({ row, onClose, onSaved }) {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [accounts, setAccounts] = useState([]);
  const [badDebtExpenseAccountId, setBadDebtExpenseAccountId] = useState('');
  const [receivableAccountId, setReceivableAccountId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get('/org/accounts').then(setAccounts).catch(() => {}); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/reports/write-off/${row.saleId}`, { badDebtExpenseAccountId, receivableAccountId });
      toast(t('aging.receivableWrittenOff'), 'success');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/20 flex items-center justify-center z-40 px-4">
      <form onSubmit={handleSubmit} className="card p-5 w-full max-w-sm">
        <p className="font-display text-lg mb-1">{t('aging.writeOff')} {row.invoiceNumber}</p>
        <p className="text-sm text-ink-muted mb-4">{row.customerName}: {formatMoney(row.dueAmount, company?.currency)}. {t('aging.permanentWarning')}</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">{t('aging.badDebtExpenseAccount')}</label>
            <select required className="field-input" value={badDebtExpenseAccountId} onChange={(e) => setBadDebtExpenseAccountId(e.target.value)}>
              <option value="">{t('aging.selectEllipsis')}</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">{t('aging.receivableAccount')}</label>
            <select required className="field-input" value={receivableAccountId} onChange={(e) => setReceivableAccountId(e.target.value)}>
              <option value="">{t('aging.selectEllipsis')}</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>{t('aging.cancel')}</button>
          <button type="submit" disabled={saving} className="btn-primary !bg-danger">{saving ? t('aging.writingOff') : t('aging.confirmWriteOff')}</button>
        </div>
      </form>
    </div>
  );
}

function ApAgingTab() {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();
  const [report, setReport] = useState(null);

  useEffect(() => {
    api.get('/reports/ap-aging').then(setReport).catch((err) => toast(err.message, 'error'));
  }, []);

  if (!report) return <Loading />;
  if (report.rows.length === 0) return <EmptyState title={t('aging.noOutstandingPayables')} description={t('aging.apEmptyDescription')} />;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {Object.entries(report.buckets).map(([bucket, amount]) => (
          <div key={bucket} className="card p-4">
            <p className="eyebrow">{bucket} {t('aging.days')}</p>
            <p className={`font-display text-2xl mt-1 num ${bucket === '61-90' || bucket === '90+' ? 'text-danger' : 'text-ink'}`}>{formatMoney(amount, company?.currency)}</p>
          </div>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-rule">
          <p className="font-display text-lg text-ink">{t('aging.agingLedgerDetail')}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                <th className="px-5 py-3 font-semibold">{t('aging.po')}</th>
                <th className="px-5 py-3 font-semibold">{t('aging.supplier')}</th>
                <th className="px-5 py-3 font-semibold text-right">{t('aging.daysOverdue')}</th>
                <th className="px-5 py-3 font-semibold text-center">{t('aging.bucket')}</th>
                <th className="px-5 py-3 font-semibold text-right">{t('aging.due')}</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <tr key={r.purchaseOrderId} className={`border-b border-rule last:border-0 hover:bg-surface-sunken transition-colors ${(r.bucket === '61-90' || r.bucket === '90+') ? 'bg-danger-soft/30' : ''}`}>
                  <td className="px-5 py-3 text-ink-muted num">{r.poNumber}</td>
                  <td className="px-5 py-3 text-ink font-medium">{r.supplierName}</td>
                  <td className="px-5 py-3 text-right num text-ink-muted">{r.daysOverdue}</td>
                  <td className="px-5 py-3 text-center"><span className={BUCKET_CHIP[r.bucket]}>{r.bucket}</span></td>
                  <td className={`px-5 py-3 num text-right ${(r.bucket === '61-90' || r.bucket === '90+') ? 'text-danger font-semibold' : 'text-ink'}`}>{formatMoney(r.dueAmount, company?.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
