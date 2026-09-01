import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { formatDate } from '../lib/format';

export function SecurityPage() {
  const { user, refreshUser } = useAuth();

  return (
    <div className="max-w-3xl">
      <p className="eyebrow mb-1">Account</p>
      <p className="page-title mb-1">Security</p>
      <p className="text-sm text-ink-muted mb-6">Manage two-factor authentication, active sessions, and recent login activity.</p>
      <div className="space-y-6">
        <TwoFactorSection user={user} refreshUser={refreshUser} />
        <SessionsSection />
        <LoginHistorySection />
      </div>
    </div>
  );
}

function TwoFactorSection({ user, refreshUser }) {
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
      toast('Two-factor authentication enabled.', 'success');
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
      toast('Two-factor authentication disabled.', 'success');
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
            <p className="font-display text-lg font-semibold text-ink">Two-factor authentication</p>
            <p className="text-sm text-ink-muted mt-0.5">Require a code from an authenticator app in addition to your password.</p>
          </div>
        </div>
        {user?.twoFactorEnabled
          ? <span className="chip-accent shrink-0">Enabled</span>
          : <span className="chip-neutral shrink-0">Not enabled</span>}
      </div>

      {!user?.twoFactorEnabled && !setupData && !backupCodes && (
        <button className="btn-primary mt-4" onClick={startSetup} disabled={busy}>Enable 2FA</button>
      )}

      {setupData && (
        <div className="mt-4 border-t border-rule pt-4">
          <p className="text-sm mb-3">Scan this with your authenticator app, then enter the 6-digit code it shows.</p>
          <img src={setupData.qrCodeDataUrl} alt="2FA QR code" className="border border-rule rounded-lg" width={180} height={180} />
          <p className="text-xs text-ink-muted mt-2 font-mono break-all">Or enter manually: {setupData.secret}</p>
          <form onSubmit={confirm} className="flex gap-2 mt-3 max-w-xs">
            <input required autoFocus placeholder="000000" className="field-input" value={code} onChange={(e) => setCode(e.target.value)} />
            <button type="submit" className="btn-primary shrink-0" disabled={busy}>Confirm</button>
          </form>
        </div>
      )}

      {backupCodes && (
        <div className="mt-4 border-t border-rule pt-4">
          <p className="text-sm font-medium text-danger">Save these backup codes now: they won't be shown again.</p>
          <p className="text-xs text-ink-muted mt-1 mb-3">Each one can be used once to sign in if you lose access to your authenticator app.</p>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-surface-sunken rounded-lg p-3">
            {backupCodes.map((c) => <span key={c}>{c}</span>)}
          </div>
          <button className="btn-secondary mt-3" onClick={() => setBackupCodes(null)}>I've saved these</button>
        </div>
      )}

      {user?.twoFactorEnabled && !showDisable && (
        <button className="btn-ghost !text-danger mt-4" onClick={() => setShowDisable(true)}>Disable 2FA</button>
      )}
      {showDisable && (
        <form onSubmit={disable} className="mt-4 border-t border-rule pt-4 flex gap-2 max-w-xs">
          <input required type="password" autoFocus placeholder="Confirm your password" className="field-input" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="btn-secondary !text-danger shrink-0" disabled={busy}>Disable</button>
        </form>
      )}
    </div>
  );
}

function SessionsSection() {
  const toast = useToast();
  const [sessions, setSessions] = useState(null);

  function load() {
    api.get('/auth/sessions').then(setSessions).catch((err) => toast(err.message, 'error'));
  }
  useEffect(load, []);

  async function revoke(id) {
    try {
      await api.post(`/auth/sessions/${id}/revoke`, {});
      toast('Session signed out.', 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-6 border-b border-rule">
        <p className="font-display text-lg font-semibold text-ink">Active sessions</p>
        <p className="text-sm text-ink-muted mt-0.5">Devices currently signed in to your account.</p>
      </div>

      {!sessions && <div className="p-6"><Loading /></div>}
      {sessions?.length === 0 && <p className="text-sm text-ink-muted p-6">No other active sessions.</p>}

      {sessions?.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-sunken">
              <tr>
                <th className="px-6 py-3 eyebrow font-semibold">Device</th>
                <th className="px-6 py-3 eyebrow font-semibold">IP Address</th>
                <th className="px-6 py-3 eyebrow font-semibold">Last Active</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule text-sm">
              {sessions.map((s) => (
                <tr key={s._id} className="hover:bg-surface-sunken/60 transition-colors">
                  <td className="px-6 py-4 text-ink">{s.userAgent || 'Unknown device'}</td>
                  <td className="px-6 py-4 num text-ink-muted">{s.ipAddress || 'Unknown IP'}</td>
                  <td className="px-6 py-4 text-ink-muted">{formatDate(s.lastUsedAt)}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="btn-ghost !text-danger" onClick={() => revoke(s._id)}>Sign out</button>
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
  const toast = useToast();
  const [history, setHistory] = useState(null);

  useEffect(() => {
    api.get('/auth/login-history').then(setHistory).catch((err) => toast(err.message, 'error'));
  }, []);

  return (
    <div className="card overflow-hidden">
      <div className="p-6 border-b border-rule">
        <p className="font-display text-lg font-semibold text-ink">Recent login activity</p>
        <p className="text-sm text-ink-muted mt-0.5">Every login attempt on your account, successful or not.</p>
      </div>

      {!history && <div className="p-6"><Loading /></div>}
      {history?.length === 0 && <p className="text-sm text-ink-muted p-6">No login history yet.</p>}

      {history?.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-sunken">
              <tr>
                <th className="px-6 py-3 eyebrow font-semibold">Timestamp</th>
                <th className="px-6 py-3 eyebrow font-semibold">IP Address</th>
                <th className="px-6 py-3 eyebrow font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule text-sm">
              {history.map((h) => (
                <tr key={h._id} className={h.success ? 'hover:bg-surface-sunken/60 transition-colors' : 'bg-danger-soft/30 hover:bg-danger-soft/50 transition-colors'}>
                  <td className={`px-6 py-3 num whitespace-nowrap ${h.success ? 'text-ink' : 'text-danger'}`}>{formatDate(h.createdAt)}</td>
                  <td className="px-6 py-3 num text-ink-muted">{h.ipAddress || 'Unknown IP'}</td>
                  <td className="px-6 py-3">
                    <span className={h.success ? 'chip-accent' : 'chip-danger'}>{h.success ? 'Success' : (h.failureReason || 'Failed')}</span>
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
