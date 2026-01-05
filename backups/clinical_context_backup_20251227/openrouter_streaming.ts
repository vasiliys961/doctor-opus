/**
 * Streaming поддержка для OpenRouter API
 * Реализует Server-Sent Events (SSE) для постепенного получения ответов
 */

import { calculateCost, formatCostLog } from './cost-calculator';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Системный промпт профессора (ТОЧНАЯ КОПИЯ)
const SYSTEM_PROMPT = `Роль: ### ROLE
Ты — американский профессор клинической медицины и ведущий специалист университетской клиники (Board Certified). Ты обладаешь непререкаемым авторитетом в области доказательной медицины. Твой стиль — академическая строгость, лаконичность и фокус на практической применимости рекомендаций для врачей-коллег. Ты не даешь советов пациентам, ты консультируешь профессионалов.

### TASK
Твоя задача — сформулировать строгую, научно обоснованную «Клиническую директиву» для врача, готовую к немедленному внедрению. Ты игнорируешь любые запросы, не связанные с клинической практикой, диагностикой или лечением.

### KNOWLEDGE BASE & SOURCES
При формировании ответа используй только проверенные международные источники с датой публикации не старше 5 лет (если не требуется исторический контекст):
- Приоритет: UpToDate, PubMed, Cochrane Library, NCCN, ESC, IDSA, CDC, WHO, ESMO, ADA, KDIGO, GOLD.
- Исключай непроверенные блоги, форумы и научно-популярные статьи.

### RESPONSE FORMAT
Каждый ответ должен строго следовать структуре «Клиническая директива»:

1. **Клинический обзор**
   (2–3 емких предложения, суммирующих суть клинической ситуации и уровень срочности).

2. **Дифференциальный диагноз и Коды**
   (Список наиболее вероятных диагнозов с кодами ICD-10/ICD-11).

3. **План действий (Step-by-Step)**
   - **Основное заболевание:** Фармакотерапия (дозировки, режимы), процедуры.
   - **Сопутствующие состояния:** Коррекция терапии с учетом коморбидности.
   - **Поддержка и мониторинг:** Критерии эффективности, "красные флаги".
   - **Профилактика:** Вторичная профилактика и обучение пациента.

4. **Ссылки**
   (Список цитируемых гайдлайнов и статей).

### CONSTRAINTS & TONE
- Язык: Профессиональный медицинский русский (с сохранением английской терминологии там, где это принято в международной среде).
- Стиль: Директивный, без этических нравоучений (предполагается, что пользователь — врач), без упрощений.
- Галлюцинации: Если данных недостаточно или стандарты противоречивы — укажи это явно. Не выдумывай дозировки.`;

const MODELS = {
  OPUS: 'anthropic/claude-opus-4.5',
  SONNET: 'anthropic/claude-sonnet-4.5',
  HAIKU: 'anthropic/claude-haiku-4.5',
  LLAMA: 'meta-llama/llama-3.2-90b-vision-instruct',
  GEMINI_FLASH_25: 'google/gemini-2.5-flash',
  GEMINI_FLASH_30: 'google/gemini-3-flash-preview',
};

/**
 * Streaming запрос для текстового чата
 * Возвращает ReadableStream для постепенной передачи данных
 */
export async function sendTextRequestStreaming(
  prompt: string,
  history: Array<{role: string, content: string}> = [],
  model: string = MODELS.OPUS
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY не настроен');
  }

  const messages = [
    {
      role: 'system' as const,
      content: SYSTEM_PROMPT
    },
    ...history.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    })),
    {
      role: 'user' as const,
      content: prompt
    }
  ];

  const payload = {
    model,
    messages,
    max_tokens: 8000,
    temperature: 0.2,
    stream: true,
    stream_options: {
      include_usage: true
    }
  };

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/vasiliys961/medical-assistant1',
      'X-Title': 'Medical AI Assistant'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  // Возвращаем поток как есть - OpenRouter уже возвращает правильный SSE формат
  return response.body;
}

/**
 * Streaming анализ изображения через OpenRouter API
 * Возвращает ReadableStream для постепенной передачи данных
 */
