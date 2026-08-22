import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Loading } from '../components/Loading';
import { MetricCard } from '../components/MetricCard';
import { formatMoney, formatDate, formatDateTime, formatQty } from '../lib/format';

// The industry-tailored home screen: a CORE row every business owner
// wants regardless of trade, plus a section chosen server-side off the
// company's real industryType (dashboardService.getHomeDashboard). Every
// industry without a bespoke section still gets a real page — CORE alone,
// never an empty screen — so this component just renders whatever
// `industry` comes back, including null.
export function HomeDashboardPage() {
  const { company } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/home').then(setData).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <p className="page-title mb-1">Home</p>
      <p className="text-sm text-ink-muted mb-6">
        Today's snapshot for {data?.companyName || company?.name}.
      </p>

      {loading && <Loading />}
      {error && <p className="text-sm text-danger">{error}</p>}

      {data && (
        <>
          <section className="mb-8">
            <p className="text-xs text-ink-muted uppercase tracking-wide mb-2">Today</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <MetricCard label="Sales today" value={formatMoney(data.core.salesToday, company?.currency)} />
              <MetricCard label="Transactions today" value={String(data.core.transactionsToday)} plain />
              <MetricCard label="Low stock items" value={String(data.core.lowStockCount)} plain tone={data.core.lowStockCount > 0 ? 'warning' : undefined} />
              <MetricCard label="Cash & bank" value={formatMoney(data.core.cashAndBank, company?.currency)} />
              <MetricCard label="Receivables due" value={formatMoney(data.core.receivablesDue, company?.currency)} />
            </div>
          </section>

          {data.industry ? (
            <IndustrySection industry={data.industry} currency={company?.currency} />
          ) : (
            <p className="text-sm text-ink-muted mb-8">
              There's no dedicated snapshot for this business type yet — the numbers above cover the essentials.
              Browse full detail under <Link to="/reports" className="underline">Reports</Link>.
            </p>
          )}

          <div className="card p-4">
            <p className="text-sm font-medium mb-3">Quick actions</p>
            <div className="flex flex-wrap gap-2">
              <Link to="/pos" className="btn-primary">Open checkout</Link>
              <Link to="/reports" className="btn-secondary">Reports</Link>
              <Link to="/customers" className="btn-secondary">Customers</Link>
              <Link to="/dashboard/team" className="btn-secondary">Team dashboard</Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function IndustrySection({ industry, currency }) {
  switch (industry.industry) {
    case 'pharmacy': return <PharmacySection s={industry} />;
    case 'hotel': return <HotelSection s={industry} />;
    case 'restaurant': return <RestaurantSection s={industry} />;
    case 'salon': return <SalonSection s={industry} />;
    case 'gym': return <GymSection s={industry} />;
    case 'real_estate': return <RealEstateSection s={industry} currency={currency} />;
    case 'grocery': return <GrocerySection s={industry} currency={currency} />;
    case 'retail': return <RetailSection s={industry} currency={currency} />;
    default: return null;
  }
}

function SectionTitle({ children }) {
  return <p className="text-xs text-ink-muted uppercase tracking-wide mb-2">{children}</p>;
}

function EmptyRow({ children }) {
  return <p className="text-sm text-ink-muted px-3 py-3">{children}</p>;
}

function SimpleTable({ columns, rows, empty }) {
  if (rows.length === 0) return <div className="card"><EmptyRow>{empty}</EmptyRow></div>;
  return (
    <div className="card overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
            {columns.map((c, i) => <th key={c} className={`px-3 py-2 font-medium whitespace-nowrap ${i > 0 ? 'text-right' : ''}`}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-rule last:border-0">
              {row.map((cell, j) => <td key={j} className={`px-3 py-2 whitespace-nowrap ${j > 0 ? 'num text-right' : ''}`}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PharmacySection({ s }) {
  return (
    <section className="mb-8">
      <SectionTitle>Pharmacy</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
        <MetricCard label="Near-expiry batches (30d)" value={String(s.nearExpiryCount)} plain tone={s.nearExpiryCount > 0 ? 'warning' : undefined} />
        <MetricCard label="Pending prescriptions" value={String(s.pendingPrescriptions)} plain tone={s.pendingPrescriptions > 0 ? 'warning' : undefined} />
      </div>
      <SimpleTable
        columns={['Product', 'Batch', 'Expiry', 'Qty on hand', 'Days left']}
        empty="No batches expiring within 30 days."
        rows={s.nearExpiryBatches.map((b) => [b.productName, b.batchNumber, formatDate(b.expiryDate), formatQty(b.quantityOnHand), b.daysToExpiry])}
      />
    </section>
  );
}

function HotelSection({ s }) {
  return (
    <section className="mb-8">
      <SectionTitle>Hotel</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <MetricCard label="Occupancy" value={`${s.occupancyRate}%`} plain />
        <MetricCard label="Rooms occupied" value={`${s.occupiedRooms} / ${s.totalRooms}`} plain />
        <MetricCard label="Check-ins today" value={String(s.checkInsToday.length)} plain />
        <MetricCard label="Check-outs today" value={String(s.checkOutsToday.length)} plain />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium mb-2">Check-ins today</p>
          <SimpleTable columns={['Room', 'Guest']} empty="No check-ins today."
            rows={s.checkInsToday.map((r) => [r.roomId?.roomNumber, r.guestName || r.customerId?.name || '—'])} />
        </div>
        <div>
          <p className="text-sm font-medium mb-2">Check-outs today</p>
          <SimpleTable columns={['Room', 'Guest']} empty="No check-outs today."
            rows={s.checkOutsToday.map((r) => [r.roomId?.roomNumber, r.guestName || r.customerId?.name || '—'])} />
        </div>
      </div>
    </section>
  );
}

function RestaurantSection({ s }) {
  return (
    <section className="mb-8">
      <SectionTitle>Restaurant</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Open tables" value={`${s.openTables} / ${s.totalTables}`} plain tone={s.openTables > 0 ? 'warning' : undefined} />
        <MetricCard label="Open kitchen tickets" value={String(s.openKots)} plain tone={s.openKots > 0 ? 'warning' : undefined} />
        <MetricCard label="Tickets today" value={String(s.kotsToday)} plain />
      </div>
    </section>
  );
}

function SalonSection({ s }) {
  return (
    <section className="mb-8">
      <SectionTitle>Salon</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
        <MetricCard label="Appointments today" value={String(s.appointmentsTodayCount)} plain />
        <MetricCard label="Completed today" value={String(s.appointmentsCompletedToday)} plain />
      </div>
      <SimpleTable
        columns={['Time', 'Customer', 'Service', 'Status']}
        empty="No appointments scheduled today."
        rows={s.appointmentsToday.map((a) => [formatDateTime(a.startTime), a.customerId?.name || '—', a.serviceName, a.status])}
      />
    </section>
  );
}

function GymSection({ s }) {
  return (
    <section className="mb-8">
      <SectionTitle>Gym</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <MetricCard label="Sessions today" value={String(s.sessionsTodayCount)} plain />
        <MetricCard label="Enrolled / capacity" value={`${s.totalEnrolled} / ${s.totalCapacity}`} plain />
        <MetricCard label="Waitlisted" value={String(s.totalWaitlisted)} plain tone={s.totalWaitlisted > 0 ? 'warning' : undefined} />
      </div>
      <SimpleTable
        columns={['Time', 'Class', 'Enrolled', 'Capacity']}
        empty="No classes scheduled today."
        rows={s.sessionsToday.map((c) => [formatDateTime(c.startTime), c.gymClassId?.name, c.enrolledCustomerIds.length, c.capacity])}
      />
    </section>
  );
}

function RealEstateSection({ s, currency }) {
  return (
    <section className="mb-8">
      <SectionTitle>Real estate</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
        <MetricCard label="Active leases" value={String(s.activeLeaseCount)} plain />
        <MetricCard label="Overdue leases" value={String(s.overdueLeaseCount)} plain tone={s.overdueLeaseCount > 0 ? 'warning' : undefined} />
        <MetricCard label="Overdue rent total" value={formatMoney(s.overdueTotal, currency)} tone={s.overdueTotal > 0 ? 'warning' : undefined} />
      </div>
      <SimpleTable
        columns={['Unit', 'Tenant', 'Due date', 'Days late', 'Amount due']}
        empty="No overdue rent."
        rows={s.overdueLeases.map((l) => [l.unitNumber, l.tenantName || '—', formatDate(l.dueDate), l.daysLate, formatMoney(l.amountDue, currency)])}
      />
    </section>
  );
}

function GrocerySection({ s, currency }) {
  return (
    <section className="mb-8">
      <SectionTitle>Grocery</SectionTitle>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium mb-2">Fast movers (7 days)</p>
          <SimpleTable columns={['Product', 'Revenue']} empty="No sales in the last 7 days."
            rows={s.fastMovers.map((p) => [p.productName, formatMoney(p.revenue, currency)])} />
        </div>
        <div>
          <p className="text-sm font-medium mb-2">Near-expiry stock (14 days)</p>
          <SimpleTable columns={['Product', 'Batch', 'Expiry', 'Qty']} empty="Nothing expiring within 14 days."
            rows={s.nearExpiryBatches.map((b) => [b.productName, b.batchNumber, formatDate(b.expiryDate), formatQty(b.quantityOnHand)])} />
        </div>
      </div>
    </section>
  );
}

function RetailSection({ s, currency }) {
  return (
    <section className="mb-8">
      <SectionTitle>Retail</SectionTitle>
      <p className="text-sm font-medium mb-2">Top products today</p>
      <SimpleTable columns={['Product', 'Revenue']} empty="No sales yet today."
        rows={s.topProductsToday.map((p) => [p.productName, formatMoney(p.revenue, currency)])} />
    </section>
  );
}
