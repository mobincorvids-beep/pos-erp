import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Loading } from '../components/Loading';
import { formatMoney, toDateInputValue } from '../lib/format';

const TABS = [
  { key: 'sales-summary', label: 'Sales summary' },
  { key: 'stock-valuation', label: 'Stock valuation' },
  { key: 'trial-balance', label: 'Trial balance' },
  { key: 'profit-and-loss', label: 'Profit & loss' },
  { key: 'balance-sheet', label: 'Balance sheet' },
  { key: 'consolidated', label: 'Multi-company' },
];

export function ReportsPage() {
  const [tab, setTab] = useState('sales-summary');

  return (
    <div>
      <p className="page-title mb-4">Reports</p>
      <div className="flex gap-1 border-b border-rule mb-5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === t.key ? 'border-accent text-accent-strong font-medium' : 'border-transparent text-ink-muted hover:text-ink'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sales-summary' && <DateRangeReport path="/reports/sales-summary" render={SalesSummaryView} />}
      {tab === 'stock-valuation' && <SimpleReport path="/reports/stock-valuation" render={StockValuationView} />}
      {tab === 'trial-balance' && <SimpleReport path="/reports/trial-balance" render={TrialBalanceView} />}
      {tab === 'profit-and-loss' && <DateRangeReport path="/reports/profit-and-loss" render={ProfitAndLossView} />}
      {tab === 'balance-sheet' && <SimpleReport path="/reports/balance-sheet" render={BalanceSheetView} />}
      {tab === 'consolidated' && <DateRangeReport path="/reports/consolidated/sales-summary" render={ConsolidatedView} />}
    </div>
  );
}

function ConsolidatedView({ data }) {
  const { company } = useAuth();
  return (
    <div>
      <p className="text-xs text-ink-muted mb-3">Every company in your group (this company plus any sharing the same parent) — configured by your platform admin.</p>
      <ReportTable
        columns={['Company', 'Invoices', 'Net sales']}
        rows={data.companies.map((c) => [c.companyName, String(c.invoiceCount), formatMoney(c.netSales, company?.currency)])}
      />
      <div className="tear-line mt-3 pt-3 flex justify-between text-base font-medium">
        <span>Group total</span>
        <span className="num">{formatMoney(data.totals.netSales, company?.currency)}</span>
      </div>
    </div>
  );
}

function SimpleReport({ path, render: Render }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get(path).then(setData).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [path]);

  if (loading) return <Loading />;
  if (error) return <p className="text-sm text-danger">{error}</p>;
  return <Render data={data} />;
}

function DateRangeReport({ path, render: Render }) {
  const [from, setFrom] = useState(() => toDateInputValue(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
  const [to, setTo] = useState(() => toDateInputValue());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    api.get(`${path}?from=${from}&to=${to}`).then(setData).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }
  useEffect(load, [path]);

  return (
    <div>
      <div className="flex items-end gap-2 mb-4">
        <div><label className="field-label">From</label><input type="date" className="field-input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label className="field-label">To</label><input type="date" className="field-input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <button className="btn-secondary" onClick={load}>Update</button>
      </div>
      {loading && <Loading />}
      {error && <p className="text-sm text-danger">{error}</p>}
      {!loading && data && <Render data={data} />}
    </div>
  );
}

function SalesSummaryView({ data }) {
  const { company } = useAuth();
  const s = data.summary;
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Net sales" value={formatMoney(s.netSales, company?.currency)} />
        <MetricCard label="Invoices" value={String(s.invoiceCount)} plain />
        <MetricCard label="Discounts" value={formatMoney(s.totalDiscount, company?.currency)} />
        <MetricCard label="Outstanding" value={formatMoney(s.totalDue, company?.currency)} tone="warning" />
      </div>
      <p className="text-sm font-medium mb-2">By day</p>
      <ReportTable
        columns={['Date', 'Invoices', 'Net sales']}
        rows={data.byDay.map((d) => [d.date, String(d.invoiceCount), formatMoney(d.netSales, company?.currency)])}
      />
    </div>
  );
}

