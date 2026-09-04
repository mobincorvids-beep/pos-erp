import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { INDUSTRY_MODULES } from '../industryModuleRegistry';

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

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
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
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-white font-display text-xl font-bold mb-3">M</div>
          <p className="font-display text-3xl text-ink">Muhasib</p>
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
