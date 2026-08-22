import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Loading } from '../components/Loading';
import { formatDate } from '../lib/format';

export function SecurityPage() {
  const { user, refreshUser } = useAuth();

  return (
    <div className="max-w-2xl">
      <p className="page-title mb-4">Security</p>
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
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-lg">Two-factor authentication</p>
          <p className="text-sm text-ink-muted mt-0.5">Require a code from an authenticator app in addition to your password.</p>
        </div>
        {user?.twoFactorEnabled
          ? <span className="chip-accent">Enabled</span>
          : <span className="chip-neutral">Not enabled</span>}
      </div>

      {!user?.twoFactorEnabled && !setupData && !backupCodes && (
        <button className="btn-primary mt-4" onClick={startSetup} disabled={busy}>Enable 2FA</button>
      )}

      {setupData && (
        <div className="mt-4 border-t border-rule pt-4">
          <p className="text-sm mb-3">Scan this with your authenticator app, then enter the 6-digit code it shows.</p>
          <img src={setupData.qrCodeDataUrl} alt="2FA QR code" className="border border-rule rounded" width={180} height={180} />
          <p className="text-xs text-ink-muted mt-2 font-mono break-all">Or enter manually: {setupData.secret}</p>
          <form onSubmit={confirm} className="flex gap-2 mt-3 max-w-xs">
            <input required autoFocus placeholder="000000" className="field-input" value={code} onChange={(e) => setCode(e.target.value)} />
            <button type="submit" className="btn-primary shrink-0" disabled={busy}>Confirm</button>
          </form>
        </div>
      )}

      {backupCodes && (
        <div className="mt-4 border-t border-rule pt-4">
          <p className="text-sm font-medium text-danger">Save these backup codes now — they won't be shown again.</p>
          <p className="text-xs text-ink-muted mt-1 mb-3">Each one can be used once to sign in if you lose access to your authenticator app.</p>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-paper rounded p-3">
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
    <div className="card p-5">
      <p className="font-display text-lg mb-1">Active sessions</p>
      <p className="text-sm text-ink-muted mb-3">Devices currently signed in to your account.</p>
      {!sessions && <Loading />}
      {sessions?.length === 0 && <p className="text-sm text-ink-muted">No other active sessions.</p>}
      {sessions?.map((s) => (
        <div key={s._id} className="flex items-center justify-between py-2 border-b border-rule last:border-0">
          <div>
            <p className="text-sm">{s.userAgent || 'Unknown device'}</p>
            <p className="text-xs text-ink-muted">{s.ipAddress || 'Unknown IP'} · last active {formatDate(s.lastUsedAt)}</p>
          </div>
          <button className="btn-ghost !text-danger" onClick={() => revoke(s._id)}>Sign out</button>
        </div>
      ))}
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
    <div className="card p-5">
      <p className="font-display text-lg mb-1">Recent login activity</p>
      <p className="text-sm text-ink-muted mb-3">Every login attempt on your account, successful or not.</p>
      {!history && <Loading />}
      {history?.length === 0 && <p className="text-sm text-ink-muted">No login history yet.</p>}
      {history?.map((h) => (
        <div key={h._id} className="flex items-center justify-between py-1.5 border-b border-rule last:border-0 text-sm">
          <span className={h.success ? 'chip-accent' : 'chip-danger'}>{h.success ? 'Success' : (h.failureReason || 'Failed')}</span>
          <span className="text-ink-muted">{h.ipAddress || 'Unknown IP'}</span>
          <span className="text-ink-muted">{formatDate(h.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}
