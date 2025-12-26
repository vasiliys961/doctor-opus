/**
 * OpenRouter API клиент для анализа медицинских изображений
 * Переписанная версия Python логики из claude_assistant/vision_client.py
 * Сохраняет всю диагностическую логику без изменений
 */

import { calculateCost, formatCostLog } from './cost-calculator';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// В Next.js 14 и Vercel используется встроенный fetch из Node.js 18+
// fetch доступен глобально в serverless функциях Vercel

// Системный промпт профессора (ТОЧНАЯ КОПИЯ из claude_assistant/diagnostic_prompts.py)
export const SYSTEM_PROMPT = `Роль: ### ROLE
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

5. **Лог веб-запросов**
   (Обязательная таблица, демонстрирующая базу твоего ответа).
   | Запрос | Дата источника | Источник (Орг/Журнал) | Название статьи/Гайдлайна | DOI/URL (если есть) | Комментарий |
   | --- | --- | --- | --- | --- | --- |

### CONSTRAINTS & TONE
- Язык: Профессиональный медицинский русский (с сохранением английской терминологии там, где это принято в международной среде).
- Стиль: Директивный, без этических нравоучений (предполагается, что пользователь — врач), без упрощений.
- Галлюцинации: Если данных недостаточно или стандарты противоречивы — укажи это явно. Не выдумывай дозировки.`;

// Актуальные модели (ТОЧНАЯ КОПИЯ из vision_client.py)
export const MODELS = {
  OPUS: 'anthropic/claude-opus-4.5',                // Opus 4.5 — основной клинический ассистент
  SONNET: 'anthropic/claude-sonnet-4.5',            // Sonnet 4.5 — быстрый fallback
  HAIKU: 'anthropic/claude-haiku-4.5',             // Haiku 4.5 — быстрый анализ документов
  LLAMA: 'meta-llama/llama-3.2-90b-vision-instruct', // Llama 3.2 90B Vision — резерв
  GEMINI_FLASH_25: 'google/gemini-2.5-flash',      // Gemini Flash 2.5 — быстрый анализ
  GEMINI_FLASH_30: 'google/gemini-3-flash-preview'  // Gemini Flash 3.0 — новая версия
};

const MODELS_LIST = [
  MODELS.OPUS,
  MODELS.SONNET,
  MODELS.HAIKU,
  MODELS.LLAMA
];

export type AnalysisMode = 'fast' | 'precise' | 'validated';
export type ModelType = 'opus' | 'gemini' | 'sonnet' | 'haiku';

interface VisionRequestOptions {
  prompt: string;
  imageBase64: string;
  model?: string;
  maxTokens?: number;
  mode?: AnalysisMode;
  useStreaming?: boolean;
}

interface StreamingOptions {
  prompt: string;
  imageBase64?: string;
  model?: string;
  mode?: AnalysisMode;
  history?: Array<{role: string, content: string}>;
}

/**
 * Анализ медицинского изображения через OpenRouter API
 * Использует ту же логику, что и Python vision_client.py
 */
