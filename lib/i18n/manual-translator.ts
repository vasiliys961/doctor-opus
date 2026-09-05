import { createHash } from 'crypto';
import type { Locale } from './config';
import { getLlmApiKey, getLlmChatCompletionsUrl } from '../llm-provider';

function resolveTranslationApiUrl(): string {
  return getLlmChatCompletionsUrl();
}
const TRANSLATION_MODEL =
  process.env.MODEL_TRANSLATOR?.trim() ||
  process.env.MODEL_GEMINI_FLASH?.trim() ||
  'google/gemini-3.8-flash';

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

type CacheRecord = {
  expiresAt: number;
  translated: string;
};

const cache = new Map<string, CacheRecord>();

const LOCALE_TO_LANGUAGE: Record<Locale, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  ar: 'Arabic',
  hi: 'Hindi',
  'pt-BR': 'Brazilian Portuguese',
  id: 'Indonesian',
  ms: 'Malay',
  tr: 'Turkish',
  'zh-CN': 'Simplified Chinese',
};

function buildCacheKey(locale: Locale, content: string): string {
  const hash = createHash('sha1').update(content).digest('hex');
  return `${locale}:${hash}`;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function translateMarkdown(
  content: string,
  targetLanguage: string,
  timeoutMs: number
): Promise<string | null> {
  let apiKey = '';
  try {
    apiKey = getLlmApiKey();
  } catch {
    return null;
  }

  const systemPrompt = `You are a professional medical technical translator.
Translate the user-provided Markdown from English to ${targetLanguage}.
Strict requirements:
- Preserve Markdown structure exactly (headings, bullets, numbering, tables, links, emphasis, emojis, separators).
- Keep all medical meaning precise and legally safe.
- Do not add, remove, summarize, or reinterpret content.
- Keep abbreviations and units accurate.
- Return only translated Markdown.`;

  const response = await fetchWithTimeout(
    resolveTranslationApiUrl(),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: TRANSLATION_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content },
        ],
        temperature: 0,
        max_tokens: 16000,
      }),
    },
    timeoutMs
  );

  if (!response.ok) return null;
  const data = await response.json();
  const translated = data?.choices?.[0]?.message?.content?.trim();
  if (!translated) return null;
  return translated;
}

export async function getManualContentForLocale(
  locale: Locale,
  englishMarkdown: string
): Promise<string> {
  if (locale === 'en') return englishMarkdown;

  const cacheKey = buildCacheKey(locale, englishMarkdown);
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.translated;
  }

  const targetLanguage = LOCALE_TO_LANGUAGE[locale] || 'English';
  try {
    const translated = await translateMarkdown(englishMarkdown, targetLanguage, 30000);
    if (!translated) return englishMarkdown;
    cache.set(cacheKey, {
      translated,
      expiresAt: now + CACHE_TTL_MS,
    });
    return translated;
  } catch {
    return englishMarkdown;
  }
}

