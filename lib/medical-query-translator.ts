// PubMed индексирует статьи на английском, а его "automatic term mapping"
// молча игнорирует кириллицу — вместо ошибки просто возвращает нерелевантную
// выдачу (см. querytranslation в ответе esearch). Поэтому для русскоязычных
// клинических запросов нужен явный перевод в англоязычный поисковый запрос
// с медицинской терминологией (MeSH-совместимой) перед вызовом PubMed.

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Быстрая/дешёвая модель — нужен только короткий поисковый запрос, не полноценный ответ.
const TRANSLATION_MODEL = 'google/gemini-3-flash-preview';

const TRANSLATION_SYSTEM_PROMPT = `Ты — переводчик медицинских поисковых запросов для PubMed.
Переведи запрос врача на английский язык в виде краткой поисковой фразы с использованием
стандартной международной медицинской терминологии (расшифровывай русские аббревиатуры,
например СКВ -> systemic lupus erythematosus). Выведи ТОЛЬКО итоговую поисковую фразу
на английском, без кавычек, без пояснений, без знаков препинания в конце.`;

type CacheRecord = {
  expiresAt: number;
  translated: string;
};

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, CacheRecord>();

function hasCyrillic(text: string): boolean {
  return /[а-яёА-ЯЁ]/.test(text);
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

/**
 * Переводит клинический запрос врача в англоязычный поисковый запрос для PubMed.
 * Если запрос уже на латинице (нет кириллицы) — переводить не нужно, возвращаем как есть.
 * При любой ошибке/таймауте перевода — безопасный fallback на исходный запрос
 * (сохраняет прежнее поведение, а не ломает поиск целиком).
 */
export async function translateToEnglishForPubMed(
  rawQuery: string,
  timeoutMs: number = 4000
): Promise<string> {
  if (!hasCyrillic(rawQuery)) return rawQuery;

  const cacheKey = rawQuery.trim().toLowerCase();
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.translated;
  }

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return rawQuery;

  try {
    const response = await fetchWithTimeout(
      OPENROUTER_API_URL,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: TRANSLATION_MODEL,
          messages: [
            { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
            { role: 'user', content: rawQuery },
          ],
          max_tokens: 60,
          temperature: 0,
        }),
      },
      timeoutMs
    );

    if (!response.ok) return rawQuery;

    const data = await response.json();
    const translated = data?.choices?.[0]?.message?.content
      ?.replace(/["'.]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!translated) return rawQuery;

    cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, translated });
    return translated;
  } catch {
    // Недоступность переводчика не должна ронять весь RAG-пайплайн.
    return rawQuery;
  }
}
