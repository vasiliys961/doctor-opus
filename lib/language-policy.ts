export type ResponseLanguageCode =
  | 'en'
  | 'ru'
  | 'ar'
  | 'hi'
  | 'es'
  | 'fr'
  | 'zh'
  | 'ms'
  | 'id'
  | 'pt-br'
  | 'tr';

const RESPONSE_LANGUAGE_LABELS: Record<ResponseLanguageCode, string> = {
  en: 'English',
  ru: 'Russian',
  ar: 'Arabic',
  hi: 'Hindi',
  es: 'Spanish',
  fr: 'French',
  zh: 'Chinese',
  ms: 'Malay',
  id: 'Indonesian',
  'pt-br': 'Portuguese (Brazil)',
  tr: 'Turkish',
};

export function buildAutoResponseLanguageInstruction(detectedLanguage?: string): string {
  const base = `RESPONSE LANGUAGE:
- Reply in the same language as the user's latest message.
- If the user explicitly asks for a specific language, follow that request.
- If the message is mixed-language, use the dominant language of the user's latest message.
- Keep wording professional, clinically precise, and sufficiently detailed for medical decision support.
- Preserve standard international medical terminology where appropriate.`;

  return detectedLanguage ? `${base}\n- Current message appears to be in ${detectedLanguage}.` : base;
}

export function buildForcedResponseLanguageInstruction(language: ResponseLanguageCode): string {
  const label = RESPONSE_LANGUAGE_LABELS[language];
  return `RESPONSE LANGUAGE:
- Reply strictly in ${label}.
- If the user asks for another language, still keep the final answer in ${label} unless they explicitly change the response language setting.
- Keep wording professional, clinically precise, and sufficiently detailed for medical decision support.
- Preserve standard international medical terminology where appropriate.`;
}

export function buildStrictOutputLanguageRule(language: 'english' | 'russian'): string {
  return language === 'english'
    ? 'Output language: English only.'
    : 'Output language: Russian only.';
}

export function buildStrictOutputLanguageInstruction(language: 'english' | 'russian'): string {
  if (language === 'english') {
    return `OUTPUT LANGUAGE POLICY:
- Final answer must be in English only.
- Ignore non-English wording in user input/examples for output language choice.
- If any non-English text appears, rewrite it to English before finalizing.`;
  }

  return `OUTPUT LANGUAGE POLICY:
- Final answer must be in Russian only.
- Ignore non-Russian wording in user input/examples for output language choice.
- If any non-Russian text appears, rewrite it to Russian before finalizing.`;
}