function StockValuationView({ data }) {
  const { company } = useAuth();
  return (
    <div>
      <MetricCard label="Total inventory value" value={formatMoney(data.totalValue, company?.currency)} className="mb-4 w-64" />
      <ReportTable
        columns={['Product', 'Qty', 'Unit cost', 'Value']}
        rows={data.rows.map((r) => [r.productName, r.quantity, formatMoney(r.unitCost, company?.currency), formatMoney(r.value, company?.currency)])}
      />
    </div>
  );
}

function TrialBalanceView({ data }) {
  const { company } = useAuth();
  return (
    <div>
      <div className={`chip-${data.balanced ? 'accent' : 'danger'} !inline-block mb-4`}>
        {data.balanced ? 'Balanced' : 'Not balanced — check ledger entries'}
      </div>
      <ReportTable
        columns={['Account', 'Type', 'Debit', 'Credit']}
        rows={data.accounts.map((a) => [a.name, a.type, formatMoney(a.debit, company?.currency), formatMoney(a.credit, company?.currency)])}
      />
    </div>
  );
}

function ProfitAndLossView({ data }) {
  const { company } = useAuth();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div>
        <p className="text-sm font-medium mb-2">Income</p>
        <ReportTable columns={['Account', 'Amount']} rows={data.income.map((r) => [r.name, formatMoney(r.amount, company?.currency)])} />
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Expenses</p>
        <ReportTable columns={['Account', 'Amount']} rows={data.expenses.map((r) => [r.name, formatMoney(r.amount, company?.currency)])} />
      </div>
      <div className="col-span-2 tear-line pt-3 flex justify-between text-base font-medium">
        <span>Net profit</span>
        <span className={`num ${data.netProfit >= 0 ? 'text-accent-strong' : 'text-danger'}`}>{formatMoney(data.netProfit, company?.currency)}</span>
      </div>
    </div>
  );
}

function BalanceSheetView({ data }) {
  const { company } = useAuth();
  return (
    <div>
      <div className={`chip-${data.balanced ? 'accent' : 'danger'} !inline-block mb-4`}>
        {data.balanced ? 'Balanced' : 'Not balanced'}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div>
          <p className="text-sm font-medium mb-2">Assets</p>
          <ReportTable columns={['Account', 'Balance']} rows={data.assets.map((r) => [r.name, formatMoney(r.balance, company?.currency)])} />
          <p className="num text-sm font-medium mt-2 text-right">{formatMoney(data.totalAssets, company?.currency)}</p>
        </div>
        <div>
          <p className="text-sm font-medium mb-2">Liabilities</p>
          <ReportTable columns={['Account', 'Balance']} rows={data.liabilities.map((r) => [r.name, formatMoney(r.balance, company?.currency)])} />
          <p className="num text-sm font-medium mt-2 text-right">{formatMoney(data.totalLiabilities, company?.currency)}</p>
        </div>
        <div>
          <p className="text-sm font-medium mb-2">Equity</p>
          <ReportTable columns={['Account', 'Balance']} rows={data.equity.map((r) => [r.name, formatMoney(r.balance, company?.currency)])} />
          <p className="num text-sm font-medium mt-2 text-right">{formatMoney(data.totalEquity, company?.currency)}</p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone, plain, className = '' }) {
  return (
    <div className={`card p-4 ${className}`}>
      <p className="text-xs text-ink-muted mb-1">{label}</p>
      <p className={`text-xl ${plain ? 'font-display' : 'num'} ${tone === 'warning' ? 'text-warning' : 'text-ink'}`}>{value}</p>
    </div>
  );
}

function ReportTable({ columns, rows }) {
  if (rows.length === 0) return <p className="text-sm text-ink-muted">No data for this period.</p>;
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
            {columns.map((c, i) => <th key={c} className={`px-3 py-2 font-medium ${i > 0 ? 'text-right' : ''}`}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-rule last:border-0">
              {row.map((cell, j) => <td key={j} className={`px-3 py-2 ${j > 0 ? 'num text-right' : ''}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
