import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Loading } from '../components/Loading';
import { formatMoney, toDateInputValue } from '../lib/format';
import { MetricCard } from '../components/MetricCard';

const TABS = [
  { key: 'sales-summary', label: 'Sales summary' },
  { key: 'stock-valuation', label: 'Stock valuation' },
  { key: 'trial-balance', label: 'Trial balance' },
  { key: 'profit-and-loss', label: 'Profit & loss' },
  { key: 'balance-sheet', label: 'Balance sheet' },
  { key: 'low-stock', label: 'Low stock' },
  { key: 'top-products', label: 'Top products' },
  { key: 'top-customers', label: 'Top customers' },
  { key: 'salesperson-performance', label: 'Salesperson performance' },
  { key: 'branch-comparison', label: 'Branch comparison' },
  { key: 'stock-movement', label: 'Stock movement' },
  { key: 'expense-report', label: 'Expenses' },
  { key: 'cash-bank-book', label: 'Cash/bank book' },
  { key: 'consolidated', label: 'Multi-company' },
];

export function ReportsPage() {
  const [tab, setTab] = useState('sales-summary');

  return (
    <div>
      <p className="page-title mb-4">Reports</p>
      <div className="flex gap-1 border-b border-rule mb-5 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm -mb-px border-b-2 ${tab === t.key ? 'border-accent text-accent-strong font-medium' : 'border-transparent text-ink-muted hover:text-ink'}`}
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
      {tab === 'low-stock' && <SimpleReport path="/reports/low-stock" render={LowStockView} />}
      {tab === 'top-products' && <DateRangeReport path="/reports/top-products" render={TopProductsView} />}
      {tab === 'top-customers' && <DateRangeReport path="/reports/top-customers" render={TopCustomersView} />}
      {tab === 'salesperson-performance' && <DateRangeReport path="/reports/salesperson-performance" render={SalespersonPerformanceView} />}
      {tab === 'branch-comparison' && <DateRangeReport path="/reports/branch-comparison" render={BranchComparisonView} />}
      {tab === 'stock-movement' && <DateRangeReport path="/reports/stock-movement" render={StockMovementView} />}
      {tab === 'expense-report' && <DateRangeReport path="/reports/expense-report" render={ExpenseReportView} />}
      {tab === 'cash-bank-book' && <CashBankBookReport />}
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
    const joiner = path.includes('?') ? '&' : '?';
    api.get(`${path}${joiner}from=${from}&to=${to}`).then(setData).catch((err) => setError(err.message)).finally(() => setLoading(false));
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

function LowStockView({ data }) {
  return (
    <ReportTable
      columns={['Product', 'Warehouse', 'On hand', 'Reorder level', 'Min stock']}
      rows={data.map((r) => [r.productName, r.warehouseId, String(r.quantityOnHand), String(r.reorderLevel ?? '-'), String(r.minStock ?? '-')])}
    />
  );
}

function TopProductsView({ data }) {
  const { company } = useAuth();
  return (
    <ReportTable
      columns={['Product', 'Qty sold', 'Revenue']}
      rows={data.map((r) => [r.productName, String(r.quantitySold), formatMoney(r.revenue, company?.currency)])}
    />
  );
}

function TopCustomersView({ data }) {
  const { company } = useAuth();
  return (
    <ReportTable
      columns={['Customer', 'Invoices', 'Total spend']}
      rows={data.map((r) => [r.customerName, String(r.invoiceCount), formatMoney(r.totalSpend, company?.currency)])}
    />
  );
}

function SalespersonPerformanceView({ data }) {
  const { company } = useAuth();
  return (
    <ReportTable
      columns={['Salesperson', 'Invoices', 'Net sales', 'Average sale']}
      rows={data.map((r) => [r.userName, String(r.invoiceCount), formatMoney(r.netSales, company?.currency), formatMoney(r.averageSale, company?.currency)])}
    />
  );
}

function BranchComparisonView({ data }) {
  const { company } = useAuth();
  return (
    <ReportTable
      columns={['Branch', 'Invoices', 'Net sales']}
      rows={data.map((r) => [r.branchName, String(r.invoiceCount), formatMoney(r.netSales, company?.currency)])}
    />
  );
}

function StockMovementView({ data }) {
  return (
    <ReportTable
      columns={['Date', 'Product', 'Type', 'Quantity']}
      rows={data.map((m) => [
        m.createdAt ? new Date(m.createdAt).toLocaleString() : '-',
        m.productId?.name || m.productId?.sku || '-',
        m.type || m.movementType || '-',
        String(m.quantity ?? ''),
      ])}
    />
  );
}

function ExpenseReportView({ data }) {
  const { company } = useAuth();
  return (
    <div>
      <ReportTable
        columns={['Category', 'Count', 'Total']}
        rows={data.rows.map((r) => [r.categoryName, String(r.count), formatMoney(r.total, company?.currency)])}
      />
      <div className="tear-line mt-3 pt-3 flex justify-between text-base font-medium">
        <span>Grand total</span>
        <span className="num">{formatMoney(data.grandTotal, company?.currency)}</span>
      </div>
    </div>
  );
}

function CashBankBookView({ data }) {
  const { company } = useAuth();
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <MetricCard label="Account" value={data.accountName} plain />
        <MetricCard label="Opening balance" value={formatMoney(data.openingBalance, company?.currency)} />
        <MetricCard label="Closing balance" value={formatMoney(data.closingBalance, company?.currency)} />
      </div>
      <ReportTable
        columns={['Date', 'Voucher #', 'Type', 'Narration', 'Debit', 'Credit', 'Balance']}
        rows={data.entries.map((e) => [
          e.date ? new Date(e.date).toLocaleDateString() : '-',
          e.voucherNumber || '-',
          e.type || '-',
          e.narration || '-',
          formatMoney(e.debit, company?.currency),
          formatMoney(e.credit, company?.currency),
          formatMoney(e.balance, company?.currency),
        ])}
      />
    </div>
  );
}

/** Cash/bank book needs an account picker before it can load — unlike the other
 * date-range reports, `cashBankBook` requires an `accountId` param. Pulls the
 * account list from /account-settings (same endpoint the Default Accounts
 * settings page uses), defaults to the first account once loaded. */
function CashBankBookReport() {
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [accountsError, setAccountsError] = useState('');

  useEffect(() => {
    api.get('/account-settings').then((res) => {
      setAccounts(res.accounts || []);
      if (res.accounts?.length) setAccountId(res.accounts[0]._id);
    }).catch((err) => setAccountsError(err.message));
  }, []);

  if (accountsError) return <p className="text-sm text-danger">{accountsError}</p>;
  if (!accounts.length) return <Loading />;

  return (
    <div>
      <div className="mb-4">
        <label className="field-label">Account</label>
        <select className="field-input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
        </select>
      </div>
      {accountId && (
        <DateRangeReport key={accountId} path={`/reports/cash-bank-book?accountId=${accountId}`} render={CashBankBookView} />
      )}
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
