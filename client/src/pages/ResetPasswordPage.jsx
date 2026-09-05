import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError(t('resetPassword.passwordMismatch'));
      return;
    }
    if (!token) {
      setError(t('resetPassword.missingToken'));
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      navigate('/login');
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
          <p className="eyebrow mt-1">{t('resetPassword.subtitle')}</p>
        </div>

        <div className="card overflow-hidden">
          <div className="h-1.5 bg-accent" />
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <p className="page-title text-lg mb-1">{t('resetPassword.title')}</p>

            {error && (
              <div className="chip-danger !inline-block w-full !rounded-lg px-3 py-2 text-sm">{error}</div>
            )}
            <div>
              <label className="field-label" htmlFor="newPassword">{t('resetPassword.newPassword')}</label>
              <input
                id="newPassword" type="password" required minLength={8} autoFocus
                className="field-input"
                value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('resetPassword.newPasswordPlaceholder')}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="confirmPassword">{t('resetPassword.confirmPassword')}</label>
              <input
                id="confirmPassword" type="password" required minLength={8}
                className="field-input"
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('resetPassword.confirmPasswordPlaceholder')}
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? t('resetPassword.resetting') : t('resetPassword.title')}
            </button>
          </form>
        </div>

        <p className="text-sm text-ink-muted text-center mt-5">
          <Link to="/login" className="text-accent font-semibold underline">{t('resetPassword.backToSignIn')}</Link>
        </p>
      </div>
    </div>
  );
}
