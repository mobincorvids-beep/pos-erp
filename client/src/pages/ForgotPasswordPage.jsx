import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Backend always responds success here (never reveals whether the
      // email exists), so this just shows the generic message on any 2xx.
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-sunken flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.png" alt="ZAM ERP" className="w-14 h-14 rounded-xl shadow-sm object-contain" />
          <p className="font-display text-2xl font-bold text-ink mt-3">ZAM ERP</p>
          <p className="eyebrow mt-1">{t('forgotPassword.resetYourPassword')}</p>
        </div>

        {sent ? (
          <div className="card overflow-hidden">
            <div className="h-1.5 bg-accent" />
            <div className="p-6 space-y-4 text-center">
              <p className="page-title text-lg mb-1">{t('forgotPassword.checkYourEmail')}</p>
              <p className="text-sm text-ink-muted">{t('forgotPassword.checkYourEmailDescription')}</p>
              <Link to="/login" className="btn-primary w-full inline-flex">{t('forgotPassword.backToSignIn')}</Link>
            </div>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="h-1.5 bg-accent" />
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <p className="page-title text-lg mb-1">{t('forgotPassword.forgotPassword')}</p>

              {error && (
                <div className="chip-danger !inline-block w-full !rounded-lg px-3 py-2 text-sm">{error}</div>
              )}
              <div>
                <label className="field-label" htmlFor="email">{t('forgotPassword.email')}</label>
                <input
                  id="email" type="email" required autoFocus
                  className="field-input"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@demo.test"
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? t('forgotPassword.sendingEllipsis') : t('forgotPassword.sendResetLink')}
              </button>
            </form>
          </div>
        )}

        <p className="text-sm text-ink-muted text-center mt-5">
          <Link to="/login" className="text-accent font-semibold underline">{t('forgotPassword.backToSignIn')}</Link>
        </p>
      </div>
    </div>
  );
}
