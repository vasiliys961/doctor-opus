/**
 * Клиент OpenRouter для анализа медицинских видео
 * Двухфазный анализ:
 * 1) Gemini 2.5 Flash (Vision) — структурированное описание видео
 * 2) Gemini 3 Flash — текстовый клинический разбор по описанию
 *
 * Логика максимально близка к Python-клиенту `VideoClient.send_video_request_two_stage`,
 * но адаптирована под формат OpenRouter Chat Completions и под TypeScript.
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const MODELS = {
  GEMINI_FLASH_25: 'google/gemini-2.5-flash',
  GEMINI_FLASH_30: 'google/gemini-3-flash-preview',
} as const;

export interface AnalyzeVideoOptions {
  /** Дополнительный текстовый контекст от пользователя */
  prompt?: string;
  /** Видео, закодированное в base64 (RAW байты файла) */
  videoBase64: string;
  /** MIME‑тип видео, например video/mp4 */
  mimeType?: string;
  /** Тип исследования (fgds, colonoscopy, echo, chest_ct и т.п.) */
  studyType?: string | null;
  /** Дополнительные метаданные (возраст, срочность и т.д.) */
  metadata?: Record<string, any> | null;
}

export interface AnalyzeVideoResult {
  description: string;
  analysis: string | null;
}

/**
 * Двухэтапный анализ медицинского видео через OpenRouter (Gemini 2.5 + Gemini 3)
 */
export async function analyzeVideoTwoStage(
  options: AnalyzeVideoOptions
): Promise<AnalyzeVideoResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY не настроен. Проверьте переменные окружения.');
  }

  const mimeType = options.mimeType || 'video/mp4';

  // === ЭТАП 1. Gemini 2.5 Flash — описание видео ===

  let descPrompt = `Ты — врач-специалист по интерпретации медицинских видео.
По представленному видео выполни ПОДРОБНОЕ, но КОМПАКТНОЕ ОПИСАНИЕ без формулировки окончательного диагноза и без плана лечения.

Структура описания (строго по пунктам, без таблиц):
1) ТЕХНИЧЕСКОЕ КАЧЕСТВО И ТИП ИССЛЕДОВАНИЯ:
   - что исследуется, качество видео, артефакты, видимость структур.
2) ДИНАМИЧЕСКИЕ ИЗМЕНЕНИЯ И НАБЛЮДАЕМЫЕ ПРОЦЕССЫ:
   - опиши только реально видимые значимые изменения, движения, функциональные тесты, патологические процессы в динамике.
3) КРИТИЧЕСКИЕ/ОСТРЫЕ НАХОДКИ (если есть):
   - признаки острой патологии, требующей срочного внимания.
4) ВРЕМЕННЫЕ ХАРАКТЕРИСТИКИ:
   - важные моменты с указанием времени (если возможно), последовательность событий.

ВАЖНО:
- НЕ формулируй окончательный диагноз и НЕ давай клинический план.
- Пиши связным текстом и короткими списками, без таблиц и без раздела «источники/ссылки».
- Сделай полный проход по всем пунктам, не обрывай описание на середине.`;

  if (options.studyType && options.studyType.trim()) {
    // Здесь можно подключить специализированные промпты для видео по типу исследования.
    // Пока ограничимся тем, что просто добавим тип исследования в контекст.
    descPrompt += `\n\nТип исследования: ${options.studyType}`;
  }

  if (options.prompt && options.prompt.trim()) {
    descPrompt += `\n\nДОПОЛНИТЕЛЬНЫЙ КОНТЕКСТ:\n${options.prompt.trim()}`;
  }

  if (options.metadata && Object.keys(options.metadata).length > 0) {
    descPrompt += `\n\nМЕТАДАННЫЕ:\n${JSON.stringify(options.metadata, null, 2)}`;
  }

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
    model: MODELS.GEMINI_FLASH_25,
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
      'HTTP-Referer': 'https://github.com/vasiliys961/medical-assistant1',
      'X-Title': 'Medical AI Assistant',
    },
    body: JSON.stringify(descriptionPayload),
  });

  if (!descriptionResponse.ok) {
    const errorText = await descriptionResponse.text();
    throw new Error(
      `OpenRouter (Gemini 2.5 Flash) error: ${descriptionResponse.status} - ${errorText.substring(
        0,
        500,
      )}`,
    );
  }

  const descriptionData = await descriptionResponse.json();
  const description =
    descriptionData?.choices?.[0]?.message?.content ||
    'Не удалось получить описание видео от Gemini.';

  // Если нужен только description, можно было бы вернуть здесь, но в нашем UI всегда делаем оба этапа

  // === ЭТАП 2. Gemini 3 Flash — клинический анализ по описанию ===

  const analysisPrompt = `Ниже приведено текстовое описание медицинского видео, автоматически полученное из видео Vision‑моделью Gemini.
На его основе выполни полный, но КОМПАКТНЫЙ клинический анализ и сформируй директиву для врача.

Структура ответа:
1) Клинический обзор (2–3 предложения, включая оценку срочности и приоритет госпитализации/наблюдения).
2) Ключевые находки по структурам и процессам в видео (ТОЛЬКО реально выявленные изменения).
3) Итоговый диагноз(ы) с основными кодами МКБ‑10 (кратко, без длинных расшифровок).
4) Краткий план действий: дообследования, необходимость консультаций, основные шаги лечения.

Не пиши длинные лекции, не перечисляй всё, что в норме — указывай только клинически важные отклонения и выводы.
НЕ добавляй разделы со списками источников, ссылок или 'лог веб‑запросов'.`;

  const analysisMessages = [
    {
      role: 'user' as const,
      content: [
        {
          type: 'text' as const,
          text:
            `=== ОПИСАНИЕ ВИДЕО ОТ GEMINI VISION ===\n${description}\n\n` +
            analysisPrompt,
        },
      ],
    },
  ];

  const analysisPayload = {
    model: MODELS.GEMINI_FLASH_30,
    messages: analysisMessages,
    max_tokens: 4000,
    temperature: 0.2,
  };

  const analysisResponse = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/vasiliys961/medical-assistant1',
      'X-Title': 'Medical AI Assistant',
    },
    body: JSON.stringify(analysisPayload),
  });

  if (!analysisResponse.ok) {
    const errorText = await analysisResponse.text();
    throw new Error(
      `OpenRouter (Gemini 3 Flash) error: ${analysisResponse.status} - ${errorText.substring(
        0,
        500,
      )}`,
    );
  }

  const analysisData = await analysisResponse.json();
  const analysis =
    analysisData?.choices?.[0]?.message?.content ||
    'Не удалось получить клиническое заключение от Gemini.';

  return {
    description,
    analysis,
  };
}