export async function analyzeImage(options: VisionRequestOptions): Promise<string> {
  // В Next.js API routes переменные окружения доступны через process.env
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY не найден в переменных окружения');
    throw new Error('OPENROUTER_API_KEY не настроен. Проверьте настройки Vercel.');
  }

  // Выбираем модель в зависимости от режима
  let model = options.model;
  if (!model) {
    if (options.mode === 'fast') {
      model = MODELS.GEMINI_FLASH_30; // Gemini Flash 3.0 для быстрого анализа
    } else {
      // Проверяем, является ли это сканированием документа
      const isDocumentScan = options.prompt?.toLowerCase().includes('отсканируйте') || 
                            options.prompt?.toLowerCase().includes('сканирование') ||
                            options.prompt?.toLowerCase().includes('извлеките текст') ||
                            options.prompt?.toLowerCase().includes('ocr');
      if (isDocumentScan) {
        model = MODELS.HAIKU; // Haiku 4.5 для сканирования документов
      } else {
        model = MODELS.OPUS; // Opus 4.5 для точного анализа
      }
    }
  }
  const prompt = options.prompt || 'Проанализируйте медицинское изображение.';
  
  // Определяем, является ли это сканированием документа (для OCR system prompt не нужен)
  const isDocumentScan = prompt.toLowerCase().includes('отсканируйте') || 
                        prompt.toLowerCase().includes('сканирование') ||
                        prompt.toLowerCase().includes('извлеките текст') ||
                        prompt.toLowerCase().includes('ocr');
  
  // Формируем messages для OpenRouter API
  const messages = isDocumentScan ? [
    // Для сканирования документов system prompt не используется
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
            url: `data:image/png;base64,${options.imageBase64}`
          }
        }
      ]
    }
  ] : [
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
            url: `data:image/png;base64,${options.imageBase64}`
          }
        }
      ]
    }
  ];

  const payload = {
    model,
    messages,
    max_tokens: options.maxTokens || 4000,
    temperature: 0.2
  };

  try {
    // Логируем для отладки (без ключа)
    console.log('Calling OpenRouter API:', {
      url: OPENROUTER_API_URL,
      model: model,
      hasApiKey: !!apiKey,
      apiKeyPrefix: apiKey.substring(0, 10) + '...',
      payloadSize: JSON.stringify(payload).length,
      imageSize: options.imageBase64.length
    });

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

    console.log('OpenRouter API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error response:', errorText);
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText.substring(0, 500)}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid response format:', JSON.stringify(data).substring(0, 500));
      throw new Error('Неверный формат ответа от OpenRouter API');
    }

    // Логирование токенов и стоимости
    const tokensUsed = data.usage?.total_tokens || 0;
    const inputTokens = data.usage?.prompt_tokens || Math.floor(tokensUsed / 2);
    const outputTokens = data.usage?.completion_tokens || Math.floor(tokensUsed / 2);
    
    if (tokensUsed > 0) {
      console.log(`✅ [${model}] Запрос завершен`);
      console.log(`   📊 ${formatCostLog(model, inputTokens, outputTokens, tokensUsed)}`);
    }

    return data.choices[0].message.content || '';
  } catch (error: any) {
    console.error('Error calling OpenRouter API:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.substring(0, 500)
    });
    
    // Обработка разных типов ошибок
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new Error('Превышено время ожидания ответа от OpenRouter API. Попробуйте позже.');
    }
    
    if (error.message.includes('fetch failed') || error.message.includes('network') || error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      throw new Error('Ошибка сети при обращении к OpenRouter API. Проверьте подключение к интернету и настройки Vercel.');
    }
    
    throw new Error(`Ошибка анализа изображения: ${error.message}`);
  }
}

/**
 * Быстрый анализ изображения через Gemini Flash
 * Двухэтапный анализ: сначала Gemini Flash описывает изображение, затем Gemini 3.0 анализирует текст
 * Использует специфичные промпты для каждого типа изображения
 */
