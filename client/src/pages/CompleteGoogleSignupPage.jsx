import { useState } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setToken } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { INDUSTRY_MODULES } from '../industryModuleRegistry';

// Same list SignupPage.jsx builds for the password-based form — kept in
// sync with industryModuleRegistry.js the same way, so a Google signup
// and a password signup always offer the identical set of industries.
const BUSINESS_TYPES = [
  { key: 'retail', label: 'Retail / General shop' },
  ...INDUSTRY_MODULES.filter((m) => m.key !== 'retail').map((m) => ({ key: m.key, label: m.label })),
];

/**
 * Landing spot after "Sign up with Google" when no existing account
 * matched the Google email — the backend has verified the identity but
 * deliberately hasn't created a company yet (see
 * src/services/oauthService.js findOrLinkUser's `pendingSignup` case).
 * This page collects the same two fields the password-based signup form
 * always asks for — business name and industry — before finishing
 * provisioning via POST /auth/google/complete-signup.
 */
export function CompleteGoogleSignupPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const pendingToken = searchParams.get('pending');

  const [businessName, setBusinessName] = useState('');
  const [industryType, setIndustryType] = useState('retail');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!pendingToken) {
    return <Navigate to="/signup" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, refreshToken } = await api.post('/auth/google/complete-signup', {
        pendingToken, businessName, industryType,
      });
      setToken(token, refreshToken);
      await refreshUser();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || t('signup.creatingAccount'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="ZAM ERP" className="inline-block h-14 w-14 rounded-xl object-contain mb-3" />
          <p className="font-display text-3xl text-ink">ZAM ERP</p>
          <p className="text-sm text-ink-muted mt-1">{t('completeSignup.subtitle', "One last step — tell us about your business")}</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <div className="chip-danger !inline-block w-full !rounded px-3 py-2 text-sm">{error}</div>
          )}

          <div>
            <label className="field-label" htmlFor="businessName">{t('signup.businessName')}</label>
            <input
              id="businessName" required autoFocus className="field-input"
              value={businessName} onChange={(e) => setBusinessName(e.target.value)}
              placeholder={t('signup.businessNamePlaceholder')}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="industryType">{t('signup.businessType')}</label>
            <select id="industryType" required className="field-input" value={industryType} onChange={(e) => setIndustryType(e.target.value)}>
              {BUSINESS_TYPES.map((bt) => (
                <option key={bt.key} value={bt.key}>{bt.label}</option>
              ))}
            </select>
            <p className="text-xs text-ink-muted mt-1">{t('signup.businessTypeHint')}</p>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? t('signup.creatingAccount') : t('completeSignup.finishButton', 'Finish creating my account')}
          </button>
        </form>
      </div>
    </div>
  );
}
