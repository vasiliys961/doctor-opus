/**
 * Клиент OpenRouter для анализа медицинских видео
 * Двухфазный анализ:
 * 1) Gemini 3.0 Flash (Vision) — структурированное описание видео
 * 2) Gemini 3.0 Flash — текстовый клинический разбор по описанию
 *
 * Логика максимально близка к Python-клиенту `VideoClient.send_video_request_two_stage`,
 * но адаптирована под формат OpenRouter Chat Completions и под TypeScript.
 */

import { getDescriptionPrompt, getDirectivePrompt, ImageType } from './prompts';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const MODELS = {
  GEMINI_3_FLASH: 'google/gemini-3-flash-preview',
} as const;

export interface AnalyzeVideoOptions {
  /** Дополнительный текстовый контекст от пользователя */
  prompt?: string;
  /** Видео, закодированное в base64 (RAW байты файла) */
  videoBase64: string;
  /** MIME‑тип видео, например video/mp4 */
  mimeType?: string;
  /** Тип исследования (modality) */
  imageType?: ImageType;
  /** Дополнительные метаданные (возраст, срочность и т.д.) */
  metadata?: Record<string, any> | null;
}

export interface AnalyzeVideoResult {
  description: string;
  analysis: string | null;
}

/**
 * Двухэтапный анализ медицинского видео через OpenRouter (Gemini 3.0 + Gemini 3.0)
 * Использует личность Профессора для финального заключения.
 */
export async function analyzeVideoTwoStage(
  options: AnalyzeVideoOptions
): Promise<AnalyzeVideoResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY не настроен. Проверьте переменные окружения.');
  }

  const mimeType = options.mimeType || 'video/mp4';
  const imageType = options.imageType || 'universal';

  // === ЭТАП 1. Gemini 3.0 Flash — описание видео ===
  // Используем специализированный промпт для описания
  const descPrompt = getDescriptionPrompt(imageType) + 
    (options.prompt ? `\n\nДОПОЛНИТЕЛЬНЫЙ КОНТЕКСТ: ${options.prompt}` : '') +
    (options.metadata ? `\n\nМЕТАДАННЫЕ: ${JSON.stringify(options.metadata)}` : '');

  const descriptionContent = [
    {
      type: 'video_url' as const,
      video_url: {
        url: `data:${mimeType};base64,${options.videoBase64}`,
      },
    },
    {
      type: 'text' as const,
      text: descPrompt,
    },
  ];

  const descriptionPayload = {
    model: MODELS.GEMINI_3_FLASH,
    messages: [
      {
        role: 'user' as const,
        content: descriptionContent,
      },
    ],
    max_tokens: 4000,
    temperature: 0.1,
  };

  const descriptionResponse = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://doctor-opus.vercel.app',
      'X-Title': 'Doctor Opus',
    },
    body: JSON.stringify(descriptionPayload),
  });

  if (!descriptionResponse.ok) {
    const errorText = await descriptionResponse.text();
    throw new Error(`OpenRouter (Stage 1) error: ${descriptionResponse.status} - ${errorText}`);
  }

  const descriptionData = await descriptionResponse.json();
  const description = descriptionData?.choices?.[0]?.message?.content || 'Не удалось получить описание.';

  // === ЭТАП 2. Gemini 3.0 Flash — клиническая директива ===
  // Используем личность Профессора
  const analysisPrompt = getDirectivePrompt(imageType, options.prompt);

  const analysisPayload = {
    model: MODELS.GEMINI_3_FLASH,
    messages: [
      {
        role: 'system' as const,
        content: "Ты — американский профессор клинической медицины с 30-летним стажем. Твои заключения точны, лаконичны и всегда следуют принципам доказательной медицины."
      },
      {
        role: 'user' as const,
        content: `На основе этого детального описания видео-исследования подготовь финальное заключение:\n\n${description}\n\n${analysisPrompt}`
      },
    ],
    max_tokens: 4000,
    temperature: 0.2,
  };

  const analysisResponse = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://doctor-opus.vercel.app',
      'X-Title': 'Doctor Opus',
    },
    body: JSON.stringify(analysisPayload),
  });

  if (!analysisResponse.ok) {
    const errorText = await analysisResponse.text();
    throw new Error(`OpenRouter (Stage 2) error: ${analysisResponse.status} - ${errorText}`);
  }

  const analysisData = await analysisResponse.json();
  const analysis = analysisData?.choices?.[0]?.message?.content || 'Не удалось получить заключение.';

  return {
    description,
    analysis,
  };
}




