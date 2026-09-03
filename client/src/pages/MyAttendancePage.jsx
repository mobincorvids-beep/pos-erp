import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

const STATUS_CHIP = { present: 'chip-accent', absent: 'chip-danger', leave: 'chip-warning', holiday: 'chip-neutral' };

function formatTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * TimeTrex-style self-service clock-in/out — a new page (HrPage.jsx is
 * off-limits for concurrent-work reasons) that talks only to the new
 * /attendance endpoints, resolving "which employee" server-side from the
 * logged-in user rather than anything picked here.
 */
export function MyAttendancePage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [status, setStatus] = useState(null); // { employee, today, history } | null
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    api.get('/attendance/me').then(setStatus).catch((err) => toast(err.message, 'error')).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function clockIn() {
    setBusy(true);
    try {
      await api.post('/attendance/clock-in');
      toast(t('myAttendance.clockedIn'), 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function clockOut() {
    setBusy(true);
    try {
      await api.post('/attendance/clock-out');
      toast(t('myAttendance.clockedOut'), 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  if (!status?.employee) {
    return (
      <EmptyState
        title={t('myAttendance.noEmployeeTitle')}
        description={t('myAttendance.noEmployeeDescription')}
      />
    );
  }

  const { today, history } = status;
  const hasClockedIn = Boolean(today?.checkIn);
  const hasClockedOut = Boolean(today?.checkOut);

  return (
    <div className="max-w-2xl">
      <p className="page-title mb-1">{t('myAttendance.title')}</p>
      <p className="text-sm text-ink-muted mb-6">{t('myAttendance.subtitle')}</p>

      <div className="card p-6 mb-6">
        <p className="eyebrow mb-3">{t('myAttendance.todayStatus')}</p>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex gap-8">
            <div>
              <p className="text-xs text-ink-muted mb-1">{t('myAttendance.clockedInAt')}</p>
              <p className="num text-lg font-semibold text-ink">{formatTime(today?.checkIn)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-muted mb-1">{t('myAttendance.clockedOutAt')}</p>
              <p className="num text-lg font-semibold text-ink">{formatTime(today?.checkOut)}</p>
            </div>
          </div>

          {!hasClockedIn && (
            <button className="btn-primary" disabled={busy} onClick={clockIn}>
              {busy ? t('myAttendance.saving') : t('myAttendance.clockIn')}
            </button>
          )}
          {hasClockedIn && !hasClockedOut && (
            <button className="btn-secondary" disabled={busy} onClick={clockOut}>
              {busy ? t('myAttendance.saving') : t('myAttendance.clockOut')}
            </button>
          )}
          {hasClockedIn && hasClockedOut && (
            <span className="chip-accent">{t('myAttendance.doneForToday')}</span>
          )}
        </div>
      </div>

      <p className="eyebrow mb-3">{t('myAttendance.recentHistory')}</p>
      {history.length === 0 ? (
        <EmptyState title={t('myAttendance.noHistoryTitle')} description={t('myAttendance.noHistoryDescription')} />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-sunken/60 border-b border-rule">
                <th className="px-5 py-3 eyebrow font-medium">{t('myAttendance.colDate')}</th>
                <th className="px-5 py-3 eyebrow font-medium">{t('myAttendance.colStatus')}</th>
                <th className="px-5 py-3 eyebrow font-medium">{t('myAttendance.colIn')}</th>
                <th className="px-5 py-3 eyebrow font-medium">{t('myAttendance.colOut')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule text-sm">
              {history.map((row) => (
                <tr key={row._id}>
                  <td className="px-5 py-3 text-ink">{formatDate(row.date)}</td>
                  <td className="px-5 py-3"><span className={STATUS_CHIP[row.status] || 'chip-neutral'}>{row.status}</span></td>
                  <td className="px-5 py-3 num text-ink-muted">{formatTime(row.checkIn)}</td>
                  <td className="px-5 py-3 num text-ink-muted">{formatTime(row.checkOut)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
