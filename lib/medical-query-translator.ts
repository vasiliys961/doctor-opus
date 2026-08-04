const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const TRANSLATION_MODEL = process.env.MODEL_TRANSLATOR?.trim() || process.env.MODEL_GEMINI_FLASH?.trim() || 'google/gemini-3-flash';

const TRANSLATION_SYSTEM_PROMPT = `You translate clinical search requests for PubMed/Europe PMC.
Return only a short English medical search phrase with standard international terminology.
Expand common RU medical abbreviations into full English terms.
Return only the final phrase without quotes or explanations.`;

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
    return rawQuery;
  }
}
