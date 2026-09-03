import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDate } from '../lib/format';

const STATUS_CHIP = { sent: 'chip-accent', failed: 'chip-danger', not_configured: 'chip-neutral' };
const TYPE_LABEL_KEY = { order_confirmation: 'whatsappLog.typeOrderConfirmation', payment_reminder: 'whatsappLog.typePaymentReminder', other: 'whatsappLog.typeOther' };

export function WhatsappLogPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [logs, setLogs] = useState(null);

  function load() {
    api.get('/whatsapp/logs').then(setLogs).catch((err) => toast(err.message, 'error'));
  }
  useEffect(load, []);

  const hasNotConfigured = logs?.length > 0 && logs.every((l) => l.status === 'not_configured');

  return (
    <div>
      <div className="mb-4">
        <p className="eyebrow mb-1">{t('nav.sections.people')}</p>
        <p className="page-title">{t('whatsappLog.title')}</p>
        <p className="text-sm text-ink-muted mt-1">{t('whatsappLog.subtitle')}</p>
      </div>

      {(logs === null) ? (
        <Loading />
      ) : logs.length === 0 ? (
        <EmptyState
          title={t('whatsappLog.noLogs')}
          description={t('whatsappLog.notConfiguredNotice')}
        />
      ) : (
        <div className="card overflow-hidden">
          {hasNotConfigured && (
            <p className="text-xs text-ink-muted bg-surface-sunken px-5 py-3 border-b border-rule">{t('whatsappLog.notConfiguredNotice')}</p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-muted uppercase tracking-wide bg-surface-sunken/60">
                  <th className="px-4 py-3 font-semibold">{t('whatsappLog.colTo')}</th>
                  <th className="px-4 py-3 font-semibold">{t('whatsappLog.colType')}</th>
                  <th className="px-4 py-3 font-semibold">{t('whatsappLog.colDetail')}</th>
                  <th className="px-4 py-3 font-semibold">{t('whatsappLog.colStatus')}</th>
                  <th className="px-4 py-3 font-semibold">{t('whatsappLog.colError')}</th>
                  <th className="px-4 py-3 font-semibold">{t('whatsappLog.colSentAt')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-accent-soft/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-ink num">{log.to}</td>
                    <td className="px-4 py-3 text-ink-muted flex items-center gap-1.5">
                      <MessageCircle size={13} className="text-accent shrink-0" />
                      {t(TYPE_LABEL_KEY[log.type] || 'whatsappLog.typeOther')}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{log.detail || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={STATUS_CHIP[log.status] || 'chip-neutral'}>
                        {t(`whatsappLog.status${log.status === 'sent' ? 'Sent' : log.status === 'failed' ? 'Failed' : 'NotConfigured'}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted max-w-xs truncate" title={log.errorMessage || ''}>{log.errorMessage || '-'}</td>
                    <td className="px-4 py-3 text-ink-muted">{formatDate(log.sentAt || log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
