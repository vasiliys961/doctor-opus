import { buildForcedResponseLanguageInstruction, type ResponseLanguageCode } from '@/lib/language-policy';
import { getRequestLocale } from '@/lib/i18n/server';
import type { Locale } from '@/lib/i18n/config';

export function mapLocaleToResponseLanguage(locale: Locale): ResponseLanguageCode {
  switch (locale) {
    case 'fr':
      return 'fr';
    case 'es':
      return 'es';
    case 'ar':
      return 'ar';
    case 'hi':
      return 'hi';
    case 'pt-BR':
      return 'pt-br';
    case 'id':
      return 'id';
    case 'ms':
      return 'ms';
    case 'tr':
      return 'tr';
    case 'zh-CN':
      return 'zh';
    case 'en':
    default:
      return 'en';
  }
}

export async function getForcedLanguageInstructionForRequest(): Promise<string> {
  const locale = await getRequestLocale();
  return buildForcedResponseLanguageInstruction(mapLocaleToResponseLanguage(locale));
}

export function appendLanguageInstruction(prompt: string, languageInstruction: string): string {
  const base = String(prompt || '').trim();
  if (!base) return languageInstruction;
  return `${base}\n\n${languageInstruction}`;
}
