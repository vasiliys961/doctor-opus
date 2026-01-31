/**
 * OpenRouter API клиент для анализа медицинских изображений
 * Переписанная версия Python логики из claude_assistant/vision_client.py
 * Сохраняет всю диагностическую логику без изменений
 */

import { calculateCost, formatCostLog } from './cost-calculator';
import { type ImageType, type Specialty, SYSTEM_PROMPT, DIALOGUE_SYSTEM_PROMPT, STRATEGIC_SYSTEM_PROMPT } from './prompts';
import { safeLog, safeError, safeWarn } from './logger';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// В Next.js 14 и Vercel используется встроенный fetch из Node.js 18+
// fetch доступен глобально в serverless функциях Vercel

// Актуальные модели (последние версии)
export const MODELS = {
  OPUS: 'anthropic/claude-opus-4.5',                       // Claude Opus 4.5
  SONNET: 'anthropic/claude-sonnet-4.5',                 // Claude Sonnet 4.5
  GPT_5_2: 'openai/gpt-5.2-chat',                        // GPT-5.2 (как замена Sonnet 4.5 для тестов)
  HAIKU: 'anthropic/claude-haiku-4.5',                     // Claude Haiku 4.5
  LLAMA: 'meta-llama/llama-3.2-90b-vision-instruct',     // Резерв
  GEMINI_3_FLASH: 'google/gemini-3-flash-preview',       // Gemini 3 Flash Preview
  GEMINI_3_PRO: 'google/gemini-3-pro-preview'            // Gemini 3 Pro Preview
};

const MODELS_LIST = [
  MODELS.OPUS,
  MODELS.SONNET,
  MODELS.GPT_5_2,
  MODELS.HAIKU,
  MODELS.LLAMA,
];

export type AnalysisMode = 'fast' | 'optimized' | 'validated';
export type ModelType = 'opus' | 'gemini' | 'sonnet' | 'gpt52' | 'haiku';

interface VisionRequestOptions {
  prompt: string;
  imageBase64: string;
  mimeType?: string;
  model?: string;
  maxTokens?: number;
  mode?: AnalysisMode;
  useStreaming?: boolean;
  clinicalContext?: string;
  imageType?: ImageType;
  specialty?: Specialty;
}

interface StreamingOptions {
  prompt: string;
  imageBase64?: string;
  model?: string;
  mode?: AnalysisMode;
  history?: Array<{role: string, content: string}>;
  clinicalContext?: string;
}

/**
 * Вспомогательная функция для fetch с таймаутом
 */