export async function analyzeImageFast(options: { 
  prompt: string; 
  imageBase64: string;
  imageType?: 'xray' | 'ct' | 'mri' | 'ultrasound' | 'dermatoscopy' | 'ecg' | 'universal';
}): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY не найден в переменных окружения');
    throw new Error('OPENROUTER_API_KEY не настроен. Проверьте настройки Vercel.');
  }

  // Импортируем промпты для специфичных типов изображений
  let descriptionPrompt = options.prompt || 'Проанализируйте медицинское изображение.';
  let analysisPrompt = 'На основе приведённого выше описания медицинского изображения выполни экспертный анализ и сформируй КРАТКУЮ, но информативную клиническую директиву для врача.';
  
  // Используем специфичные промпты если указан тип изображения
  if (options.imageType && options.imageType !== 'universal') {
    try {
      const { getPrompt, getFastAnalysisPrompt } = await import('./prompts');
      descriptionPrompt = getPrompt(options.imageType, 'fast');
      analysisPrompt = getFastAnalysisPrompt(options.imageType);
    } catch (e) {
      console.warn('Не удалось загрузить специфичные промпты, используем общий:', e);
    }
  }
  
  // Шаг 1: Gemini 2.5 Flash описывает изображение
  const visionModel = MODELS.GEMINI_FLASH_25;
  
  const visionMessages = [
    {
      role: 'user' as const,
      content: [
        {
          type: 'text',
          text: descriptionPrompt
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${options.imageBase64}`
          }
        }
      ]
    }
  ];

  const visionPayload = {
    model: visionModel,
    messages: visionMessages,
    max_tokens: 4000,
    temperature: 0.1
  };

  try {
    console.log('🚀 [FAST] Шаг 1: Gemini Flash описывает изображение...');
    
    const visionResponse = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/vasiliys961/medical-assistant1',
        'X-Title': 'Medical AI Assistant'
      },
      body: JSON.stringify(visionPayload)
    });

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      throw new Error(`OpenRouter API error: ${visionResponse.status} - ${errorText.substring(0, 500)}`);
    }

    const visionData = await visionResponse.json();
    const description = visionData.choices[0].message.content || '';
    
    // Логирование токенов и стоимости для шага 1
    const visionTokensUsed = visionData.usage?.total_tokens || 0;
    const visionInputTokens = visionData.usage?.prompt_tokens || Math.floor(visionTokensUsed / 2);
    const visionOutputTokens = visionData.usage?.completion_tokens || Math.floor(visionTokensUsed / 2);
    
    console.log('✅ [FAST] Шаг 1 завершен, длина описания:', description.length);
    if (visionTokensUsed > 0) {
      console.log(`   📊 ${formatCostLog(visionModel, visionInputTokens, visionOutputTokens, visionTokensUsed)}`);
    }
    
    // Шаг 2: Gemini 3.0 анализирует описание
    const textModel = MODELS.GEMINI_FLASH_30;
    
    const textMessages = [
      {
        role: 'user' as const,
        content: `Ниже приведено текстовое описание медицинского изображения, автоматически полученное из изображения Vision‑моделью Gemini. На его основе выполни полный анализ и сформируй клиническую директиву для врача.\n\n=== ОПИСАНИЕ ОТ GEMINI VISION ===\n${description}\n\n${analysisPrompt}`
      }
    ];

    const textPayload = {
      model: textModel,
      messages: textMessages,
      max_tokens: 4000,
      temperature: 0.2
    };

    console.log('🚀 [FAST] Шаг 2: Gemini 3.0 анализирует описание...');
    
    const textResponse = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/vasiliys961/medical-assistant1',
        'X-Title': 'Medical AI Assistant'
      },
      body: JSON.stringify(textPayload)
    });

    if (!textResponse.ok) {
      const errorText = await textResponse.text();
      throw new Error(`OpenRouter API error: ${textResponse.status} - ${errorText.substring(0, 500)}`);
    }

    const textData = await textResponse.json();
    const result = textData.choices[0].message.content || '';
    
    // Логирование токенов и стоимости для шага 2
    const textTokensUsed = textData.usage?.total_tokens || 0;
    const textInputTokens = textData.usage?.prompt_tokens || Math.floor(textTokensUsed / 2);
    const textOutputTokens = textData.usage?.completion_tokens || Math.floor(textTokensUsed / 2);
    
    console.log('✅ [FAST] Шаг 2 завершен, длина результата:', result.length);
    if (textTokensUsed > 0) {
      console.log(`   📊 ${formatCostLog(textModel, textInputTokens, textOutputTokens, textTokensUsed)}`);
    }
    
    return result;
  } catch (error: any) {
    console.error('Error in analyzeImageFast:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.substring(0, 500)
    });
    
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new Error('Превышено время ожидания ответа от OpenRouter API. Попробуйте позже.');
    }
    
    if (error.message.includes('fetch failed') || error.message.includes('network') || error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      throw new Error('Ошибка сети при обращении к OpenRouter API. Проверьте подключение к интернету и настройки Vercel.');
    }
    
    throw new Error(`Ошибка быстрого анализа изображения: ${error.message}`);
  }
}

/**
 * Оптимизированный двухшаговый Opus анализ (Vision → Text)
 * Этап 1: Opus Vision описывает изображение коротким промптом (без system prompt) - экономия токенов
 * Этап 2: Opus Text формирует детальную клиническую директиву на основе описания
 * 
 * Экономия: ~50% по сравнению с прямым Opus Vision анализом
 */
export async function analyzeImageOpusTwoStage(options: { prompt: string; imageBase64: string }): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY не настроен');
  }

  const prompt = options.prompt || 'Проанализируйте медицинское изображение.';
  
  // Шаг 1: Opus Vision описывает изображение коротким промптом (БЕЗ system prompt для экономии)
  const visionModel = MODELS.OPUS;
  
  // Короткий промпт для описания (без system prompt - экономия ~800 токенов)
  const shortDescriptionPrompt = `Ты — эксперт-радиолог/кардиолог. По изображению выполни ПОДРОБНОЕ, но КОМПАКТНОЕ ОПИСАНИЕ без финального диагноза.

${prompt}

ВАЖНО:
- НЕ формулируй окончательный диагноз и НЕ давай клинический план.
- Пиши связным текстом и короткими списками, без таблиц.
- Опиши все видимые находки, локализацию, размеры, плотность, контуры.`;

  const visionMessages = [
    // БЕЗ system prompt - экономия токенов!
    {
      role: 'user' as const,
      content: [
        {
          type: 'text',
          text: shortDescriptionPrompt
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${options.imageBase64}`,
            detail: 'low' // LOW resolution для дополнительной экономии
          }
        }
      ]
    }
  ];

  const visionPayload = {
    model: visionModel,
    messages: visionMessages,
    max_tokens: 2000, // Ограничиваем токены для экономии
    temperature: 0.1
  };

  try {
    console.log('🚀 [OPUS TWO-STAGE] Шаг 1: Opus Vision описывает изображение (короткий промпт, без system prompt)...');
    
    const visionResponse = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/vasiliys961/medical-assistant1',
        'X-Title': 'Medical AI Assistant'
      },
      body: JSON.stringify(visionPayload)
    });

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      throw new Error(`OpenRouter API error: ${visionResponse.status} - ${errorText.substring(0, 500)}`);
    }

    const visionData = await visionResponse.json();
    const description = visionData.choices[0].message.content || '';
    
    // Логирование токенов и стоимости для шага 1
    const visionTokensUsed = visionData.usage?.total_tokens || 0;
    const visionInputTokens = visionData.usage?.prompt_tokens || Math.floor(visionTokensUsed / 2);
    const visionOutputTokens = visionData.usage?.completion_tokens || Math.floor(visionTokensUsed / 2);
    
    console.log('✅ [OPUS TWO-STAGE] Шаг 1 завершен, длина описания:', description.length);
    if (visionTokensUsed > 0) {
      console.log(`   📊 ${formatCostLog(visionModel, visionInputTokens, visionOutputTokens, visionTokensUsed)}`);
    }
    
    // Шаг 2: Текстовый Opus анализирует описание и формирует директиву
    const textModel = MODELS.OPUS;
    
    const textMessages = [
      {
        role: 'system' as const,
        content: SYSTEM_PROMPT // Используем system prompt только на втором этапе
      },
      {
        role: 'user' as const,
        content: `Ниже приведено текстовое описание медицинского изображения, автоматически полученное из изображения Vision‑моделью Opus. На его основе выполни полный анализ и сформируй детальную клиническую директиву для врача.

=== ОПИСАНИЕ ОТ OPUS VISION ===
${description}

${prompt}

Сформируй полную клиническую директиву на основе этого описания.`
      }
    ];

    const textPayload = {
      model: textModel,
      messages: textMessages,
      max_tokens: 4000,
      temperature: 0.2
    };

    console.log('🚀 [OPUS TWO-STAGE] Шаг 2: Opus Text формирует клиническую директиву...');
    
    const textResponse = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/vasiliys961/medical-assistant1',
        'X-Title': 'Medical AI Assistant'
      },
      body: JSON.stringify(textPayload)
    });

    if (!textResponse.ok) {
      const errorText = await textResponse.text();
      throw new Error(`OpenRouter API error: ${textResponse.status} - ${errorText.substring(0, 500)}`);
    }

    const textData = await textResponse.json();
    const result = textData.choices[0].message.content || '';
    
    // Логирование токенов и стоимости для шага 2
    const textTokensUsed = textData.usage?.total_tokens || 0;
    const textInputTokens = textData.usage?.prompt_tokens || Math.floor(textTokensUsed / 2);
    const textOutputTokens = textData.usage?.completion_tokens || Math.floor(textTokensUsed / 2);
    
    console.log('✅ [OPUS TWO-STAGE] Шаг 2 завершен, длина результата:', result.length);
    if (textTokensUsed > 0) {
      console.log(`   📊 ${formatCostLog(textModel, textInputTokens, textOutputTokens, textTokensUsed)}`);
    }
    
    return result;
  } catch (error: any) {
    console.error('Error in analyzeImageOpusTwoStage:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.substring(0, 500)
    });
    
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new Error('Превышено время ожидания ответа от OpenRouter API. Попробуйте позже.');
    }
    
    if (error.message.includes('fetch failed') || error.message.includes('network') || error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      throw new Error('Ошибка сети при обращении к OpenRouter API. Проверьте подключение к интернету и настройки Vercel.');
    }
    
    throw new Error(`Ошибка оптимизированного двухшагового Opus анализа: ${error.message}`);
  }
}

