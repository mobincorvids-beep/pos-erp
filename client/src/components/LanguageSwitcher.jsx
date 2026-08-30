import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../i18n';

/** Language dropdown — flag-free, each option shown in its own script/name
    (never translated into English), calls i18n.changeLanguage() which the
    i18n/index.js languageChanged listener turns into a document dir/lang
    flip and (via the i18next-browser-languagedetector cache) a
    localStorage write, so the choice persists across reloads. */
export function LanguageSwitcher({ className = '' }) {
  const { i18n } = useTranslation();

  return (
    <select
      className={`field-input !w-auto !py-1.5 !text-xs ${className}`}
      value={i18n.resolvedLanguage || i18n.language}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      aria-label="Language"
    >
      {SUPPORTED_LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code}>{lang.nativeName}</option>
      ))}
    </select>
  );
}
