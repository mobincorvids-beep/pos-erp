import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { formatDate } from '../lib/format';

export function SecurityPage() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();

  return (
    <div className="max-w-3xl">
      <p className="eyebrow mb-1">{t('security.account')}</p>
      <p className="page-title mb-1">{t('security.security')}</p>
      <p className="text-sm text-ink-muted mb-6">{t('security.subtitle')}</p>
      <div className="space-y-6">
        <TwoFactorSection user={user} refreshUser={refreshUser} />
        <SessionsSection />
        <LoginHistorySection />
      </div>
    </div>
  );
}

function TwoFactorSection({ user, refreshUser }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [setupData, setSetupData] = useState(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState(null);
  const [password, setPassword] = useState('');
  const [showDisable, setShowDisable] = useState(false);
  const [busy, setBusy] = useState(false);

  async function startSetup() {
    setBusy(true);
    try {
      const data = await api.post('/auth/2fa/setup', {});
      setSetupData(data);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await api.post('/auth/2fa/confirm', { token: code });
      setBackupCodes(data.backupCodes);
      setSetupData(null);
      setCode('');
      await refreshUser();
      toast(t('security.twoFactorEnabled'), 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function disable(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/auth/2fa/disable', { password });
      setShowDisable(false);
      setPassword('');
      await refreshUser();
      toast(t('security.twoFactorDisabled'), 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-accent-soft flex items-center justify-center text-accent-strong shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l7 3v6c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V5l7-3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12l1.8 1.8L14.5 10" />
            </svg>
          </div>
          <div>
            <p className="font-display text-lg font-semibold text-ink">{t('security.twoFactorAuthentication')}</p>
            <p className="text-sm text-ink-muted mt-0.5">{t('security.twoFactorDescription')}</p>
          </div>
        </div>
        {user?.twoFactorEnabled
          ? <span className="chip-accent shrink-0">{t('security.enabled')}</span>
          : <span className="chip-neutral shrink-0">{t('security.notEnabled')}</span>}
      </div>

      {!user?.twoFactorEnabled && !setupData && !backupCodes && (
        <button className="btn-primary mt-4" onClick={startSetup} disabled={busy}>{t('security.enable2fa')}</button>
      )}

      {setupData && (
        <div className="mt-4 border-t border-rule pt-4">
          <p className="text-sm mb-3">{t('security.scanQrHint')}</p>
          <img src={setupData.qrCodeDataUrl} alt={t('security.qrCodeAlt')} className="border border-rule rounded-lg" width={180} height={180} />
          <p className="text-xs text-ink-muted mt-2 font-mono break-all">{t('security.orEnterManually')} {setupData.secret}</p>
          <form onSubmit={confirm} className="flex gap-2 mt-3 max-w-xs">
            <input required autoFocus placeholder="000000" className="field-input" value={code} onChange={(e) => setCode(e.target.value)} />
            <button type="submit" className="btn-primary shrink-0" disabled={busy}>{t('security.confirm')}</button>
          </form>
        </div>
      )}

      {backupCodes && (
        <div className="mt-4 border-t border-rule pt-4">
          <p className="text-sm font-medium text-danger">{t('security.saveBackupCodesNow')}</p>
          <p className="text-xs text-ink-muted mt-1 mb-3">{t('security.backupCodesHint')}</p>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-surface-sunken rounded-lg p-3">
            {backupCodes.map((c) => <span key={c}>{c}</span>)}
          </div>
          <button className="btn-secondary mt-3" onClick={() => setBackupCodes(null)}>{t('security.iveSavedThese')}</button>
        </div>
      )}

      {user?.twoFactorEnabled && !showDisable && (
        <button className="btn-ghost !text-danger mt-4" onClick={() => setShowDisable(true)}>{t('security.disable2fa')}</button>
      )}
      {showDisable && (
        <form onSubmit={disable} className="mt-4 border-t border-rule pt-4 flex gap-2 max-w-xs">
          <input required type="password" autoFocus placeholder={t('security.confirmYourPassword')} className="field-input" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="btn-secondary !text-danger shrink-0" disabled={busy}>{t('security.disable')}</button>
        </form>
      )}
    </div>
  );
}

function SessionsSection() {
  const { t } = useTranslation();
  const toast = useToast();
  const [sessions, setSessions] = useState(null);

  function load() {
    api.get('/auth/sessions').then(setSessions).catch((err) => toast(err.message, 'error'));
  }
  useEffect(load, []);

  async function revoke(id) {
    try {
      await api.post(`/auth/sessions/${id}/revoke`, {});
      toast(t('security.sessionSignedOut'), 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-6 border-b border-rule">
        <p className="font-display text-lg font-semibold text-ink">{t('security.activeSessions')}</p>
        <p className="text-sm text-ink-muted mt-0.5">{t('security.activeSessionsDescription')}</p>
      </div>

      {!sessions && <div className="p-6"><Loading /></div>}
      {sessions?.length === 0 && <p className="text-sm text-ink-muted p-6">{t('security.noOtherActiveSessions')}</p>}

      {sessions?.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-sunken">
              <tr>
                <th className="px-6 py-3 eyebrow font-semibold">{t('security.device')}</th>
                <th className="px-6 py-3 eyebrow font-semibold">{t('security.ipAddress')}</th>
                <th className="px-6 py-3 eyebrow font-semibold">{t('security.lastActive')}</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule text-sm">
              {sessions.map((s) => (
                <tr key={s._id} className="hover:bg-surface-sunken/60 transition-colors">
                  <td className="px-6 py-4 text-ink">{s.userAgent || t('security.unknownDevice')}</td>
                  <td className="px-6 py-4 num text-ink-muted">{s.ipAddress || t('security.unknownIp')}</td>
                  <td className="px-6 py-4 text-ink-muted">{formatDate(s.lastUsedAt)}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="btn-ghost !text-danger" onClick={() => revoke(s._id)}>{t('security.signOut')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LoginHistorySection() {
  const { t } = useTranslation();
  const toast = useToast();
  const [history, setHistory] = useState(null);

  useEffect(() => {
    api.get('/auth/login-history').then(setHistory).catch((err) => toast(err.message, 'error'));
  }, []);

  return (
    <div className="card overflow-hidden">
      <div className="p-6 border-b border-rule">
        <p className="font-display text-lg font-semibold text-ink">{t('security.recentLoginActivity')}</p>
        <p className="text-sm text-ink-muted mt-0.5">{t('security.loginHistoryDescription')}</p>
      </div>

      {!history && <div className="p-6"><Loading /></div>}
      {history?.length === 0 && <p className="text-sm text-ink-muted p-6">{t('security.noLoginHistoryYet')}</p>}

      {history?.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-sunken">
              <tr>
                <th className="px-6 py-3 eyebrow font-semibold">{t('security.timestamp')}</th>
                <th className="px-6 py-3 eyebrow font-semibold">{t('security.ipAddress')}</th>
                <th className="px-6 py-3 eyebrow font-semibold">{t('security.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule text-sm">
              {history.map((h) => (
                <tr key={h._id} className={h.success ? 'hover:bg-surface-sunken/60 transition-colors' : 'bg-danger-soft/30 hover:bg-danger-soft/50 transition-colors'}>
                  <td className={`px-6 py-3 num whitespace-nowrap ${h.success ? 'text-ink' : 'text-danger'}`}>{formatDate(h.createdAt)}</td>
                  <td className="px-6 py-3 num text-ink-muted">{h.ipAddress || t('security.unknownIp')}</td>
                  <td className="px-6 py-3">
                    <span className={h.success ? 'chip-accent' : 'chip-danger'}>{h.success ? t('security.success') : (h.failureReason || t('security.failed'))}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