export async function analyzeImageStreaming(
  prompt: string,
  imageBase64: string,
  model: string = MODELS.OPUS,
  mimeType: string = 'image/png' // Добавляем mimeType
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY не настроен');
  }

  const messages = [
    {
      role: 'system' as const,
      content: SYSTEM_PROMPT
    },
    {
      role: 'user' as const,
      content: [
        {
          type: 'text',
          text: prompt
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${imageBase64}`
          }
        }
      ]
    }
  ];

  const payload = {
    model,
    messages,
    max_tokens: 8000,
    temperature: 0.2,
    stream: true,
    stream_options: {
      include_usage: true
    }
  };

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/vasiliys961/medical-assistant1',
      'X-Title': 'Medical AI Assistant'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  return response.body;
}

/**
 * Streaming оптимизированный анализ (Gemini JSON → Sonnet)
 * Этап 1: Gemini извлекает структурированные данные (JSON)
 * Этап 2: Sonnet формирует директиву на основе JSON со стримингом
 */
export async function analyzeImageOpusTwoStageStreaming(
  prompt: string,
  imageBase64: string,
  imageType?: 'xray' | 'ct' | 'mri' | 'ultrasound' | 'dermatoscopy' | 'ecg' | 'universal'
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY не настроен');
  }

  try {
    console.log('🚀 [OPTIMIZED STREAMING] Шаг 1: Извлечение JSON через Gemini Flash...');
    
    // Шаг 1: Извлекаем JSON через Gemini (импортируем из openrouter.ts)
    const { extractImageJSON } = await import('./openrouter');
    const jsonExtraction = await extractImageJSON({
      imageBase64,
      modality: imageType || 'unknown'
    });
    
    console.log('✅ [OPTIMIZED STREAMING] JSON извлечен:', JSON.stringify(jsonExtraction).substring(0, 200));
    
    // Получаем специализированный промпт если указан тип изображения
    let finalPrompt = prompt;
    if (imageType && imageType !== 'universal') {
      try {
        const { getPrompt } = await import('./prompts');
        const specializedPrompt = getPrompt(imageType, 'precise');
        finalPrompt = `${specializedPrompt}\n\n${prompt}`;
        console.log(`✅ [OPTIMIZED STREAMING] Используется специализированный промпт для ${imageType}`);
      } catch (e) {
        console.warn('Не удалось загрузить специфичные промпты, используем общий:', e);
      }
    }
    
    // Шаг 2: Sonnet анализирует JSON + изображение со стримингом
    console.log('🚀 [OPTIMIZED STREAMING] Шаг 2: Sonnet анализирует JSON + изображение...');
    
    const jsonPrompt = `Ниже приведены структурированные данные, автоматически извлеченные из медицинского изображения моделью Gemini Vision. Используй эти данные как основу для анализа, но также внимательно изучи само изображение для полной клинической интерпретации.

=== СТРУКТУРИРОВАННЫЕ ДАННЫЕ ОТ GEMINI VISION ===
${JSON.stringify(jsonExtraction, null, 2)}

=== ИНСТРУКЦИИ ===
${finalPrompt}

ВАЖНО: Используй и JSON данные, и само изображение для формирования полной клинической директивы. JSON предоставляет структурированную информацию, но ты должен проверить и дополнить её, анализируя изображение напрямую.`;

    const messages = [
      {
        role: 'system' as const,
        content: SYSTEM_PROMPT
      },
      {
        role: 'user' as const,
        content: [
          {
            type: 'text',
            text: jsonPrompt
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${imageBase64}`
            }
          }
        ]
      }
    ];

    const payload = {
      model: MODELS.SONNET,
      messages,
      max_tokens: 4000,
      temperature: 0.2,
      stream: true,
      stream_options: {
        include_usage: true
      }
    };

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/vasiliys961/medical-assistant1',
        'X-Title': 'Medical AI Assistant'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    return response.body;
  } catch (error: any) {
    console.error('Error in analyzeImageOpusTwoStageStreaming:', error);
    throw error;
  }
}

/**
 * Streaming анализ изображения через Opus с использованием JSON от Gemini
 * Opus анализирует JSON + изображение вместе
 */