async function fetchWithTimeout(url: string, options: any, timeout = 120000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

/**
 * Анализ медицинского изображения через OpenRouter API
 * Использует ту же логику, что и Python vision_client.py
 */
export async function analyzeImage(options: VisionRequestOptions): Promise<string> {
  // В Next.js API routes переменные окружения доступны через process.env
  const rawKey = process.env.OPENROUTER_API_KEY;
  const apiKey = rawKey?.trim();
  
  if (!apiKey) {
    safeError('OPENROUTER_API_KEY не найден в переменных окружения');
    throw new Error('OPENROUTER_API_KEY не настроен. Проверьте настройки Vercel.');
  }

  // Выбираем модель в зависимости от режима
  let model = options.model;
  if (!model) {
    if (options.mode === 'fast') {
      model = MODELS.GEMINI_3_FLASH; // Gemini Flash 1.5 для быстрого анализа
    } else {
      // Проверяем, является ли это сканированием документа
      const isDocumentScan = options.prompt?.toLowerCase().includes('отсканируйте') || 
                            options.prompt?.toLowerCase().includes('сканирование') ||
                            options.prompt?.toLowerCase().includes('извлеките текст') ||
                            options.prompt?.toLowerCase().includes('ocr');
      if (isDocumentScan) {
        model = MODELS.GEMINI_3_FLASH; // Gemini 3 Flash — дешевле и лучше для сканирования
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
  
  const mimeType = options.mimeType || 'image/png';
  
  // Получаем специализированный промпт
  const imageType = options.imageType || 'universal';
  const specialty = options.specialty;
  const { getDirectivePrompt } = await import('./prompts');
  const directiveCriteria = getDirectivePrompt(imageType as any, prompt, specialty);
  
  // Добавляем клинический контекст в промпт, если он есть
  let fullPrompt = directiveCriteria;
  if (options.clinicalContext) {
    fullPrompt = `${directiveCriteria}\n\n=== КЛИНИЧЕСКИЙ КОНТЕКСТ ПАЦИЕНТА ===\n${options.clinicalContext}`;
  }
  
  // Формируем messages для OpenRouter API
  const messages = isDocumentScan ? [
    // Для сканирования документов system prompt не используется
    {
      role: 'user' as const,
      content: [
        {
          type: 'text',
          text: fullPrompt
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${options.imageBase64}`
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
          text: fullPrompt
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${options.imageBase64}`
          }
        }
      ]
    }
  ];

  const payload = {
    model,
    messages,
    max_tokens: options.maxTokens || 16000, // Максимальный лимит для длинных отчетов
    temperature: 0.1,
  };

  try {
    // Логируем для отладки (с маскировкой ключа через safeLog)
    safeLog('Calling OpenRouter API:', {
      url: OPENROUTER_API_URL,
      model: model,
      hasApiKey: !!apiKey,
      mimeType,
      imageSize: options.imageBase64.length
    });

    const response = await fetchWithTimeout(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }, 120000); // Таймаут 120 сек

    safeLog('OpenRouter API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      safeError('OpenRouter API error response:', errorText);
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText.substring(0, 500)}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      safeError('Invalid response format:', JSON.stringify(data).substring(0, 500));
      throw new Error('Неверный формат ответа от OpenRouter API');
    }

    // Логирование токенов и стоимости
    const tokensUsed = data.usage?.total_tokens || 0;
    const inputTokens = data.usage?.prompt_tokens || Math.floor(tokensUsed / 2);
    const outputTokens = data.usage?.completion_tokens || Math.floor(tokensUsed / 2);
    
    if (tokensUsed > 0) {
      safeLog(`✅ [${model}] Запрос завершен`);
      safeLog(`   📊 ${formatCostLog(model, inputTokens, outputTokens, tokensUsed)}`);
    }

    return data.choices[0].message.content || '';
  } catch (error: any) {
    safeError('Error calling OpenRouter API:', {
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
 * Быстрый анализ изображения через Gemini
 * Двухэтапный анализ: сначала Gemini 3.0 извлекает JSON, затем Gemini 3.0 делает описание от лица Профессора
 */
export async function analyzeImageFast(options: { 
  prompt: string; 
  imageBase64: string;
  imageType?: ImageType;
  specialty?: Specialty;
  clinicalContext?: string;
}): Promise<string> {
  const rawKey = process.env.OPENROUTER_API_KEY;
  const apiKey = rawKey?.trim();
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY не настроен');
  }

  const imageType = options.imageType || 'universal';
  const specialty = options.specialty;
  
  try {
    safeLog('🚀 [FAST] Шаг 1: Извлечение JSON через Gemini 3.0...');
    const jsonExtraction = await extractImageJSON({
      imageBase64: options.imageBase64,
      modality: imageType
    });
    
    // Получаем специализированный промпт для Профессора
    const { getDirectivePrompt } = await import('./prompts');
    const directivePrompt = getDirectivePrompt(imageType, options.prompt, specialty);

    const textModel = MODELS.GEMINI_3_FLASH;
    
    const contextPrompt = `Ты — Профессор медицины. На основе этих данных и своей экспертизы дай клиническую директиву. ОТВЕЧАЙ СТРОГО НА РУССКОМ ЯЗЫКЕ.

=== СТРУКТУРИРОВАННЫЕ ДАННЫЕ (GEMINI 3.0) ===
${JSON.stringify(jsonExtraction, null, 2)}
\n=== ИНСТРУКЦИЯ ===
${directivePrompt}
${options.clinicalContext ? `\nКонтекст пациента: ${options.clinicalContext}` : ''}

ОТВЕЧАЙ СТРОГО НА РУССКОМ ЯЗЫКЕ.`;
    
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: contextPrompt }
    ];

    safeLog('🚀 [FAST] Шаг 2: Gemini 3.0 (Professor Mode) формирует директиву...');
    
    const textResponse = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://doctor-opus.ru',
        'X-Title': 'Doctor Opus'
      },
      body: JSON.stringify({
        model: textModel,
        messages: messages,
        max_tokens: 16000,
        temperature: 0.1,
      })
    });

    if (!textResponse.ok) {
      const errorText = await textResponse.text();
      throw new Error(`OpenRouter API error: ${textResponse.status} - ${errorText}`);
    }

    const textData = await textResponse.json();
    return textData.choices[0].message.content || '';
    
  } catch (error: any) {
    safeError('❌ [FAST] Ошибка:', error);
    throw new Error(`Ошибка быстрого анализа: ${error.message}`);
  }
}

