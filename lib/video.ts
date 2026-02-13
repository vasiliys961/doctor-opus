/**
 * Клиент OpenRouter для анализа медицинских видео
 * Двухфазный анализ:
 * 1) Gemini 3.0 Flash (Vision) — структурированное описание видео
 * 2) Gemini 3.0 Flash — текстовый клинический разбор по описанию
 *
 * Логика максимально близка к Python-клиенту `VideoClient.send_video_request_two_stage`,
 * но адаптирована под формат OpenRouter Chat Completions и под TypeScript.
 */

import { getDescriptionPrompt, getDirectivePrompt, getComparisonDescriptionPrompt, ImageType } from './prompts';

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

export interface AnalyzeTwoVideosOptions {
  prompt?: string;
  video1Base64: string;
  video2Base64: string;
  mimeType1?: string;
  mimeType2?: string;
  imageType?: ImageType;
  metadata?: Record<string, any> | null;
}

export interface AnalyzeVideoResult {
  description: string;
  analysis: string | null;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
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

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

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
    max_tokens: 10000, // Оптимизировано: описание видео-кадров
    temperature: 0.1,
  };

  const descriptionResponse = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://doctor-opus.ru',
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

  // Суммируем токены первого этапа
  if (descriptionData?.usage) {
    totalPromptTokens += descriptionData.usage.prompt_tokens || 0;
    totalCompletionTokens += descriptionData.usage.completion_tokens || 0;
  }

  // === ЭТАП 2. Gemini 3.0 Flash — клиническая директива ===
  // Используем личность Профессора
  const analysisPrompt = getDirectivePrompt(imageType, options.prompt);

  const analysisPayload = {
    model: MODELS.GEMINI_3_FLASH,
    messages: [
      {
        role: 'system' as const,
        content: "Ты — экспертный интеллектуальный ассистент с компетенциями профессора медицины с 30-летним стажем. Твои мнения точны, лаконичны и всегда следуют принципам доказательной медицины."
      },
      {
        role: 'user' as const,
        content: `На основе этого детального описания видео-исследования подготовь финальное заключение:\n\n${description}\n\n${analysisPrompt}`
      },
    ],
    max_tokens: 10000, // Оптимизировано: финальное заключение по видео
    temperature: 0.2,
  };

  const analysisResponse = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://doctor-opus.ru',
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

  // Суммируем токены второго этапа
  if (analysisData?.usage) {
    totalPromptTokens += analysisData.usage.prompt_tokens || 0;
    totalCompletionTokens += analysisData.usage.completion_tokens || 0;
  }

  return {
    description,
    analysis,
    usage: {
      prompt_tokens: totalPromptTokens,
      completion_tokens: totalCompletionTokens,
      total_tokens: totalPromptTokens + totalCompletionTokens
    }
  };
}

/**
 * Сравнительный анализ двух видео через OpenRouter (Gemini 3.0 + Gemini 3.0)
 */
export async function analyzeTwoVideosTwoStage(
  options: AnalyzeTwoVideosOptions
): Promise<AnalyzeVideoResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

  const imageType = options.imageType || 'universal';
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  // ЭТАП 1: Описание динамики
  const descPrompt = getComparisonDescriptionPrompt(imageType, undefined) + 
    (options.prompt ? `\n\nКОНТЕКСТ: ${options.prompt}` : '');
  
  const descriptionContent = [
    {
      type: 'video_url' as const,
      video_url: { url: `data:${options.mimeType1 || 'video/mp4'};base64,${options.video1Base64}` },
    },
    {
      type: 'video_url' as const,
      video_url: { url: `data:${options.mimeType2 || 'video/mp4'};base64,${options.video2Base64}` },
    },
    {
      type: 'text' as const,
      text: descPrompt,
    },
  ];

  const descriptionPayload = {
    model: MODELS.GEMINI_3_FLASH,
    messages: [{ role: 'user', content: descriptionContent }],
    max_tokens: 12000, // Оптимизировано: сравнительное описание двух видео
    temperature: 0.1,
  };

  const descriptionResponse = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://doctor-opus.ru',
      'X-Title': 'Doctor Opus',
    },
    body: JSON.stringify(descriptionPayload),
  });

  if (!descriptionResponse.ok) {
    throw new Error(`OpenRouter error (Stage 1): ${await descriptionResponse.text()}`);
  }

  const descriptionData = await descriptionResponse.json();
  const description = descriptionData?.choices?.[0]?.message?.content || 'Не удалось получить описание.';

  if (descriptionData?.usage) {
    totalPromptTokens += descriptionData.usage.prompt_tokens || 0;
    totalCompletionTokens += descriptionData.usage.completion_tokens || 0;
  }

  // ЭТАП 2: Финальное заключение Профессора
  const analysisPayload = {
    model: MODELS.GEMINI_3_FLASH,
    messages: [
      {
        role: 'system',
        content: "Ты — экспертный интеллектуальный ассистент с компетенциями профессора медицины. Проанализируй описание динамики двух видео и дай финальную клиническую директиву."
      },
      {
        role: 'user',
        content: `На основе сравнения двух видео:\n\n${description}\n\nСформулируй краткую и точную клиническую тактику.`
      },
    ],
    max_tokens: 10000, // Оптимизировано: клиническая тактика
    temperature: 0.2,
  };

  const analysisResponse = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://doctor-opus.ru',
      'X-Title': 'Doctor Opus',
    },
    body: JSON.stringify(analysisPayload),
  });

  if (!analysisResponse.ok) {
    throw new Error(`OpenRouter error (Stage 2): ${await analysisResponse.text()}`);
  }

  const analysisData = await analysisResponse.json();
  const analysis = analysisData?.choices?.[0]?.message?.content || 'Не удалось получить заключение.';

  if (analysisData?.usage) {
    totalPromptTokens += analysisData.usage.prompt_tokens || 0;
    totalCompletionTokens += analysisData.usage.completion_tokens || 0;
  }

  return {
    description,
    analysis,
    usage: {
      prompt_tokens: totalPromptTokens,
      completion_tokens: totalCompletionTokens,
      total_tokens: totalPromptTokens + totalCompletionTokens
    }
  };
}




