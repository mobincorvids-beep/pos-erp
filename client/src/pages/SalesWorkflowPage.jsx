import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

export function SalesWorkflowPage() {
  const [tab, setTab] = useState('quotations');
  return (
    <div>
      <p className="page-title mb-4">Quotations &amp; sales orders</p>
      <div className="flex gap-1 border-b border-rule mb-5">
        {[['quotations', 'Quotations'], ['sales-orders', 'Sales orders']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === key ? 'border-accent text-accent-strong font-medium' : 'border-transparent text-ink-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'quotations' && <DocumentList kind="quotations" />}
      {tab === 'sales-orders' && <DocumentList kind="sales-orders" />}
    </div>
  );
}

function DocumentList({ kind }) {
  const { company } = useAuth();
  const toast = useToast();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.get(`/sales-workflow/${kind}`).then(setDocs).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, [kind]);

  async function accept(id) {
    try {
      await api.post(`/sales-workflow/quotations/${id}/accept`);
      toast('Quotation accepted — now a sales order.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function cancel(id) {
    try {
      await api.post(`/sales-workflow/${id}/cancel`);
      toast('Cancelled.', 'success');
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  if (loading) return <Loading />;
  if (docs.length === 0) return <EmptyState title={`No ${kind === 'quotations' ? 'quotations' : 'sales orders'} yet`} description="These don't touch stock or the ledger until converted to an invoice." />;

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
            <th className="px-3 py-2 font-medium">Document #</th>
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium text-right">Total</th>
            <th className="px-3 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d._id} className="border-b border-rule last:border-0">
              <td className="px-3 py-2 num">{d.documentNumber}</td>
              <td className="px-3 py-2 text-ink-muted">{formatDate(d.createdAt)}</td>
              <td className="px-3 py-2"><span className="chip-neutral">{d.status.replace('_', ' ')}</span></td>
              <td className="px-3 py-2 num text-right">{formatMoney(d.totalAmount, company?.currency)}</td>
              <td className="px-3 py-2 text-right">
                {kind === 'quotations' && d.status === 'quotation' && (
                  <button className="btn-ghost !text-accent" onClick={() => accept(d._id)}>Accept</button>
                )}
                {(d.status === 'quotation' || d.status === 'sales_order') && (
                  <button className="btn-ghost !text-danger" onClick={() => cancel(d._id)}>Cancel</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-ink-muted px-3 py-2 border-t border-rule">
        Converting a sales order to an invoice (checkout) isn't yet wired into this UI — use <code className="num">POST /sales-workflow/:id/convert-to-invoice</code> directly for now.
      </p>
    </div>
  );
}