/**
 * Извлечение структурированных данных через Gemini 3.0 Flash в формате JSON
 */
export async function extractImageJSON(options: { imageBase64: string; modality?: string }): Promise<any> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY не настроен');
  }

  const modality = options.modality || 'unknown';
  
  // Используем Gemini 3.0 Flash для извлечения JSON
  const modelsToTry = [
    'google/gemini-3-flash-preview',
    'google/gemini-3-flash',
    'google/gemini-2.5-flash'
  ];

  const jsonPrompt = `Ты — эксперт-радиолог/кардиолог. Проанализируй изображение и верни результат СТРОГО в формате JSON.

Структура JSON:
{
    "modality": "${modality}",
    "image_quality": "excellent|good|fair|poor",
    "confidence": 0.0-1.0,
    "findings_observed": [
        {"finding": "описание находки", "location": "локализация", "severity": "mild|moderate|severe"}
    ],
    "red_flags": ["критические находки"],
    "cannot_assess": ["что невозможно оценить"],
    "recommendations": ["рекомендации"]
}

ВАЖНО: Верни ТОЛЬКО валидный JSON, без дополнительного текста до или после.`;

  const content = [
    {
      type: 'text',
      text: jsonPrompt
    },
    {
      type: 'image_url',
      image_url: {
        url: `data:image/png;base64,${options.imageBase64}`
      }
    }
  ];

  for (const model of modelsToTry) {
    try {
      console.log(`📡 [GEMINI JSON] Пробую модель: ${model}`);
      
      const payload = {
        model,
        messages: [
          { role: 'user', content: content }
        ],
        max_tokens: 4000,
        temperature: 0.1
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

      if (response.ok) {
        const resultData = await response.json();
        const resultText = resultData.choices[0].message.content;
        
        // Извлекаем JSON из ответа (может быть обернут в markdown код блоки)
        const jsonMatch = resultText.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : resultText;
        
        try {
          const jsonExtraction = JSON.parse(jsonStr);
          
          // Логирование токенов и стоимости
          const tokensUsed = resultData.usage?.total_tokens || 0;
          const inputTokens = resultData.usage?.prompt_tokens || Math.floor(tokensUsed / 2);
          const outputTokens = resultData.usage?.completion_tokens || Math.floor(tokensUsed / 2);
          
          console.log(`✅ [GEMINI JSON] JSON извлечен успешно через ${model}`);
          if (tokensUsed > 0) {
            console.log(`   📊 ${formatCostLog(model, inputTokens, outputTokens, tokensUsed)}`);
          }
          return jsonExtraction;
        } catch (e) {
          console.warn(`⚠️ [GEMINI JSON] Ошибка парсинга JSON от ${model}, пробую следующую модель...`);
          continue;
        }
      } else if (response.status === 404) {
        console.warn(`⚠️ [GEMINI JSON] Модель ${model} недоступна, пробую следующую...`);
        continue;
      } else {
        const errorText = await response.text();
        console.warn(`⚠️ [GEMINI JSON] Ошибка ${response.status} от ${model}: ${errorText.substring(0, 200)}`);
        continue;
      }
    } catch (error: any) {
      console.warn(`⚠️ [GEMINI JSON] Ошибка с ${model}: ${error.message}, пробую следующую модель...`);
      continue;
    }
  }

  throw new Error('Не удалось извлечь JSON ни через одну модель Gemini Flash');
}

