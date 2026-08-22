import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney } from '../lib/format';

const BUCKET_CHIP = { '0-30': 'chip-neutral', '31-60': 'chip-warning', '61-90': 'chip-danger', '90+': 'chip-danger' };

export function AgingPage() {
  const [tab, setTab] = useState('ar');

  return (
    <div>
      <p className="page-title mb-4">Receivables &amp; Payables Aging</p>
      <div className="flex gap-1 border-b border-rule mb-5">
        {[['ar', 'Receivables (AR)'], ['ap', 'Payables (AP)']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === key ? 'border-accent text-accent-strong font-medium' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'ar' ? <ArAgingTab /> : <ApAgingTab />}
    </div>
  );
}

function ArAgingTab() {
  const { company, can } = useAuth();
  const toast = useToast();
  const [report, setReport] = useState(null);
  const [writingOff, setWritingOff] = useState(null);

  function load() {
    api.get('/reports/ar-aging').then(setReport).catch((err) => toast(err.message, 'error'));
  }
  useEffect(load, []);

  if (!report) return <Loading />;
  if (report.rows.length === 0) return <EmptyState title="No outstanding receivables" description="Every credit sale is either fully paid or written off." />;

  return (
    <>
      <div className="grid grid-cols-4 gap-3 mb-5 max-w-xl">
        {Object.entries(report.buckets).map(([bucket, amount]) => (
          <div key={bucket} className="card p-3">
            <p className="text-xs text-ink-muted uppercase tracking-wide">{bucket} days</p>
            <p className="font-display text-xl mt-1 num">{formatMoney(amount, company?.currency)}</p>
          </div>
        ))}
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
              <th className="px-3 py-2 font-medium">Invoice</th>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Days overdue</th>
              <th className="px-3 py-2 font-medium">Bucket</th>
              <th className="px-3 py-2 font-medium text-right">Due</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((r) => (
              <tr key={r.saleId} className="border-b border-rule last:border-0">
                <td className="px-3 py-2">{r.invoiceNumber}</td>
                <td className="px-3 py-2">{r.customerName}</td>
                <td className="px-3 py-2 text-ink-muted">{r.daysOverdue}</td>
                <td className="px-3 py-2"><span className={BUCKET_CHIP[r.bucket]}>{r.bucket}</span></td>
                <td className="px-3 py-2 num text-right">{formatMoney(r.dueAmount, company?.currency)}</td>
                <td className="px-3 py-2 text-right">
                  {can('reports.financial') && <button className="btn-ghost !text-danger" onClick={() => setWritingOff(r)}>Write off</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {writingOff && <WriteOffForm row={writingOff} onClose={() => setWritingOff(null)} onSaved={() => { setWritingOff(null); load(); }} />}
    </>
  );
}

function WriteOffForm({ row, onClose, onSaved }) {
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
      toast('Receivable written off.', 'success');
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
        <p className="font-display text-lg mb-1">Write off {row.invoiceNumber}</p>
        <p className="text-sm text-ink-muted mb-4">{row.customerName} — {formatMoney(row.dueAmount, company?.currency)}. This is permanent and cannot be undone.</p>
        <div className="space-y-3">
          <div>
            <label className="field-label">Bad debt expense account</label>
            <select required className="field-input" value={badDebtExpenseAccountId} onChange={(e) => setBadDebtExpenseAccountId(e.target.value)}>
              <option value="">Select…</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Receivable account</label>
            <select required className="field-input" value={receivableAccountId} onChange={(e) => setReceivableAccountId(e.target.value)}>
              <option value="">Select…</option>
              {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary !bg-danger">{saving ? 'Writing off…' : 'Confirm write-off'}</button>
        </div>
      </form>
    </div>
  );
}

function ApAgingTab() {
  const { company } = useAuth();
  const toast = useToast();
  const [report, setReport] = useState(null);

  useEffect(() => {
    api.get('/reports/ap-aging').then(setReport).catch((err) => toast(err.message, 'error'));
  }, []);

  if (!report) return <Loading />;
  if (report.rows.length === 0) return <EmptyState title="No outstanding payables" description="Every purchase order is either fully paid or has no balance due." />;

  return (
    <>
      <div className="grid grid-cols-4 gap-3 mb-5 max-w-xl">
        {Object.entries(report.buckets).map(([bucket, amount]) => (
          <div key={bucket} className="card p-3">
            <p className="text-xs text-ink-muted uppercase tracking-wide">{bucket} days</p>
            <p className="font-display text-xl mt-1 num">{formatMoney(amount, company?.currency)}</p>
          </div>
        ))}
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
              <th className="px-3 py-2 font-medium">PO</th>
              <th className="px-3 py-2 font-medium">Supplier</th>
              <th className="px-3 py-2 font-medium">Days overdue</th>
              <th className="px-3 py-2 font-medium">Bucket</th>
              <th className="px-3 py-2 font-medium text-right">Due</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((r) => (
              <tr key={r.purchaseOrderId} className="border-b border-rule last:border-0">
                <td className="px-3 py-2">{r.poNumber}</td>
                <td className="px-3 py-2">{r.supplierName}</td>
                <td className="px-3 py-2 text-ink-muted">{r.daysOverdue}</td>
                <td className="px-3 py-2"><span className={BUCKET_CHIP[r.bucket]}>{r.bucket}</span></td>
                <td className="px-3 py-2 num text-right">{formatMoney(r.dueAmount, company?.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
