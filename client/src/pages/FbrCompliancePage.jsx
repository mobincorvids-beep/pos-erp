import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatMoney, formatDateTime, toDateInputValue } from '../lib/format';

function StatCard({ label, value, tone = 'neutral' }) {
  const toneClass = {
    neutral: 'text-ink',
    accent: 'text-accent',
    danger: 'text-danger',
    warning: 'text-warning',
  }[tone];
  return (
    <div className="card p-4">
      <p className="eyebrow font-semibold text-ink-muted mb-1">{label}</p>
      <p className={`text-2xl font-display font-bold num ${toneClass}`}>{value}</p>
    </div>
  );
}

function CredentialRow({ label, ok }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className={ok ? 'chip-accent' : 'chip-danger'}>{ok ? t('fbrCompliance.configured') : t('fbrCompliance.missing')}</span>
    </div>
  );
}

export function FbrCompliancePage() {
  const { t } = useTranslation();
  const { company } = useAuth();
  const toast = useToast();

  const today = toDateInputValue(new Date());
  const thirtyDaysAgo = toDateInputValue(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

  const [from, setFrom] = useState(thirtyDaysAgo);
  const [to, setTo] = useState(today);
  const [summary, setSummary] = useState(null);
  const [outstanding, setOutstanding] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState(null);
  const [retryingAll, setRetryingAll] = useState(false);

  function load() {
    setLoading(true);
    const qs = `?from=${from}&to=${to}`;
    Promise.all([
      api.get(`/fbr-compliance/summary${qs}`),
      api.get(`/fbr-compliance/outstanding${qs}`),
    ])
      .then(([s, o]) => { setSummary(s); setOutstanding(o); })
      .catch((err) => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [from, to]);

  async function handleRetryAll() {
    setRetryingAll(true);
    try {
      const result = await api.post(`/fbr-compliance/retry-all?from=${from}&to=${to}`);
      toast(t('fbrCompliance.retrySummary', result), result.failed ? 'error' : 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setRetryingAll(false);
    }
  }

  async function handleRetryOne(saleId) {
    setRetryingId(saleId);
    try {
      await api.post(`/sales/${saleId}/fbr-submit`);
      toast(t('salesHistory.fbrRetrySuccess'), 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
        <div>
          <p className="page-title mb-1">{t('fbrCompliance.title')}</p>
          <p className="text-sm text-ink-muted">{t('fbrCompliance.subtitle')}</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="field-label">{t('fbrCompliance.filterFrom')}</label>
            <input type="date" className="field-input" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="field-label">{t('fbrCompliance.filterTo')}</label>
            <input type="date" className="field-input" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {loading && <Loading />}

      {!loading && summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <StatCard label={t('fbrCompliance.totalSales')} value={summary.counts.total} />
            <StatCard label={t('fbrCompliance.submitted')} value={summary.counts.submitted} tone="accent" />
            <StatCard label={t('fbrCompliance.pending')} value={summary.counts.pending} tone="warning" />
            <StatCard label={t('fbrCompliance.failed')} value={summary.counts.failed} tone="danger" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="card p-4 h-fit">
              <p className="font-display font-semibold text-ink mb-2">{t('fbrCompliance.credentialsTitle')}</p>
              <CredentialRow label={t('fbrCompliance.ntnStatus')} ok={summary.credentials.ntnConfigured} />
              <CredentialRow label={t('fbrCompliance.strnStatus')} ok={summary.credentials.strnConfigured} />
              <CredentialRow label={t('fbrCompliance.posIdStatus')} ok={summary.credentials.fbrPosIdConfigured} />
              <CredentialRow label={t('fbrCompliance.tokenStatus')} ok={summary.credentials.fbrApiTokenConfigured} />
              <div className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-ink-muted">{t('settings.sandboxMode')}</span>
                <span className="chip-neutral">{summary.credentials.sandboxMode ? t('fbrCompliance.sandbox') : t('fbrCompliance.production')}</span>
              </div>
            </div>

            <div className="lg:col-span-2 card overflow-hidden">
              <div className="p-4 border-b border-rule flex items-center justify-between">
                <p className="font-display font-semibold text-ink">{t('fbrCompliance.outstandingTitle')}</p>
                <button className="btn-secondary !py-1.5 text-sm" disabled={retryingAll || outstanding.length === 0} onClick={handleRetryAll}>
                  {retryingAll ? t('fbrCompliance.retrying') : t('fbrCompliance.retryAll')}
                </button>
              </div>

              {outstanding.length === 0 && (
                <div className="p-6">
                  <EmptyState title={t('fbrCompliance.emptyTitle')} description={t('fbrCompliance.emptyDescription')} />
                </div>
              )}

              {outstanding.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-surface-sunken/60 border-y border-rule">
                        <th className="py-2.5 px-4 eyebrow font-semibold">{t('fbrCompliance.colInvoice')}</th>
                        <th className="py-2.5 px-4 eyebrow font-semibold">{t('fbrCompliance.colCustomer')}</th>
                        <th className="py-2.5 px-4 eyebrow font-semibold text-right">{t('fbrCompliance.colAmount')}</th>
                        <th className="py-2.5 px-4 eyebrow font-semibold">{t('fbrCompliance.colError')}</th>
                        <th className="py-2.5 px-4 eyebrow font-semibold"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {outstanding.map((sale) => (
                        <tr key={sale._id} className="border-b border-rule last:border-0">
                          <td className="py-3 px-4 num font-medium text-accent">{sale.invoiceNumber || sale.documentNumber}</td>
                          <td className="py-3 px-4">{sale.customerId?.name || t('salesHistory.walkIn')}</td>
                          <td className="py-3 px-4 num text-right">{formatMoney(sale.totalAmount, company?.currency)}</td>
                          <td className="py-3 px-4 text-ink-muted max-w-xs truncate" title={sale.fbrSubmissionError || ''}>
                            {sale.fbrSubmissionError || t('fbrCompliance.never')}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              className="btn-secondary !py-1 !px-2.5 text-xs"
                              disabled={retryingId === sale._id}
                              onClick={() => handleRetryOne(sale._id)}
                            >
                              {retryingId === sale._id ? t('fbrCompliance.retrying') : t('fbrCompliance.retry')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
