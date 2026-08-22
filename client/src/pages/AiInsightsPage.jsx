import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

export function AiInsightsPage() {
  const { company } = useAuth();
  const toast = useToast();
  const [briefing, setBriefing] = useState(null);
  const [reorders, setReorders] = useState([]);
  const [slowMoving, setSlowMoving] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetched as three INDEPENDENT requests, each clearing its own share of
  // `loading`, rather than one Promise.all — under Promise.all, a single
  // slow or failed endpoint (e.g. a cold-started serverless function)
  // held the whole page's spinner open forever even after the other two
  // sections had real data to show, since nothing cleared `loading` until
  // every request settled. Each request now resolves the spinner as soon
  // as ITS OWN data is in, and one endpoint failing no longer blocks the
  // other two from rendering.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    let pending = 3;
    const settle = () => { if (!cancelled && --pending === 0) setLoading(false); };

    api.get('/ai/briefing').then((b) => { if (!cancelled) setBriefing(b); }).catch((err) => toast(err.message, 'error')).finally(settle);
    api.get('/ai/reorder-recommendations').then((r) => { if (!cancelled) setReorders(r); }).catch((err) => toast(err.message, 'error')).finally(settle);
    api.get('/ai/slow-moving-inventory').then((s) => { if (!cancelled) setSlowMoving(s); }).catch((err) => toast(err.message, 'error')).finally(settle);

    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <p className="page-title mb-1">Insights</p>
      <p className="text-sm text-ink-muted mb-5">Rule-based findings from your own sales and stock data — not a trained model, just thresholds and comparisons applied consistently.</p>

      {loading && <Loading />}

      {briefing && (
        <div className="card p-4 mb-6">
          <p className="text-sm font-medium mb-2">Briefing</p>
          <ul className="space-y-1.5 text-sm">
            {briefing.findings.map((f, i) => <li key={i} className="flex gap-2"><span className="text-accent">·</span>{f}</li>)}
          </ul>
          {briefing.salesAnomaly && !briefing.salesAnomaly.flagged && briefing.salesAnomaly.baselineDailyAvg > 0 && (
            <p className="text-xs text-ink-muted mt-3">
              This week's daily average: {formatMoney(briefing.salesAnomaly.recentDailyAvg, company?.currency)} vs. the prior month's {formatMoney(briefing.salesAnomaly.baselineDailyAvg, company?.currency)} — within normal range.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium mb-2">Reorder recommendations</p>
          {reorders.length === 0 ? (
            <p className="text-sm text-ink-muted">Nothing needs reordering right now.</p>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium text-right">On hand</th>
                    <th className="px-3 py-2 font-medium text-right">Suggested</th>
                  </tr>
                </thead>
                <tbody>
                  {reorders.map((r, i) => (
                    <tr key={i} className="border-b border-rule last:border-0">
                      <td className="px-3 py-2">{r.productName}</td>
                      <td className="px-3 py-2 num text-right text-warning">{r.quantityOnHand}</td>
                      <td className="px-3 py-2 num text-right text-accent-strong">+{r.suggestedReorderQuantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-medium mb-2">Slow-moving inventory (60+ days)</p>
          {slowMoving.length === 0 ? (
            <p className="text-sm text-ink-muted">Nothing has gone stale.</p>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium text-right">On hand</th>
                    <th className="px-3 py-2 font-medium">Last sold</th>
                  </tr>
                </thead>
                <tbody>
                  {slowMoving.map((r, i) => (
                    <tr key={i} className="border-b border-rule last:border-0">
                      <td className="px-3 py-2">{r.productName}</td>
                      <td className="px-3 py-2 num text-right">{r.quantityOnHand}</td>
                      <td className="px-3 py-2 text-ink-muted">{r.lastSoldAt ? formatDate(r.lastSoldAt) : 'Never'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
