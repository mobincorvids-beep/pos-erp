import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, setToken } from '../api/client';
import { FieldError, errorInputClass } from '../components/FieldError';
import { validate, validateEmail, validatePassword, validateRequired, hasErrors } from '../lib/validation';

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState('');
  const [industryType, setIndustryType] = useState('retail');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});

  const rules = {
    companyName: (v) => validateRequired(v, 'Company name'),
    adminName: (v) => validateRequired(v, 'Your name'),
    adminEmail: (v) => validateEmail(v),
    adminPassword: (v) => validatePassword(v),
  };
  const errors = validate({ companyName, adminName, adminEmail, adminPassword }, rules);

  function markTouched(field) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched({ companyName: true, adminName: true, adminEmail: true, adminPassword: true });
    if (hasErrors(errors)) return;
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/auth/register', {
        companyName, industryType, adminName, adminEmail, adminPassword,
      });
      setToken(data.token, data.refreshToken);
      navigate('/pos');
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
          <p className="text-sm text-ink-muted mt-1">{t('register.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <div className="chip-danger !inline-block w-full !rounded px-3 py-2 text-sm">{error}</div>
          )}
          <div>
            <label className="field-label" htmlFor="companyName">{t('register.companyName')}</label>
            <input
              id="companyName" type="text" required autoFocus maxLength={120}
              className={`field-input ${errorInputClass(touched.companyName && errors.companyName)}`}
              value={companyName} onChange={(e) => setCompanyName(e.target.value)}
              onBlur={() => markTouched('companyName')}
              placeholder={t('register.companyNamePlaceholder')}
              aria-invalid={Boolean(touched.companyName && errors.companyName)}
            />
            <FieldError message={touched.companyName ? errors.companyName : null} />
          </div>
          <div>
            <label className="field-label" htmlFor="industryType">{t('register.industry')}</label>
            <select
              id="industryType"
              className="field-input"
              value={industryType} onChange={(e) => setIndustryType(e.target.value)}
            >
              <option value="retail">{t('register.industryRetail')}</option>
              <option value="restaurant">{t('register.industryRestaurant')}</option>
              <option value="pharmacy">{t('register.industryPharmacy')}</option>
              <option value="salon">{t('register.industrySalon')}</option>
              <option value="wholesaler">{t('register.industryWholesaler')}</option>
              <option value="manufacturer">{t('register.industryManufacturer')}</option>
              <option value="distributor">{t('register.industryDistributor')}</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="adminName">{t('register.yourName')}</label>
            <input
              id="adminName" type="text" required maxLength={120}
              className={`field-input ${errorInputClass(touched.adminName && errors.adminName)}`}
              value={adminName} onChange={(e) => setAdminName(e.target.value)}
              onBlur={() => markTouched('adminName')}
              placeholder={t('register.yourNamePlaceholder')}
              aria-invalid={Boolean(touched.adminName && errors.adminName)}
            />
            <FieldError message={touched.adminName ? errors.adminName : null} />
          </div>
          <div>
            <label className="field-label" htmlFor="adminEmail">{t('register.email')}</label>
            <input
              id="adminEmail" type="email" required maxLength={254}
              className={`field-input ${errorInputClass(touched.adminEmail && errors.adminEmail)}`}
              value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)}
              onBlur={() => markTouched('adminEmail')}
              placeholder={t('register.emailPlaceholder')}
              aria-invalid={Boolean(touched.adminEmail && errors.adminEmail)}
            />
            <FieldError message={touched.adminEmail ? errors.adminEmail : null} />
          </div>
          <div>
            <label className="field-label" htmlFor="adminPassword">{t('register.password')}</label>
            <input
              id="adminPassword" type="password" required minLength={8}
              className={`field-input ${errorInputClass(touched.adminPassword && errors.adminPassword)}`}
              value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)}
              onBlur={() => markTouched('adminPassword')}
              placeholder={t('register.passwordPlaceholder')}
              aria-invalid={Boolean(touched.adminPassword && errors.adminPassword)}
            />
            <FieldError message={touched.adminPassword ? errors.adminPassword : null} />
          </div>
          <button type="submit" disabled={loading || hasErrors(errors)} className="btn-primary w-full">
            {loading ? t('register.creatingCompany') : t('register.createCompany')}
          </button>
        </form>

        <p className="text-xs text-ink-muted text-center mt-4">
          {t('register.alreadyHaveAccount')} <Link to="/login" className="underline">{t('register.signIn')}</Link>
        </p>
      </div>
    </div>
  );
}