/**
 * Текстовый запрос к OpenRouter API (для чата)
 */
export async function sendTextRequest(prompt: string, history: Array<{role: string, content: string}> = []): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY не найден в переменных окружения');
    throw new Error('OPENROUTER_API_KEY не настроен. Проверьте настройки Vercel.');
  }

  const selectedModel = MODELS.OPUS; // Opus 4.5 по умолчанию
  
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
    model: selectedModel,
    messages,
    max_tokens: 4000,
    temperature: 0.2
  };

  try {
    console.log('Calling OpenRouter API for text:', {
      url: OPENROUTER_API_URL,
      model: selectedModel,
      hasApiKey: !!apiKey,
      promptLength: prompt.length
    });

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

    console.log('OpenRouter API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error response:', errorText);
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText.substring(0, 500)}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid response format:', JSON.stringify(data).substring(0, 500));
      throw new Error('Неверный формат ответа от OpenRouter API');
    }

    // Логирование токенов и стоимости
    const tokensUsed = data.usage?.total_tokens || 0;
    const inputTokens = data.usage?.prompt_tokens || Math.floor(tokensUsed / 2);
    const outputTokens = data.usage?.completion_tokens || Math.floor(tokensUsed / 2);
    
    if (tokensUsed > 0) {
      console.log(`✅ [${selectedModel}] Запрос завершен`);
      console.log(`   📊 ${formatCostLog(selectedModel, inputTokens, outputTokens, tokensUsed)}`);
    }

    return data.choices[0].message.content || '';
  } catch (error: any) {
    console.error('Error calling OpenRouter API:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.substring(0, 500)
    });
    
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new Error('Превышено время ожидания ответа от OpenRouter API. Попробуйте позже.');
    }
    
    if (error.message.includes('fetch failed') || error.message.includes('network') || error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      throw new Error('Ошибка сети при обращении к OpenRouter API. Проверьте подключение к интернету и настройки Vercel.');
    }
    
    throw new Error(`Ошибка запроса: ${error.message}`);
  }
}
