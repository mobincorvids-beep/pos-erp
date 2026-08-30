import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en/translation.json';
import ur from './locales/ur/translation.json';
import pnb from './locales/pnb/translation.json';
import sd from './locales/sd/translation.json';
import ps from './locales/ps/translation.json';
import skr from './locales/skr/translation.json';
import bal from './locales/bal/translation.json';

// Every language the app ships translations for, plus the metadata the
// language switcher and RTL logic need. `nativeName` is what's shown in
// the switcher — always the language's own name in its own script, never
// English. `rtl: true` languages get document.dir flipped on activation
// (see applyDirection below).
export const SUPPORTED_LANGUAGES = [
  { code: 'en', nativeName: 'English', rtl: false },
  { code: 'ur', nativeName: 'اردو', rtl: true },
  { code: 'pnb', nativeName: 'پنجابی', rtl: true },
  { code: 'sd', nativeName: 'سنڌي', rtl: true },
  { code: 'ps', nativeName: 'پښتو', rtl: true },
  { code: 'skr', nativeName: 'سرائیکی', rtl: true },
  { code: 'bal', nativeName: 'بلوچی', rtl: true },
];

export const RTL_LANGUAGES = SUPPORTED_LANGUAGES.filter((l) => l.rtl).map((l) => l.code);

const LOCALSTORAGE_KEY = 'pos_erp_language';

/** Sets <html dir> and <html lang> to match the given language code. Safe to call before i18n has finished initializing. */
export function applyDirection(lng) {
  const isRtl = RTL_LANGUAGES.includes(lng);
  document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
  document.documentElement.lang = lng;
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ur: { translation: ur },
      pnb: { translation: pnb },
      sd: { translation: sd },
      ps: { translation: ps },
      skr: { translation: skr },
      bal: { translation: bal },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LOCALSTORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false }, // React already escapes
  });

// Keep <html dir>/<html lang> in sync on every language change, including
// the very first one resolved by the detector above (which fires
// asynchronously relative to this module's own top-level code).
i18n.on('languageChanged', applyDirection);
applyDirection(i18n.resolvedLanguage || i18n.language || 'en');

export default i18n;
