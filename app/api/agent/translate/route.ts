import { NextRequest, NextResponse } from 'next/server'
import { isLocale } from '@/lib/i18n/config'

const OPENROUTER_DEFAULT_URL = 'https://openrouter.ai/api/v1/chat/completions'
const TRANSLATION_MODEL =
  process.env.MODEL_TRANSLATOR?.trim() ||
  process.env.MODEL_GEMINI_FLASH?.trim() ||
  'google/gemini-3-flash-preview'

const LOCALE_TO_LANGUAGE: Record<string, string> = {
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
}

function resolveApiUrl(): string {
  const baseUrl = process.env.OPENROUTER_BASE_URL?.trim()
  if (!baseUrl) return OPENROUTER_DEFAULT_URL
  return baseUrl.endsWith('/chat/completions')
    ? baseUrl
    : `${baseUrl.replace(/\/+$/, '')}/chat/completions`
}

function parseJsonTranslations(raw: string): string[] | null {
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.translations)) return null
    return parsed.translations.map((item: unknown) => String(item ?? '').trim())
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { locale, texts } = await request.json()

    if (!isLocale(locale)) {
      return NextResponse.json({ error: 'Invalid locale' }, { status: 400 })
    }

    if (!Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ error: 'Texts array is required' }, { status: 400 })
    }

    const normalized = texts
      .map((item) => String(item ?? '').trim())
      .filter(Boolean)
      .slice(0, 40)

    if (normalized.length === 0) {
      return NextResponse.json({ translations: [] })
    }

    if (locale === 'en') {
      return NextResponse.json({ translations: normalized })
    }

    const apiKey = process.env.OPENROUTER_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json({ translations: normalized })
    }

    const targetLanguage = LOCALE_TO_LANGUAGE[locale] || 'English'

    const response = await fetch(resolveApiUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: TRANSLATION_MODEL,
        temperature: 0,
        max_tokens: 4000,
        messages: [
          {
            role: 'system',
            content:
              `You are a medical UI translator. Translate each input text to ${targetLanguage}. ` +
              'Keep meaning precise, preserve emojis and punctuation, and do not add commentary. ' +
              'Return strict JSON: {"translations":["..."]} with the same item count and order as input.',
          },
          {
            role: 'user',
            content: JSON.stringify({ texts: normalized }),
          },
        ],
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ translations: normalized })
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content?.trim()
    if (!content) {
      return NextResponse.json({ translations: normalized })
    }

    const parsed = parseJsonTranslations(content)
    if (!parsed || parsed.length !== normalized.length) {
      return NextResponse.json({ translations: normalized })
    }

    return NextResponse.json({ translations: parsed })
  } catch {
    return NextResponse.json({ translations: [] })
  }
}

