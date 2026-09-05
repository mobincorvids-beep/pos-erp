import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { INDUSTRY_MODULES } from '../industryModuleRegistry';
import { api } from '../api/client';

// Every business type the platform recognizes for tailoring the sidebar
// and home dashboard (see lib/businessProfile.js) — reusing the same
// list industryModuleRegistry.js already maintains for the industry-page
// side of things, so this dropdown never drifts out of sync with it.
// 'retail' pinned first as the sane default for a generic shop.
const BUSINESS_TYPES = [
  { key: 'retail', label: 'Retail / General shop' },
  ...INDUSTRY_MODULES.filter((m) => m.key !== 'retail').map((m) => ({ key: m.key, label: m.label })),
];

export function SignupPage() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    businessName: '', industryType: 'retail', adminName: '', adminEmail: '', adminPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Same "only render once the server confirms it's configured" pattern as
  // LoginPage — see its comment for why.
  const [oauthProviders, setOauthProviders] = useState(null);

  useEffect(() => {
    api.get('/auth/oauth-providers').then(setOauthProviders).catch(() => setOauthProviders({ google: false, microsoft: false }));
  }, []);

  function signUpWithGoogle() {
    // Deliberately a DIFFERENT backend route than LoginPage's Google
    // button (/auth/google/signup vs /auth/google) — it's what tells the
    // backend this click is allowed to create a brand-new company when no
    // existing account matches the Google email. See oauthRoutes.js /
    // oauthService.findOrLinkUser.
    const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');
    window.location.href = `${base}/auth/google/signup`;
  }

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await register(form);
      if (result && result.pending) {
        navigate('/verify', { state: { preAuthToken: result.preAuthToken, kind: result.pending, email: form.adminEmail } });
        return;
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
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
          <p className="text-sm text-ink-muted mt-1">{t('signup.createBusinessAccount')}</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <div className="chip-danger !inline-block w-full !rounded px-3 py-2 text-sm">{error}</div>
          )}

          <div>
            <p className="eyebrow mb-2">{t('signup.business')}</p>
            <div className="space-y-4">
              <div>
                <label className="field-label" htmlFor="businessName">{t('signup.businessName')}</label>
                <input
                  id="businessName" required autoFocus className="field-input"
                  value={form.businessName} onChange={update('businessName')}
                  placeholder={t('signup.businessNamePlaceholder')}
                />
              </div>

              <div>
                <label className="field-label" htmlFor="industryType">{t('signup.businessType')}</label>
                <select id="industryType" required className="field-input" value={form.industryType} onChange={update('industryType')}>
                  {BUSINESS_TYPES.map((bt) => (
                    <option key={bt.key} value={bt.key}>{bt.label}</option>
                  ))}
                </select>
                <p className="text-xs text-ink-muted mt-1">
                  {t('signup.businessTypeHint')}
                </p>
              </div>
            </div>
          </div>

          <div className="tear-line" />

          <div>
            <p className="eyebrow mb-2">{t('signup.adminAccount')}</p>
            <div className="space-y-4">
              <div>
                <label className="field-label" htmlFor="adminName">{t('signup.yourName')}</label>
                <input id="adminName" required className="field-input" value={form.adminName} onChange={update('adminName')} placeholder={t('signup.fullNamePlaceholder')} />
              </div>
              <div>
                <label className="field-label" htmlFor="adminEmail">{t('signup.email')}</label>
                <input id="adminEmail" type="email" required className="field-input" value={form.adminEmail} onChange={update('adminEmail')} placeholder={t('signup.emailPlaceholder')} />
              </div>
              <div>
                <label className="field-label" htmlFor="adminPassword">{t('signup.password')}</label>
                <input id="adminPassword" type="password" required minLength={8} className="field-input" value={form.adminPassword} onChange={update('adminPassword')} placeholder={t('signup.passwordPlaceholder')} />
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? t('signup.creatingAccount') : t('signup.createBusinessAccountButton')}
          </button>

          {oauthProviders?.google && (
            <>
              <div className="flex items-center gap-3 text-xs text-ink-muted">
                <span className="h-px flex-1 bg-rule" />
                <span>or</span>
                <span className="h-px flex-1 bg-rule" />
              </div>
              <button
                type="button"
                onClick={signUpWithGoogle}
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.7-.4-3.5z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.3 19 12 24 12c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3 16.3 3 9.6 7.3 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 45c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.4C29.6 36.4 26.9 37.4 24 37.4c-5.2 0-9.6-3.3-11.2-7.9l-6.6 5.1C9.5 40.6 16.2 45 24 45z"/>
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.4C41.6 35.6 45 30.2 45 24c0-1.4-.1-2.7-.4-3.5z"/>
                </svg>
                Sign up with Google
              </button>
            </>
          )}
        </form>

        <p className="text-sm text-ink-muted text-center mt-4">
          {t('signup.alreadyHaveAccount')} <Link to="/login" className="underline">{t('signup.signIn')}</Link>
        </p>
        <p className="text-xs text-ink-muted text-center mt-4">
          {t('signup.privacyNote')}
        </p>
      </div>
    </div>
  );
}
