import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ht from './locales/ht.json';
import fr from './locales/fr.json';
import type { Locale } from '../types';

export const SUPPORTED_LOCALES: readonly Locale[] = ['ht', 'fr'] as const;

export const LOCALE_NAMES: Record<Locale, string> = {
  ht: 'Kreyòl',
  fr: 'Français'
};

/**
 * Localized route mapping (path segments per language).
 * NOTE: /market always stays as 'market' per spec (exception to translation).
 */
export const ROUTES: Record<Locale, Record<string, string>> = {
  ht: {
    home: '',
    markets: 'markets',     // spec: not 'machè'
    market: 'market',      // detail prefix
    login: 'konekte',
    register: 'enskri',
    portfolio: 'pòtfolyo',
    myBets: 'pari-mwen',
    profile: 'pwofil',
    notifications: 'notifikasyon',
    settings: 'paramèt',
    help: 'èd',
    reset: 'reyinisyalize'
  },
  fr: {
    home: '',
    markets: 'markets',
    market: 'market',
    login: 'connexion',
    register: 'inscription',
    portfolio: 'portefeuille',
    myBets: 'mes-paris',
    profile: 'profil',
    notifications: 'notifications',
    settings: 'parametres',
    help: 'aide',
    reset: 'reinitialiser'
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ht: { translation: ht },
      fr: { translation: fr }
    },
    fallbackLng: 'ht',
    supportedLngs: ['ht', 'fr'],
    detection: {
      order: ['localStorage', 'path', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'ayiti_locale',
      lookupFromPathIndex: 0
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false }
  });

/**
 * Build a localized URL.
 * Example: localePath('ht', 'login') → '/ht/konekte'
 */
export function localePath(locale: Locale, key: keyof typeof ROUTES.ht, ...rest: (string | undefined)[]): string {
  const segment = ROUTES[locale][key];
  const tail = rest.filter(Boolean).join('/');
  const path = `/${locale}${segment ? '/' + segment : ''}${tail ? '/' + tail : ''}`;
  return path;
}

/**
 * Detect locale from path. Returns null if no locale prefix.
 */
export function detectLocaleFromPath(path: string): Locale | null {
  const match = path.match(/^\/(ht|fr)(?:\/|$)/);
  return match ? (match[1] as Locale) : null;
}

/**
 * Strip locale prefix from path.
 *  '/ht/markets/abc' → '/markets/abc'
 *  '/ht'             → '/'
 */
export function stripLocale(path: string): string {
  return path.replace(/^\/(ht|fr)(?=\/|$)/, '') || '/';
}

/**
 * Swap locale in path while preserving the rest.
 *  swapLocale('ht', '/ht/konekte', 'fr') → '/fr/connexion'
 */
export function swapLocale(currentLocale: Locale, currentPath: string, newLocale: Locale): string {
  const stripped = stripLocale(currentPath);

  // Try to find the route key from the current path
  const segments = stripped.split('/').filter(Boolean);
  if (segments.length === 0) return `/${newLocale}`;

  const firstSeg = segments[0];
  const currentRoutes = ROUTES[currentLocale];

  // Find the route key that matches the first segment
  for (const [key, value] of Object.entries(currentRoutes)) {
    if (value === firstSeg && key !== 'home') {
      const newSeg = ROUTES[newLocale][key as keyof typeof ROUTES.ht];
      const tail = segments.slice(1).join('/');
      return `/${newLocale}/${newSeg}${tail ? '/' + tail : ''}`;
    }
  }

  // No match — keep path as-is (unknown route, but locale changed)
  return `/${newLocale}${stripped}`;
}

export default i18n;