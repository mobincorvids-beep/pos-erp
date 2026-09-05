import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

/**
 * Shared "enter your code" step for both pending-auth cases the backend can
 * hand back after login/register/verify-email:
 *   - kind: 'email'  -> a 6-digit code just mailed to the user (see
 *     emailVerificationService) — proves they own the mailbox.
 *   - kind: '2fa'    -> a TOTP code from their authenticator app, or one of
 *     their backup codes — proves they still hold the enrolled device.
 * Reached only via router state (preAuthToken + kind) set by LoginPage /
 * SignupPage / RegisterPage right after a login/register call resolves to
 * a pending step — never reachable directly, since without a preAuthToken
 * there's nothing to verify against.
 */
export function VerifyAuthPage() {
  const { t } = useTranslation();
  const { verifyEmailCode, resendEmailCode, verifyTwoFactorCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { preAuthToken, kind, email } = location.state || {};

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [resending, setResending] = useState(false);

  if (!preAuthToken || !kind) {
    return (
      <div className="min-h-screen bg-surface-sunken flex items-center justify-center px-4 py-10">
        <div className="card p-6 max-w-sm text-center">
          <p className="page-title text-lg mb-2">{t('auth.verifySessionExpiredTitle', 'Nothing to verify')}</p>
          <p className="text-sm text-ink-muted mb-4">{t('auth.verifySessionExpiredBody', 'Please sign in again to continue.')}</p>
          <Link to="/login" className="btn-primary inline-block">{t('auth.signIn')}</Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setError('');
    setLoading(true);
    try {
      const result = kind === 'email'
        ? await verifyEmailCode(preAuthToken, code.trim())
        : await verifyTwoFactorCode(preAuthToken, code.trim());

      // Email verification can itself hand back a 2FA pending step (an
      // account can have both gates enabled) — resolvePendingOrComplete in
      // AuthContext returns that same { pending, preAuthToken } shape, so
      // just re-route into this same page for the second step.
      if (result && result.pending) {
        navigate('/verify', { replace: true, state: { preAuthToken: result.preAuthToken, kind: result.pending, email } });
        return;
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResendMsg('');
    setError('');
    setResending(true);
    try {
      await resendEmailCode(preAuthToken);
      setResendMsg(t('auth.codeResent', 'A new code has been sent.'));
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  }

  const isEmail = kind === 'email';

  return (
    <div className="min-h-screen bg-surface-sunken flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-end mb-3">
          <LanguageSwitcher />
        </div>
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.png" alt="ZAM ERP" className="w-14 h-14 rounded-xl shadow-sm object-contain" />
          <p className="font-display text-2xl font-bold text-ink mt-3">ZAM ERP</p>
        </div>

        <div className="card overflow-hidden">
          <div className="h-1.5 bg-accent" />
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <p className="page-title text-lg mb-1">
              {isEmail ? t('auth.verifyEmailTitle', 'Check your email') : t('auth.verify2faTitle', 'Two-factor verification')}
            </p>
            <p className="text-sm text-ink-muted">
              {isEmail
                ? t('auth.verifyEmailBody', 'We emailed you a 6-digit code. Enter it below to finish setting up your account.')
                : t('auth.verify2faBody', 'Enter the code from your authenticator app, or one of your backup codes.')}
            </p>

            {error && (
              <div className="chip-danger !inline-block w-full !rounded-lg px-3 py-2 text-sm">{error}</div>
            )}
            {resendMsg && (
              <div className="chip-accent !inline-block w-full !rounded-lg px-3 py-2 text-sm">{resendMsg}</div>
            )}

            <div>
              <label className="field-label" htmlFor="code">{t('auth.verificationCode', 'Verification code')}</label>
              <input
                id="code" type="text" inputMode="numeric" autoFocus maxLength={12}
                className="field-input tracking-[0.3em] text-center text-lg"
                value={code} onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
              />
            </div>

            <button type="submit" disabled={loading || !code.trim()} className="btn-primary w-full">
              {loading ? t('auth.verifying', 'Verifying…') : t('auth.verify', 'Verify')}
            </button>

            {isEmail && (
              <button
                type="button" onClick={handleResend} disabled={resending}
                className="btn-secondary w-full"
              >
                {resending ? t('auth.resending', 'Sending…') : t('auth.resendCode', 'Resend code')}
              </button>
            )}
          </form>
        </div>

        <p className="text-sm text-ink-muted text-center mt-5">
          <Link to="/login" className="text-accent font-semibold underline">{t('auth.backToSignIn', 'Back to sign in')}</Link>
        </p>
      </div>
    </div>
  );
}
