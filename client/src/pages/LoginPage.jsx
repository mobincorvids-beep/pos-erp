import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { FieldError, errorInputClass } from '../components/FieldError';
import { validate, validateEmail, validateRequired, hasErrors } from '../lib/validation';
import { api } from '../api/client';

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(searchParams.get('oauth_error') || '');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});
  // { google: boolean, microsoft: boolean } once fetched from the backend
  // — "Sign in with Google" only ever renders once the server confirms
  // GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL are actually configured (see
  // src/config/passport.js). Unset in this sandbox, so it stays hidden
  // here; a real deployment that sets those env vars gets the button.
  const [oauthProviders, setOauthProviders] = useState(null);

  useEffect(() => {
    api.get('/auth/oauth-providers').then(setOauthProviders).catch(() => setOauthProviders({ google: false, microsoft: false }));
  }, []);

  function signInWithGoogle() {
    // Full page redirect on purpose, not fetch/XHR — OAuth's
    // authorization step has to happen as a real top-level browser
    // navigation to Google, which then redirects back to our backend.
    const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');
    window.location.href = `${base}/auth/google`;
  }

  const rules = {
    email: (v) => validateEmail(v),
    password: (v) => validateRequired(v, 'Password'),
  };
  const errors = validate({ email, password }, rules);

  function markTouched(field) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (hasErrors(errors)) return;
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result && result.pending) {
        navigate('/verify', { state: { preAuthToken: result.preAuthToken, kind: result.pending, email } });
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
    <div className="min-h-screen bg-surface-sunken flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-end mb-3">
          <LanguageSwitcher />
        </div>
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.png" alt="ZAM ERP" className="w-14 h-14 rounded-xl shadow-sm object-contain" />
          <p className="font-display text-2xl font-bold text-ink mt-3">ZAM ERP</p>
          <p className="eyebrow mt-1">{t('auth.tagline')}</p>
        </div>

        <div className="card overflow-hidden">
          <div className="h-1.5 bg-accent" />
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <p className="page-title text-lg mb-1">{t('auth.welcomeBack')}</p>

            {error && (
              <div className="chip-danger !inline-block w-full !rounded-lg px-3 py-2 text-sm">{error}</div>
            )}
            <div>
              <label className="field-label" htmlFor="email">{t('auth.email')}</label>
              <input
                id="email" type="email" required autoFocus maxLength={254}
                className={`field-input ${errorInputClass(touched.email && errors.email)}`}
                value={email} onChange={(e) => setEmail(e.target.value)}
                onBlur={() => markTouched('email')}
                placeholder={t('auth.emailPlaceholder')}
                aria-invalid={Boolean(touched.email && errors.email)}
              />
              <FieldError message={touched.email ? errors.email : null} />
            </div>
            <div>
              <label className="field-label" htmlFor="password">{t('auth.password')}</label>
              <input
                id="password" type="password" required
                className={`field-input ${errorInputClass(touched.password && errors.password)}`}
                value={password} onChange={(e) => setPassword(e.target.value)}
                onBlur={() => markTouched('password')}
                placeholder="••••••••"
                aria-invalid={Boolean(touched.password && errors.password)}
              />
              <FieldError message={touched.password ? errors.password : null} />
            </div>
            <button type="submit" disabled={loading || hasErrors(errors)} className="btn-primary w-full">
              {loading ? t('auth.signingIn') : t('auth.signIn')}
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
                  onClick={signInWithGoogle}
                  className="btn-secondary w-full flex items-center justify-center gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.7-.4-3.5z"/>
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.3 19 12 24 12c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3 16.3 3 9.6 7.3 6.3 14.7z"/>
                    <path fill="#4CAF50" d="M24 45c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.4C29.6 36.4 26.9 37.4 24 37.4c-5.2 0-9.6-3.3-11.2-7.9l-6.6 5.1C9.5 40.6 16.2 45 24 45z"/>
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.4C41.6 35.6 45 30.2 45 24c0-1.4-.1-2.7-.4-3.5z"/>
                  </svg>
                  Sign in with Google
                </button>
              </>
            )}
          </form>
        </div>

        <p className="text-sm text-ink-muted text-center mt-5">
          {t('auth.newBusiness')} <Link to="/signup" className="text-accent font-semibold underline">{t('auth.createAccount')}</Link>
        </p>
        <p className="text-xs text-ink-muted text-center mt-3">
          {t('auth.seededDemo')}
        </p>
      </div>
    </div>
  );
}