/**
 * Оптимизированный анализ (Gemini JSON → Основная модель)
 * Этап 1: Gemini извлекает структурированные данные (JSON)
 * Этап 2: Выбранная модель формирует детальную клиническую директиву на основе JSON
 */
export async function analyzeImageOpusTwoStage(options: { 
  prompt: string; 
  imageBase64: string;
  imageType?: ImageType;
  specialty?: Specialty;
  clinicalContext?: string;
  targetModel?: string; 
  isRadiologyOnly?: boolean;
}): Promise<string> {
  const rawKey = process.env.OPENROUTER_API_KEY;
  const apiKey = rawKey?.trim();
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY не настроен');
  }

  const prompt = options.prompt || 'Проанализируйте медицинское изображение.';
  const imageType = options.imageType || 'universal';
  const specialty = options.specialty;
  const isRadiologyOnly = options.isRadiologyOnly || false;
  
  try {
    safeLog(`🚀 [TWO-STAGE] Шаг 1: Извлечение JSON через Gemini Flash...`);
    
    // Шаг 1: Извлекаем JSON через Gemini
    const extractionResult = await extractImageJSON({
      imageBase64: options.imageBase64,
      modality: imageType,
      specialty: specialty
    });
    const jsonExtraction = extractionResult.data;
    const initialUsage = extractionResult.usage;
    
    safeLog('✅ [TWO-STAGE] JSON извлечен');
    
    const { getDirectivePrompt, RADIOLOGY_PROTOCOL_PROMPT, STRATEGIC_SYSTEM_PROMPT } = await import('./prompts');
    const directiveCriteria = getDirectivePrompt(imageType, prompt, specialty);
    
    // Шаг 2: Целевая модель (Opus, Sonnet или GPT-5.2)
    const textModel = options.targetModel || MODELS.SONNET;
    
    const mainPrompt = `ИНСТРУКЦИЯ: ${directiveCriteria}

### ТЕХНИЧЕСКИЕ ДАННЫЕ ИЗ ИЗОБРАЖЕНИЯ (JSON):
${JSON.stringify(jsonExtraction, null, 2)}

${options.clinicalContext ? `### КЛИНИЧЕСКИЙ КОНТЕКСТ ПАЦИЕНТА:\n${options.clinicalContext}\n\n` : ''}ПРОАНАЛИЗИРУЙ ДАННЫЕ И СФОРМУЛИРУЙ ПОЛНЫЙ ОТЧЕТ НА РУССКОМ ЯЗЫКЕ.`;

    const basePrompt = isRadiologyOnly ? RADIOLOGY_PROTOCOL_PROMPT : (specialty === 'ai_consultant' ? SYSTEM_PROMPT : STRATEGIC_SYSTEM_PROMPT);
    const messages = [
      { role: 'system' as const, content: basePrompt },
      { role: 'user' as const, content: mainPrompt }
    ];

    safeLog(`🚀 [TWO-STAGE] Шаг 2: ${textModel} анализирует данные (JSON)...`);
    
    const textResponse = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://doctor-opus.ru',
        'X-Title': 'Doctor Opus'
      },
      body: JSON.stringify({
        model: textModel,
        messages: messages,
        max_tokens: 16000,
        temperature: 0.1,
      })
    });

    if (!textResponse.ok) {
      const errorText = await textResponse.text();
      throw new Error(`OpenRouter API error: ${textResponse.status} - ${errorText.substring(0, 500)}`);
    }

    const textData = await textResponse.json();
    const result = textData.choices[0].message.content || '';
    
    // Логирование токенов и стоимости (Gemini + Основная модель)
    const textTokensUsed = textData.usage?.total_tokens || 0;
    const textInputTokens = textData.usage?.prompt_tokens || 0;
    const textOutputTokens = textData.usage?.completion_tokens || 0;

    const totalInput = textInputTokens + (initialUsage?.prompt_tokens || 0);
    const totalOutput = textOutputTokens + (initialUsage?.completion_tokens || 0);
    const totalTokens = textTokensUsed + (initialUsage?.total_tokens || 0);
    
    safeLog('✅ [TWO-STAGE] Анализ завершен');
    if (totalTokens > 0) {
      safeLog(`   📊 ИТОГО: ${formatCostLog(textModel, totalInput, totalOutput, totalTokens)}`);
    }
    
    return result;
  } catch (error: any) {
    safeError('Error in analyzeImageOpusTwoStage:', error);
    throw new Error(`Ошибка анализа: ${error.message}`);
  }
}

