// Shared metric tile — originally lived only inside ReportsPage, now a
// real shared component so any page (HomeDashboardPage included) can
// reuse the exact same visual language instead of re-implementing it.
export function MetricCard({ label, value, tone, plain, className = '' }) {
  return (
    <div className={`card p-4 ${className}`}>
      <p className="text-xs text-ink-muted mb-1">{label}</p>
      <p className={`text-xl ${plain ? 'font-display' : 'num'} ${tone === 'warning' ? 'text-warning' : 'text-ink'}`}>{value}</p>
    </div>
  );
}
