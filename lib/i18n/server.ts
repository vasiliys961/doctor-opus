import { cookies, headers } from 'next/headers';
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_COOKIE_NAME,
  type Locale,
} from './config';

const languageToLocale: Record<string, Locale> = {
  en: 'en',
  es: 'es',
  fr: 'fr',
  ar: 'ar',
  hi: 'hi',
  pt: 'pt-BR',
  'pt-br': 'pt-BR',
  id: 'id',
  ms: 'ms',
  tr: 'tr',
  zh: 'zh-CN',
  'zh-cn': 'zh-CN',
};

function mapLanguageTag(input: string): Locale | null {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;
  if (isLocale(input)) return input;
  if (languageToLocale[normalized]) return languageToLocale[normalized];
  const base = normalized.split('-')[0];
  return languageToLocale[base] ?? null;
}

function detectFromAcceptLanguage(acceptLanguage: string | null): Locale | null {
  if (!acceptLanguage) return null;
  const chunks = acceptLanguage.split(',');
  for (const chunk of chunks) {
    const tag = chunk.split(';')[0];
    const mapped = mapLanguageTag(tag);
    if (mapped) return mapped;
  }
  return null;
}

export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (isLocale(cookieLocale)) {
    return cookieLocale;
  }

  const headerStore = await headers();
  return detectFromAcceptLanguage(headerStore.get('accept-language')) ?? DEFAULT_LOCALE;
}
