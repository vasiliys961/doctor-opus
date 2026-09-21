import { DEFAULT_LOCALE, isLocale, type Locale } from './config'

export const ASSEMBLYAI_LANGUAGE_BY_LOCALE: Record<Locale, string> = {
  en: 'en',
  es: 'es',
  fr: 'fr',
  ar: 'ar',
  hi: 'hi',
  'pt-BR': 'pt',
  id: 'id',
  ms: 'ms',
  tr: 'tr',
  'zh-CN': 'zh',
}

const SPEAKER_LABEL_BY_LOCALE: Record<Locale, string> = {
  en: 'Speaker',
  es: 'Hablante',
  fr: 'Interlocuteur',
  ar: 'المتحدث',
  hi: 'वक्ता',
  'pt-BR': 'Falante',
  id: 'Pembicara',
  ms: 'Penutur',
  tr: 'Konuşmacı',
  'zh-CN': '说话人',
}

const ASSEMBLYAI_LANGUAGE_CODES = new Set(Object.values(ASSEMBLYAI_LANGUAGE_BY_LOCALE))

export function mapLocaleToAssemblyAiLanguage(locale: Locale): string {
  return ASSEMBLYAI_LANGUAGE_BY_LOCALE[locale] || ASSEMBLYAI_LANGUAGE_BY_LOCALE[DEFAULT_LOCALE]
}

export function resolveAssemblyAiLanguage(raw?: string | null, fallbackLocale: Locale = DEFAULT_LOCALE): string {
  const value = String(raw || '').trim()
  if (isLocale(value)) return mapLocaleToAssemblyAiLanguage(value)
  if (ASSEMBLYAI_LANGUAGE_CODES.has(value)) return value
  return mapLocaleToAssemblyAiLanguage(fallbackLocale)
}

export function getSpeakerLabel(locale: Locale): string {
  return SPEAKER_LABEL_BY_LOCALE[locale] || SPEAKER_LABEL_BY_LOCALE.en
}

export function resolveSpeakerLocale(raw?: string | null, fallbackLocale: Locale = DEFAULT_LOCALE): Locale {
  const value = String(raw || '').trim()
  if (isLocale(value)) return value
  const matched = (Object.entries(ASSEMBLYAI_LANGUAGE_BY_LOCALE) as Array<[Locale, string]>)
    .find(([, code]) => code === value)
  return matched?.[0] || fallbackLocale
}
