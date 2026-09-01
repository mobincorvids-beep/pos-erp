import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDate } from '../lib/format';

export function AiInsightsPage() {
  const { t } = useTranslation();
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
      <div className="flex items-start justify-between gap-4 mb-1">
        <p className="page-title flex items-center gap-2">
          <span className="material-symbols-outlined text-accent" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
          {t('aiInsights.title')}
        </p>
        <span className="chip-accent inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          {t('aiInsights.ruleBasedEngine')}
        </span>
      </div>
      <p className="text-sm text-ink-muted mb-6 max-w-2xl">{t('aiInsights.subtitle')}</p>

      {loading && <Loading />}

      {briefing && (
        <div className="card p-6 mb-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-accent" />
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-accent-soft flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-accent-strong" style={{ fontVariationSettings: "'FILL' 1" }}>tips_and_updates</span>
            </div>
            <div className="flex-1">
              <p className="eyebrow mb-2">{t('aiInsights.briefing')}</p>
              <ul className="space-y-1.5 text-sm">
                {briefing.findings.map((f, i) => <li key={i} className="flex gap-2"><span className="text-accent">·</span>{f}</li>)}
              </ul>
              {briefing.salesAnomaly && !briefing.salesAnomaly.flagged && briefing.salesAnomaly.baselineDailyAvg > 0 && (
                <p className="text-xs text-ink-muted mt-3">
                  {t('aiInsights.weeklyAvgVsPrior', {
                    recent: formatMoney(briefing.salesAnomaly.recentDailyAvg, company?.currency),
                    baseline: formatMoney(briefing.salesAnomaly.baselineDailyAvg, company?.currency),
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-accent text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>trending_up</span>
            <p className="text-sm font-semibold">{t('aiInsights.reorderRecommendations')}</p>
          </div>
          {reorders.length === 0 ? (
            <p className="text-sm text-ink-muted">{t('aiInsights.nothingNeedsReordering')}</p>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                    <th className="px-3 py-2 font-medium">{t('aiInsights.product')}</th>
                    <th className="px-3 py-2 font-medium text-right">{t('aiInsights.onHand')}</th>
                    <th className="px-3 py-2 font-medium text-right">{t('aiInsights.suggested')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reorders.map((r, i) => (
                    <tr key={i} className="border-b border-rule last:border-0 hover:bg-surface-sunken transition-colors">
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
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-ink-muted text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>hourglass_bottom</span>
            <p className="text-sm font-semibold">{t('aiInsights.slowMovingInventory')}</p>
          </div>
          {slowMoving.length === 0 ? (
            <p className="text-sm text-ink-muted">{t('aiInsights.nothingGoneStale')}</p>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide">
                    <th className="px-3 py-2 font-medium">{t('aiInsights.product')}</th>
                    <th className="px-3 py-2 font-medium text-right">{t('aiInsights.onHand')}</th>
                    <th className="px-3 py-2 font-medium">{t('aiInsights.lastSold')}</th>
                  </tr>
                </thead>
                <tbody>
                  {slowMoving.map((r, i) => (
                    <tr key={i} className="border-b border-rule last:border-0 hover:bg-surface-sunken transition-colors">
                      <td className="px-3 py-2">{r.productName}</td>
                      <td className="px-3 py-2 num text-right">{r.quantityOnHand}</td>
                      <td className="px-3 py-2 text-ink-muted">{r.lastSoldAt ? formatDate(r.lastSoldAt) : t('aiInsights.never')}</td>
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
