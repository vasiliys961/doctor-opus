import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE_NAME, type Locale } from './config';

export function getClientLocale(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  const raw = document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${LOCALE_COOKIE_NAME}=`))
    ?.split('=')[1];

  if (isLocale(raw)) return raw;
  return DEFAULT_LOCALE;
}