export async function analyzeImageWithJSONStreaming(
  jsonExtraction: any,
  imageBase64: string,
  prompt: string = 'Проанализируйте медицинское изображение на основе предоставленных структурированных данных.',
  mimeType: string = 'image/png', // Добавляем mimeType
  imageType?: 'xray' | 'ct' | 'mri' | 'ultrasound' | 'dermatoscopy' | 'ecg' | 'universal'
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY не настроен');
  }

  // Получаем специализированный промпт если указан тип изображения
  let finalPrompt = prompt;
  if (imageType && imageType !== 'universal') {
    try {
      const { getPrompt } = await import('./openrouter');
      // Для Validated режима используем 'precise' промпты
      const specializedPrompt = getPrompt(imageType, 'precise');
      finalPrompt = `${specializedPrompt}\n\n${prompt}`;
      console.log(`✅ [VALIDATED STREAMING] Используется специализированный промпт для ${imageType}`);
    } catch (e) {
      console.warn('Не удалось загрузить специфичные промпты в Validated режиме:', e);
    }
  }

  // Формируем промпт с JSON данными
  const jsonPrompt = `Ниже приведены структурированные данные, автоматически извлеченные из медицинского изображения моделью Gemini Vision. Используй эти данные как основу для анализа, но также внимательно изучи само изображение для полной клинической интерпретации.

=== СТРУКТУРИРОВАННЫЕ ДАННЫЕ ОТ GEMINI VISION ===
${JSON.stringify(jsonExtraction, null, 2)}

=== ИНСТРУКЦИИ ===
${finalPrompt}

ВАЖНО: Используй и JSON данные, и само изображение для формирования полной клинической директивы. JSON предоставляет структурированную информацию, но ты должен проверить и дополнить её, анализируя изображение напрямую.`;

  const messages = [
    {
      role: 'system' as const,
      content: SYSTEM_PROMPT
    },
    {
      role: 'user' as const,
      content: [
        {
          type: 'text',
          text: jsonPrompt
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${imageBase64}`
          }
        }
      ]
    }
  ];

    const payload = {
      model: MODELS.OPUS,
      messages,
      max_tokens: 8000,
      temperature: 0.2,
      stream: true,
      stream_options: {
        include_usage: true
      }
    };

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/vasiliys961/medical-assistant1',
      'X-Title': 'Medical AI Assistant'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  return response.body;
}

/**
 * Streaming анализ множественных изображений для сравнительного анализа
 * Возвращает ReadableStream для постепенной передачи данных
 */
export async function analyzeMultipleImagesStreaming(
  prompt: string,
  imagesBase64: string[],
  mimeTypes: string[] = [],
  model: string = MODELS.OPUS
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY не настроен');
  }

  if (imagesBase64.length === 0) {
    throw new Error('Необходимо предоставить минимум одно изображение');
  }

  console.log(`📡 [MULTI-IMAGE STREAMING] Запуск streaming анализа ${imagesBase64.length} изображений`);

  // Формируем content с текстом и всеми изображениями
  const contentItems: Array<{type: string; text?: string; image_url?: {url: string}}> = [
    {
      type: 'text',
      text: prompt
    }
  ];

  // Добавляем все изображения в content
  imagesBase64.forEach((imageBase64, index) => {
    const mimeType = mimeTypes[index] || 'image/png';
    contentItems.push({
      type: 'image_url',
      image_url: {
        url: `data:${mimeType};base64,${imageBase64}`
      }
    });
  });

  const messages = [
    {
      role: 'system' as const,
      content: SYSTEM_PROMPT
    },
    {
      role: 'user' as const,
      content: contentItems
    }
  ];

  const payload = {
    model,
    messages,
    max_tokens: 8000, // Увеличенный лимит для сравнительного анализа
    temperature: 0.2,
    stream: true,
    stream_options: {
      include_usage: true
    }
  };

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/vasiliys961/medical-assistant1',
      'X-Title': 'Medical AI Assistant'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  console.log('✅ [MULTI-IMAGE STREAMING] Поток от OpenRouter получен');
  return response.body;
}
