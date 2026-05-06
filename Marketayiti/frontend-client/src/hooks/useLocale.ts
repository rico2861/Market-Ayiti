import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useMemo } from 'react';
import type { Locale } from '../types';
import { detectLocaleFromPath, swapLocale, localePath, ROUTES } from '../i18n';

export function useLocale() {
  const { i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const locale = useMemo<Locale>(
    () => detectLocaleFromPath(location.pathname) || (i18n.language?.slice(0, 2) as Locale) || 'ht',
    [location.pathname, i18n.language]
  );

  const changeLocale = useCallback((next: Locale) => {
    i18n.changeLanguage(next);
    const newPath = swapLocale(locale, location.pathname, next);
    navigate(newPath + location.search, { replace: true });
  }, [locale, location.pathname, location.search, i18n, navigate]);

  const path = useCallback(
    (key: keyof typeof ROUTES.ht, ...rest: (string | undefined)[]) => localePath(locale, key, ...rest),
    [locale]
  );

  return { locale, changeLocale, path };
}
