import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { FieldError, errorInputClass } from '../components/FieldError';
import { validate, validateEmail, validateRequired, hasErrors } from '../lib/validation';

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});

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
      await login(email, password);
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
          <div className="w-12 h-12 rounded-xl bg-accent text-white font-display font-bold text-xl flex items-center justify-center shadow-sm">
            M
          </div>
          <p className="font-display text-2xl font-bold text-ink mt-3">Muhasib</p>
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
