import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setToken } from '../api/client';
import { useAuth } from '../context/AuthContext';

/**
 * Landing spot for the browser after GET /auth/google/callback on the
 * backend finishes and redirects here with ?token=...&refreshToken=...
 * (see src/controllers/oauthController.js). Reuses the exact same
 * setToken() + /auth/me flow AuthContext.login() uses, rather than
 * writing a second, parallel way to establish a session.
 */
export function OAuthCompletePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // StrictMode double-invoke guard
    ran.current = true;

    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refreshToken');

    if (!token || !refreshToken) {
      navigate('/login?oauth_error=' + encodeURIComponent('Google sign-in did not return a valid session.'), { replace: true });
      return;
    }

    setToken(token, refreshToken);
    refreshUser()
      .then(() => navigate('/dashboard', { replace: true }))
      .catch(() => {
        setToken(null);
        navigate('/login?oauth_error=' + encodeURIComponent('Could not complete sign-in. Please try again.'), { replace: true });
      });
  }, [searchParams, navigate, refreshUser]);

  return (
    <div className="min-h-screen bg-surface-sunken flex items-center justify-center px-4">
      <p className="text-ink-muted text-sm">{t('auth.signingIn')}…</p>
    </div>
  );
}
