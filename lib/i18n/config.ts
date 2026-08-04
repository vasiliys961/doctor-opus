export const SUPPORTED_LOCALES = [
  'en',
  'es',
  'fr',
  'ar',
  'hi',
  'pt-BR',
  'id',
  'ms',
  'tr',
  'zh-CN',
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_COOKIE_NAME = 'opus-ui-locale';

export const RTL_LOCALES: ReadonlySet<Locale> = new Set(['ar']);

export function isLocale(value: string | null | undefined): value is Locale {
  if (!value) return false;
  return SUPPORTED_LOCALES.includes(value as Locale);
}