/**
 * Извлечение структурированных данных через Gemini 3.0 Flash в формате JSON
 * Поддерживает одно или несколько изображений
 */
export async function extractImageJSON(options: { 
  imageBase64?: string; 
  imagesBase64?: string[]; 
  modality?: string;
  specialty?: Specialty;
}): Promise<any> {
  const rawKey = process.env.OPENROUTER_API_KEY;
  const apiKey = rawKey?.trim();
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY не настроен');
  }

  const modality = options.modality || 'unknown';
  const specialty = options.specialty;
  const allImages = options.imagesBase64 || (options.imageBase64 ? [options.imageBase64] : []);
  
  if (allImages.length === 0) {
    throw new Error('Не предоставлено ни одного изображения для извлечения JSON');
  }
  
  // Используем Gemini Flash для извлечения JSON
  const modelsToTry = [
    MODELS.GEMINI_3_FLASH,
    MODELS.GEMINI_3_PRO,
    'google/gemini-2.0-flash-001'
  ];

  // Получаем детальные инструкции специалиста для этого типа исследования
  const { getDescriptionPrompt } = await import('./prompts');
  const jsonPrompt = getDescriptionPrompt(modality as any, specialty);

  const content: any[] = [
    {
      type: 'text',
      text: jsonPrompt
    }
  ];

  // Добавляем все изображения
  allImages.forEach(img => {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:image/png;base64,${img}`
      }
    });
  });

  for (const model of modelsToTry) {
    try {
      safeLog(`📡 [GEMINI JSON] Пробую модель: ${model}`);
      
      const payload = {
        model,
        messages: [
          { role: 'user', content: content }
        ],
        max_tokens: 16000,
        temperature: 0.1,
      };

      const response = await fetchWithTimeout(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }, 60000); // Таймаут 60 сек на извлечение JSON

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
          
          safeLog(`✅ [GEMINI JSON] JSON извлечен успешно через ${model}`);
          if (tokensUsed > 0) {
            safeLog(`   📊 ${formatCostLog(model, inputTokens, outputTokens, tokensUsed)}`);
          }
          
          // Возвращаем и данные, и usage для корректного учета стоимости
          return {
            data: jsonExtraction,
            usage: {
              prompt_tokens: inputTokens,
              completion_tokens: outputTokens,
              total_tokens: tokensUsed,
              model: model
            }
          };
        } catch (e) {
          safeWarn(`⚠️ [GEMINI JSON] Ошибка парсинга JSON от ${model}, пробую следующую модель...`);
          continue;
        }
      } else if (response.status === 404) {
        safeWarn(`⚠️ [GEMINI JSON] Модель ${model} недоступна, пробую следующую...`);
        continue;
      } else {
        const errorText = await response.text();
        safeWarn(`⚠️ [GEMINI JSON] Ошибка ${response.status} от ${model}: ${errorText.substring(0, 200)}`);
        continue;
      }
    } catch (error: any) {
      safeWarn(`⚠️ [GEMINI JSON] Ошибка с ${model}: ${error.message}, пробую следующую модель...`);
      continue;
    }
  }

  throw new Error('Не удалось извлечь JSON ни через одну модель Gemini Flash');
}

/**
 * Анализ нескольких медицинских изображений (для сравнительного анализа)
 * Принимает массив base64 изображений и анализирует их вместе
 */
/**
 * Сравнительный двухэтапный анализ нескольких изображений
 */
export async function analyzeMultipleImagesTwoStage(options: { 
  prompt: string; 
  imagesBase64: string[];
  imageType?: ImageType;
  specialty?: Specialty;
  clinicalContext?: string;
  targetModel?: string;
  isRadiologyOnly?: boolean;
}): Promise<string> {
  const rawKey = process.env.OPENROUTER_API_KEY;
  const apiKey = rawKey?.trim();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

  const imageType = options.imageType || 'universal';
  const specialty = options.specialty;
  const isRadiologyOnly = options.isRadiologyOnly || false;
  
  try {
    safeLog(`🚀 [MULTI-TWO-STAGE] Шаг 1: Извлечение JSON...`);
    const extractionResult = await extractImageJSON({
      imagesBase64: options.imagesBase64,
      modality: imageType,
      specialty: specialty
    });
    const jsonExtraction = extractionResult.data;
    const initialUsage = extractionResult.usage;
    
    const { getDirectivePrompt, RADIOLOGY_PROTOCOL_PROMPT, STRATEGIC_SYSTEM_PROMPT } = await import('./prompts');
    const directiveCriteria = getDirectivePrompt(imageType, options.prompt, specialty);
    
    const textModel = options.targetModel || MODELS.SONNET;
    
    const contextPrompt = `Ты — Профессор медицины. Проведи сравнительную клиническую интерпретацию данных по НЕСКОЛЬКИМ изображениям, полученных от Специалиста. ОТВЕЧАЙ СТРОГО НА РУССКОМ ЯЗЫКЕ.

### ДАННЫЕ ОТ СПЕЦИАЛИСТА (JSON):
${JSON.stringify(jsonExtraction, null, 2)}

${options.clinicalContext ? `### КЛИНИЧЕСКИЙ КОНТЕКСТ ПАЦИЕНТА:\n${options.clinicalContext}\n\n` : ''}ПРОАНАЛИЗИРУЙ ДАННЫЕ И СФОРМУЛИРУЙ ПОЛНЫЙ ОТЧЕТ НА РУССКОМ ЯЗЫКЕ.

ИНСТРУКЦИЯ К КЛИНИЧЕСКОЙ ДИРЕКТИВЕ:
${directiveCriteria}`;
    
    const basePrompt = isRadiologyOnly ? RADIOLOGY_PROTOCOL_PROMPT : (specialty === 'ai_consultant' ? SYSTEM_PROMPT : STRATEGIC_SYSTEM_PROMPT);
    const textPayload = {
      model: textModel,
      messages: [
        { role: 'system' as const, content: basePrompt },
        { role: 'user' as const, content: contextPrompt }
      ],
      max_tokens: 16000,
      temperature: 0.1,
    };

    safeLog(`🚀 [MULTI-TWO-STAGE] Шаг 2: ${textModel} анализирует данные (JSON)...`);
    const textResponse = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://doctor-opus.ru',
        'X-Title': 'Doctor Opus'
      },
      body: JSON.stringify(textPayload)
    });

    if (!textResponse.ok) throw new Error(`OpenRouter error: ${textResponse.status}`);
    const textData = await textResponse.json();
    const result = textData.choices[0].message.content || '';

    // Логирование токенов и стоимости
    const totalInput = (textData.usage?.prompt_tokens || 0) + (initialUsage?.prompt_tokens || 0);
    const totalOutput = (textData.usage?.completion_tokens || 0) + (initialUsage?.completion_tokens || 0);
    const totalTokens = totalInput + totalOutput;

    safeLog('✅ [MULTI-TWO-STAGE] Анализ завершен');
    if (totalTokens > 0) {
      safeLog(`   📊 ИТОГО: ${formatCostLog(textModel, totalInput, totalOutput, totalTokens)}`);
    }

    return result;
    
  } catch (error: any) {
    safeError('Error in analyzeMultipleImagesTwoStage:', error);
    throw new Error(`Ошибка сравнительного анализа: ${error.message}`);
  }
}

/**
 * Сравнительный анализ нескольких изображений
 */
export async function analyzeMultipleImages(options: {
  prompt: string;
  imagesBase64: string[];
  mimeTypes?: string[];
  model?: string;
  maxTokens?: number;
  clinicalContext?: string;
  imageType?: ImageType;
  specialty?: Specialty;
}): Promise<string> {
  const rawKey = process.env.OPENROUTER_API_KEY;
  const apiKey = rawKey?.trim();
  
  if (!apiKey) {
    safeError('OPENROUTER_API_KEY не найден в переменных окружения');
    throw new Error('OPENROUTER_API_KEY не настроен. Проверьте настройки Vercel.');
  }

  if (options.imagesBase64.length === 0) {
    throw new Error('Необходимо предоставить минимум одно изображение');
  }

  const model = options.model || MODELS.OPUS; // Используем Opus для точного сравнительного анализа
  const imageType = options.imageType || 'universal';
  const specialty = options.specialty;
  
  // Получаем специализированный промпт
  const { getDirectivePrompt } = await import('./prompts');
  const directiveCriteria = getDirectivePrompt(imageType as any, options.prompt, specialty);
  
  // Добавляем клинический контекст в промпт, если он есть
  let fullPrompt = directiveCriteria;
  if (options.clinicalContext) {
    fullPrompt = `${directiveCriteria}\n\n=== КЛИНИЧЕСКИЙ КОНТЕКСТ ПАЦИЕНТА ===\n${options.clinicalContext}`;
  }
  
  // Формируем content с текстом и всеми изображениями
  const contentItems: Array<{type: string; text?: string; image_url?: {url: string}}> = [
    {
      type: 'text',
      text: fullPrompt
    }
  ];

  // Добавляем все изображения в content
  options.imagesBase64.forEach((imageBase64, index) => {
    const mimeType = options.mimeTypes?.[index] || 'image/png';
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
    max_tokens: options.maxTokens || 16000, // Увеличиваем для сравнительного анализа
    temperature: 0.1,
  };

  try {
    safeLog(`Calling OpenRouter API with ${options.imagesBase64.length} images for comparative analysis:`, {
      url: OPENROUTER_API_URL,
      model: model,
      hasApiKey: !!apiKey,
      imageCount: options.imagesBase64.length,
      imageSizes: options.imagesBase64.map(img => img.length)
    });

    const response = await fetchWithTimeout(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://doctor-opus.ru',
        'X-Title': 'Doctor Opus'
      },
      body: JSON.stringify(payload)
    }, 180000); // Увеличенный таймаут для множественных изображений: 180 сек

    safeLog('OpenRouter API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      safeError('OpenRouter API error response:', errorText);
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText.substring(0, 500)}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      safeError('Invalid response format:', JSON.stringify(data).substring(0, 500));
      throw new Error('Неверный формат ответа от OpenRouter API');
    }

    // Логирование токенов и стоимости
    const tokensUsed = data.usage?.total_tokens || 0;
    const inputTokens = data.usage?.prompt_tokens || Math.floor(tokensUsed / 2);
    const outputTokens = data.usage?.completion_tokens || Math.floor(tokensUsed / 2);
    
    if (tokensUsed > 0) {
      safeLog(`✅ [${model}] Сравнительный анализ ${options.imagesBase64.length} изображений завершен`);
      safeLog(`   📊 ${formatCostLog(model, inputTokens, outputTokens, tokensUsed)}`);
    }

    return data.choices[0].message.content || '';
  } catch (error: any) {
    safeError('Error calling OpenRouter API for multiple images:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.substring(0, 500)
    });
    
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new Error('Превышено время ожидания ответа от OpenRouter API (180 сек). Попробуйте уменьшить количество изображений.');
    }
    
    if (error.message.includes('fetch failed') || error.message.includes('network') || error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      throw new Error('Ошибка сети при обращении к OpenRouter API. Проверьте подключение к интернету и настройки Vercel.');
    }
    
    throw new Error(`Ошибка анализа множественных изображений: ${error.message}`);
  }
}

/**
 * Текстовый запрос к OpenRouter API (для чата)
 */
export async function sendTextRequest(
  prompt: string, 
  history: Array<{role: string, content: string}> = [],
  model: string = MODELS.OPUS,
  specialty?: Specialty
): Promise<string> {
  const rawKey = process.env.OPENROUTER_API_KEY;
  const apiKey = rawKey?.trim();
  
  if (!apiKey) {
    safeError('OPENROUTER_API_KEY не найден в переменных окружения');
    throw new Error('OPENROUTER_API_KEY не настроен. Проверьте настройки Vercel.');
  }

  const selectedModel = model;
  const { TITAN_CONTEXTS } = await import('./prompts');
  
  // Выбираем системный промпт: для первого сообщения - полная директива, для диалога - краткий режим
  const basePrompt = specialty === 'ai_consultant' ? SYSTEM_PROMPT : STRATEGIC_SYSTEM_PROMPT;
  let systemPrompt = history.length > 0 ? DIALOGUE_SYSTEM_PROMPT : basePrompt;
  
  if (specialty && TITAN_CONTEXTS[specialty]) {
    systemPrompt = `${systemPrompt}\n\n${TITAN_CONTEXTS[specialty]}`;
  }
  
  const messages = [
    {
      role: 'system' as const,
      content: systemPrompt
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
    max_tokens: 16000, // Максимальный лимит для сравнительного анализа
    temperature: 0.1,
  };

  try {
    safeLog('Calling OpenRouter API for text:', {
      url: OPENROUTER_API_URL,
      model: selectedModel,
      hasApiKey: !!apiKey,
      promptLength: prompt.length
    });

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    safeLog('OpenRouter API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      safeError('OpenRouter API error response:', errorText);
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText.substring(0, 500)}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      safeError('Invalid response format:', JSON.stringify(data).substring(0, 500));
      throw new Error('Неверный формат ответа от OpenRouter API');
    }

    // Логирование токенов и стоимости
    const tokensUsed = data.usage?.total_tokens || 0;
    const inputTokens = data.usage?.prompt_tokens || Math.floor(tokensUsed / 2);
    const outputTokens = data.usage?.completion_tokens || Math.floor(tokensUsed / 2);
    
    if (tokensUsed > 0) {
      safeLog(`✅ [${selectedModel}] Запрос завершен`);
      safeLog(`   📊 ${formatCostLog(selectedModel, inputTokens, outputTokens, tokensUsed)}`);
    }

    return data.choices[0].message.content || '';
  } catch (error: any) {
    safeError('Error calling OpenRouter API:', {
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
