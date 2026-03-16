/**
 * OpenRouter API клиент для анализа медицинских изображений
 * Переписанная версия Python логики из claude_assistant/vision_client.py
 * Сохраняет всю диагностическую логику без изменений
 */

import { calculateCombinedCost, calculateCost, formatCostLog } from './cost-calculator';
import { type ImageType, type Specialty, SYSTEM_PROMPT, DIALOGUE_SYSTEM_PROMPT, STRATEGIC_SYSTEM_PROMPT } from './prompts';
import { safeLog, safeError, safeWarn } from './logger';
import { isAnthropicModel, isGeoRestrictionStatus, isOpenAIGeoRestrictionError, shouldUseStage2GeoFallback } from './geo-restriction';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// В Next.js 14 используется встроенный fetch из Node.js 18+
// fetch доступен глобально на сервере

// Актуальные модели (последние флагманы 2025-2026)
export const MODELS = {
  OPUS: 'anthropic/claude-opus-4.6',                       // Claude Opus 4.6
  SONNET: 'anthropic/claude-sonnet-4.6',                 // Claude Sonnet 4.6
  GPT_5_2: 'openai/gpt-5.4',                        // GPT-5.4 Chat (legacy key name kept for compatibility)
  HAIKU: 'anthropic/claude-haiku-4.5',                   // Claude Haiku 4.5
  LLAMA: 'meta-llama/llama-3.2-90b-vision-instruct',     // Резерв
  GEMINI_3_FLASH: 'google/gemini-3-flash-preview',       // Gemini 3 Flash Preview
  GEMINI_3_PRO: 'google/gemini-3.1-pro-preview'          // Gemini 3.1 Pro Preview
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
async function fetchWithTimeout(url: string, options: any, timeout = 300000) {
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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function isRateLimit(status: number, errorText?: string) {
  if (status === 429) return true;
  const text = (errorText || '').toLowerCase();
  return text.includes('rate-limited') || text.includes('rate limited');
}

function getStage2FallbackModel(primaryModel: string): string | null {
  if (isAnthropicModel(primaryModel)) {
    return MODELS.GPT_5_2;
  }
  if (primaryModel === MODELS.GPT_5_2) {
    return MODELS.SONNET;
  }
  return null;
}

function getChatFallbackModel(primaryModel: string): string | null {
  if (primaryModel === MODELS.GPT_5_2) {
    return MODELS.SONNET;
  }
  return null;
}

type RoutingImageQuality = 'good' | 'moderate' | 'poor';

interface RoutingMetadata {
  self_confidence?: number;
  difficulty_level?: number;
  image_quality?: RoutingImageQuality;
  ambiguous_findings?: boolean;
  needs_second_read?: boolean;
}

function isTruthyEnv(value: string | undefined, defaultValue: boolean = false): boolean {
  if (!value) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function extractRoutingMetadata(payload: any): RoutingMetadata {
  return payload?.routing || payload?.quality_routing || {};
}

function shouldUseProByRouting(modality: string, routing: RoutingMetadata): { escalate: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const normalizedModality = (modality || '').toLowerCase();
  const highRiskModalities = new Set(['ct', 'mri', 'histology', 'mammography']);
  const forceProHighRisk = isTruthyEnv(process.env.SMART_ROUTING_FORCE_PRO_HIGH_RISK, true);

  if (forceProHighRisk && highRiskModalities.has(normalizedModality)) {
    reasons.push('high_risk_modality');
  }
  if (typeof routing.self_confidence === 'number' && routing.self_confidence < 0.75) {
    reasons.push('low_self_confidence');
  }
  if (typeof routing.difficulty_level === 'number' && routing.difficulty_level >= 4) {
    reasons.push('high_difficulty');
  }
  if (routing.image_quality === 'poor') {
    reasons.push('poor_image_quality');
  }
  if (routing.ambiguous_findings) {
    reasons.push('ambiguous_findings');
  }
  if (routing.needs_second_read) {
    reasons.push('second_read_requested');
  }

  return { escalate: reasons.length > 0, reasons };
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
    throw new Error('OPENROUTER_API_KEY не настроен. Проверьте переменные окружения.');
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
        model = MODELS.OPUS; // Opus 4.6 для точного анализа
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
    max_tokens: options.maxTokens || 10000, // Оптимизированный базовый лимит для стандартных отчетов
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
      throw new Error('Ошибка сети при обращении к OpenRouter API. Проверьте подключение к интернету и настройки сервера.');
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
  imageBase64?: string;
  imagesBase64?: string[];
  imageType?: ImageType;
  specialty?: Specialty;
  clinicalContext?: string;
  isComparative?: boolean;
}): Promise<string> {
  const rawKey = process.env.OPENROUTER_API_KEY;
  const apiKey = rawKey?.trim();
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY не настроен');
  }

  const imageType = options.imageType || 'universal';
  const specialty = options.specialty;
  const allImages = options.imagesBase64 || (options.imageBase64 ? [options.imageBase64] : []);
  
  try {
    safeLog(`🚀 [FAST] Шаг 1: Извлечение JSON через Gemini 3.0 (${allImages.length} изображений)...`);
    const jsonExtractionResult = await extractImageJSON({
      imagesBase64: allImages,
      modality: imageType,
      enableSmartRouting: false,
      preferModel: MODELS.GEMINI_3_FLASH,
      isComparative: options.isComparative === true
    });
    const jsonExtraction = jsonExtractionResult.data;
    
    // Получаем специализированный промпт для Профессора
    const { getDirectivePrompt } = await import('./prompts');
    const directivePrompt = getDirectivePrompt(imageType, options.prompt, specialty);

    const textModels = [
      MODELS.GEMINI_3_FLASH,
      MODELS.HAIKU,
      MODELS.SONNET
    ];
    
    const contextPrompt = `Ты — экспертный интеллектуальный ассистент с компетенциями профессора медицины. На основе этих данных и своей экспертизы дай клиническую директиву. ОТВЕЧАЙ СТРОГО НА РУССКОМ ЯЗЫКЕ.

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

    safeLog('🚀 [FAST] Шаг 2: формирование директивы (fallback при 429)...');

    for (const textModel of textModels) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const textResponse = await fetch(OPENROUTER_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://doctor-opus.online',
            'X-Title': 'Doctor Opus'
          },
          body: JSON.stringify({
            model: textModel,
            messages: messages,
            max_tokens: 10000, // Оптимизировано: текстовый анализ
            temperature: 0.1,
          })
        });

        if (textResponse.ok) {
          const textData = await textResponse.json();
          return textData.choices[0].message.content || '';
        }

        const errorText = await textResponse.text();
        if (isRateLimit(textResponse.status, errorText) && attempt === 0) {
          safeWarn(`⚠️ [FAST] 429 на модели ${textModel}, повтор через паузу...`);
          await sleep(1500);
          continue;
        }

        safeWarn(`⚠️ [FAST] Ошибка ${textResponse.status} на модели ${textModel}: ${errorText.substring(0, 200)}`);
        break;
      }
    }

    throw new Error('Не удалось завершить быстрый анализ ни через одну модель');
    
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
      specialty: specialty,
      enableSmartRouting: true
    });
    const jsonExtraction = extractionResult.data;
    const initialUsage = extractionResult.usage;
    
    safeLog('✅ [TWO-STAGE] JSON извлечен');
    
    const { getDirectivePrompt, RADIOLOGY_PROTOCOL_PROMPT, STRATEGIC_SYSTEM_PROMPT } = await import('./prompts');
    const directiveCriteria = getDirectivePrompt(imageType, prompt, specialty);
    
    // Шаг 2: Целевая модель (Opus, Sonnet или GPT-5.4)
    const textModel = options.targetModel || MODELS.SONNET;
    let stage2ModelUsed = textModel;
    const fallbackModel = getStage2FallbackModel(textModel);
    
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
    
    const runStage2Request = async (targetModel: string) => {
      return fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://doctor-opus.online',
          'X-Title': 'Doctor Opus'
        },
        body: JSON.stringify({
          model: targetModel,
          messages: messages,
          max_tokens: 10000, // Оптимизировано: двухэтапный анализ
          temperature: 0.1,
        })
      });
    };

    let textResponse = await runStage2Request(textModel);
    if (!textResponse.ok) {
      const errorText = await textResponse.text();
      const shouldFallback = !!fallbackModel && shouldUseStage2GeoFallback(textModel, textResponse.status, errorText);
      if (shouldFallback) {
        safeWarn(`⚠️ [TWO-STAGE] Региональная недоступность ${textModel}, переключение на ${fallbackModel}`);
        stage2ModelUsed = fallbackModel!;
        textResponse = await runStage2Request(stage2ModelUsed);
      } else {
        throw new Error(`OpenRouter API error: ${textResponse.status} - ${errorText.substring(0, 500)}`);
      }
    }

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

    const combinedCost = calculateCombinedCost([
      {
        model: initialUsage?.model || MODELS.GEMINI_3_FLASH,
        prompt_tokens: initialUsage?.prompt_tokens || 0,
        completion_tokens: initialUsage?.completion_tokens || 0,
      },
      {
        model: stage2ModelUsed,
        prompt_tokens: textInputTokens,
        completion_tokens: textOutputTokens,
      }
    ]);
    
    safeLog('✅ [TWO-STAGE] Анализ завершен');
    if (combinedCost.totalTokens > 0) {
      safeLog(`   📊 ИТОГО (комбинированно): ${combinedCost.totalTokens.toLocaleString('ru-RU')} токенов, ${combinedCost.totalCostUnits.toFixed(2)} ед. ($${combinedCost.totalCostUsd.toFixed(4)})`);
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
  enableSmartRouting?: boolean;
  preferModel?: string;
  isComparative?: boolean;
}): Promise<any> {
  const rawKey = process.env.OPENROUTER_API_KEY;
  const apiKey = rawKey?.trim();
  
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const modality = options.modality || 'unknown';
  const specialty = options.specialty;
  const allImages = options.imagesBase64 || (options.imageBase64 ? [options.imageBase64] : []);
  
  if (allImages.length === 0) {
    throw new Error('No images were provided for JSON extraction');
  }
  
  const smartRoutingEnabled = (options.enableSmartRouting ?? true) && isTruthyEnv(process.env.SMART_ROUTING_ENABLED, false);
  const preferModel = options.preferModel || MODELS.GEMINI_3_FLASH;

  // Получаем детальные инструкции специалиста для этого типа исследования
  const { getDescriptionPrompt, getComparisonDescriptionPrompt } = await import('./prompts');
  const jsonPrompt = options.isComparative
    ? getComparisonDescriptionPrompt(modality as any, specialty)
    : getDescriptionPrompt(modality as any, specialty);

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

  const callModel = async (model: string, timeoutMs: number = 60000) => {
    safeLog(`📡 [VISION JSON] Trying model: ${model}`);

    const payload = {
      model,
      messages: [{ role: 'user', content }],
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
    }, timeoutMs);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`[${response.status}] ${errorText.substring(0, 200)}`);
    }

    const resultData = await response.json();
    const resultText = resultData?.choices?.[0]?.message?.content || '';
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : resultText;
    const parsed = JSON.parse(jsonStr);

    const tokensUsed = resultData.usage?.total_tokens || 0;
    const inputTokens = resultData.usage?.prompt_tokens || Math.floor(tokensUsed / 2);
    const outputTokens = resultData.usage?.completion_tokens || Math.floor(tokensUsed / 2);

    safeLog(`✅ [VISION JSON] JSON extracted successfully via ${model}`);
    if (tokensUsed > 0) {
      safeLog(`   📊 ${formatCostLog(model, inputTokens, outputTokens, tokensUsed)}`);
    }

    const callCost = calculateCost(inputTokens, outputTokens, model);

    return {
      data: parsed,
      usage: {
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens,
        total_tokens: tokensUsed,
        model,
        total_cost: callCost.totalCostUnits,
        stages: [
          {
            model,
            prompt_tokens: inputTokens,
            completion_tokens: outputTokens,
          }
        ]
      }
    };
  };

  const nonGeminiFallbackModels = [
    MODELS.SONNET,
    MODELS.HAIKU,
    MODELS.GPT_5_2,
  ];

  // Fast path for forced model and non-smart routing
  if (!smartRoutingEnabled || preferModel !== MODELS.GEMINI_3_FLASH) {
    const orderedModels = [
      preferModel,
      MODELS.GEMINI_3_FLASH,
      MODELS.GEMINI_3_PRO,
      'google/gemini-2.0-flash-001',
      'google/gemini-flash-1.5',
      'google/gemini-pro-1.5'
    ].filter((value, index, arr) => !!value && arr.indexOf(value) === index);

    for (const model of orderedModels) {
      try {
        return await callModel(model, model === MODELS.GEMINI_3_PRO ? 90000 : 60000);
      } catch (error: any) {
        safeWarn(`⚠️ [VISION JSON] Error with ${model}: ${error.message}, trying next model...`);
        if (String(error.message).includes('[429]')) await sleep(1500);
        continue;
      }
    }

    for (const model of nonGeminiFallbackModels) {
      try {
        return await callModel(model, 90000);
      } catch (error: any) {
        safeWarn(`⚠️ [VISION JSON] Fallback error with ${model}: ${error.message}, trying next model...`);
        if (String(error.message).includes('[429]')) await sleep(1500);
      }
    }

    throw new Error('Failed to extract JSON via all available vision models');
  }

  // Smart routing: start with Flash, then escalate to Pro if needed.
  let flashResult: any;
  try {
    flashResult = await callModel(MODELS.GEMINI_3_FLASH, 60000);
  } catch (error: any) {
    safeWarn(`⚠️ [SMART ROUTER] Flash unavailable, trying Pro: ${error.message}`);
    try {
      return await callModel(MODELS.GEMINI_3_PRO, 90000);
    } catch (proError: any) {
      safeWarn(`⚠️ [SMART ROUTER] Pro unavailable, using non-Gemini fallbacks: ${proError.message}`);
      for (const model of nonGeminiFallbackModels) {
        try {
          return await callModel(model, 90000);
        } catch (fallbackError: any) {
          safeWarn(`⚠️ [SMART ROUTER] Fallback error with ${model}: ${fallbackError.message}`);
          if (String(fallbackError.message).includes('[429]')) await sleep(1500);
        }
      }
      throw new Error('Failed to extract JSON via all available vision models');
    }
  }

  const routing = extractRoutingMetadata(flashResult.data);
  const decision = shouldUseProByRouting(modality, routing);
  safeLog(`🧭 [SMART ROUTER] modality=${modality}; escalate=${decision.escalate}; reasons=${decision.reasons.join(',') || 'none'}`);

  if (!decision.escalate) {
    return flashResult;
  }

  try {
    const proResult = await callModel(MODELS.GEMINI_3_PRO, 90000);
    const flashUsage = flashResult?.usage || {};
    const proUsage = proResult?.usage || {};
    const mergedStages = [
      ...(Array.isArray(flashUsage.stages) ? flashUsage.stages : []),
      ...(Array.isArray(proUsage.stages) ? proUsage.stages : [])
    ];

    const mergedUsage = {
      prompt_tokens: (flashUsage.prompt_tokens || 0) + (proUsage.prompt_tokens || 0),
      completion_tokens: (flashUsage.completion_tokens || 0) + (proUsage.completion_tokens || 0),
      total_tokens: (flashUsage.total_tokens || 0) + (proUsage.total_tokens || 0),
      model: MODELS.GEMINI_3_PRO,
      total_cost: (flashUsage.total_cost || 0) + (proUsage.total_cost || 0),
      stages: mergedStages
    };

    return {
      ...proResult,
      usage: mergedUsage,
      router: { decision: 'pro', reasons: decision.reasons, fallback_model: MODELS.GEMINI_3_FLASH }
    };
  } catch (error: any) {
    safeWarn(`⚠️ [SMART ROUTER] Pro unavailable, returning Flash result: ${error.message}`);
    return {
      ...flashResult,
      router: { decision: 'flash_fallback', reasons: decision.reasons }
    };
  }
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
  isComparative?: boolean;
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
      specialty: specialty,
      enableSmartRouting: true,
      isComparative: options.isComparative === true
    });
    const jsonExtraction = extractionResult.data;
    const initialUsage = extractionResult.usage;
    
    const { getDirectivePrompt, RADIOLOGY_PROTOCOL_PROMPT, STRATEGIC_SYSTEM_PROMPT } = await import('./prompts');
    const directiveCriteria = getDirectivePrompt(imageType, options.prompt, specialty);
    
    const textModel = options.targetModel || MODELS.SONNET;
    let stage2ModelUsed = textModel;
    const fallbackModel = getStage2FallbackModel(textModel);
    
    const contextPrompt = `${options.isComparative
      ? 'Ты — экспертный интеллектуальный ассистент с компетенциями профессора медицины. Проведи сравнительную клиническую интерпретацию данных по НЕСКОЛЬКИМ изображениям, полученных от Специалиста.'
      : 'Ты — экспертный интеллектуальный ассистент с компетенциями профессора медицины. Проведи единый клинический анализ набора изображений одного исследования, без трактовки динамики во времени.'} ОТВЕЧАЙ СТРОГО НА РУССКОМ ЯЗЫКЕ.

### ДАННЫЕ ОТ СПЕЦИАЛИСТА (JSON):
${JSON.stringify(jsonExtraction, null, 2)}

${options.clinicalContext ? `### КЛИНИЧЕСКИЙ КОНТЕКСТ ПАЦИЕНТА:\n${options.clinicalContext}\n\n` : ''}ПРОАНАЛИЗИРУЙ ДАННЫЕ И СФОРМУЛИРУЙ ПОЛНЫЙ ОТЧЕТ НА РУССКОМ ЯЗЫКЕ.

ИНСТРУКЦИЯ К КЛИНИЧЕСКОЙ ДИРЕКТИВЕ:
${directiveCriteria}`;
    
    const basePrompt = isRadiologyOnly ? RADIOLOGY_PROTOCOL_PROMPT : (specialty === 'ai_consultant' ? SYSTEM_PROMPT : STRATEGIC_SYSTEM_PROMPT);
    safeLog(`🚀 [MULTI-TWO-STAGE] Шаг 2: ${textModel} анализирует данные (JSON)...`);

    const runStage2Request = async (targetModel: string) => {
      return fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://doctor-opus.online',
          'X-Title': 'Doctor Opus'
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [
            { role: 'system' as const, content: basePrompt },
            { role: 'user' as const, content: contextPrompt }
          ],
          max_tokens: 12000, // Оптимизировано: множественные изображения
          temperature: 0.1,
        })
      });
    };

    let textResponse = await runStage2Request(textModel);
    if (!textResponse.ok) {
      const errorText = await textResponse.text();
      const shouldFallback = !!fallbackModel && shouldUseStage2GeoFallback(textModel, textResponse.status, errorText);
      if (shouldFallback) {
        safeWarn(`⚠️ [MULTI-TWO-STAGE] Региональная недоступность ${textModel}, переключение на ${fallbackModel}`);
        stage2ModelUsed = fallbackModel!;
        textResponse = await runStage2Request(stage2ModelUsed);
      } else {
        throw new Error(`OpenRouter error: ${textResponse.status} - ${errorText.substring(0, 300)}`);
      }
    }

    if (!textResponse.ok) {
      const errorText = await textResponse.text();
      throw new Error(`OpenRouter error: ${textResponse.status} - ${errorText.substring(0, 300)}`);
    }

    const textData = await textResponse.json();
    const result = textData.choices[0].message.content || '';

    // Логирование токенов и стоимости
    const combinedCost = calculateCombinedCost([
      {
        model: initialUsage?.model || MODELS.GEMINI_3_FLASH,
        prompt_tokens: initialUsage?.prompt_tokens || 0,
        completion_tokens: initialUsage?.completion_tokens || 0,
      },
      {
        model: stage2ModelUsed,
        prompt_tokens: textData.usage?.prompt_tokens || 0,
        completion_tokens: textData.usage?.completion_tokens || 0,
      }
    ]);

    safeLog('✅ [MULTI-TWO-STAGE] Анализ завершен');
    if (combinedCost.totalTokens > 0) {
      safeLog(`   📊 ИТОГО (комбинированно): ${combinedCost.totalTokens.toLocaleString('ru-RU')} токенов, ${combinedCost.totalCostUnits.toFixed(2)} ед. ($${combinedCost.totalCostUsd.toFixed(4)})`);
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
    throw new Error('OPENROUTER_API_KEY не настроен. Проверьте переменные окружения.');
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
    max_tokens: options.maxTokens || 12000, // Оптимизировано для сравнительного анализа
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
        'HTTP-Referer': 'https://doctor-opus.online',
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
      throw new Error('Ошибка сети при обращении к OpenRouter API. Проверьте подключение к интернету и настройки сервера.');
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
    throw new Error('OPENROUTER_API_KEY не настроен. Проверьте переменные окружения.');
  }

  let selectedModel = model;
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

  try {
    safeLog('Calling OpenRouter API for text:', {
      url: OPENROUTER_API_URL,
      model: selectedModel,
      hasApiKey: !!apiKey,
      promptLength: prompt.length
    });

    const REQUEST_TIMEOUT_MS = 45000;
    const MAX_RETRIES = 2;
    let response: Response | null = null;
    const sendWithRetries = async (targetModel: string): Promise<Response> => {
      let attemptResponse: Response | null = null;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const payload = {
          model: targetModel,
          messages,
          max_tokens: 10000, // Оптимизировано: текстовый запрос
          temperature: 0.1,
        };
        try {
          attemptResponse = await fetchWithTimeout(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          }, REQUEST_TIMEOUT_MS);
          return attemptResponse;
        } catch (err: any) {
          const message = String(err?.message || '').toLowerCase();
          const isTransientNetworkError =
            err?.name === 'AbortError' ||
            err?.name === 'TimeoutError' ||
            message.includes('fetch failed') ||
            message.includes('und_err_connect_timeout') ||
            message.includes('etimedout') ||
            message.includes('econnreset') ||
            message.includes('econnrefused') ||
            message.includes('enotfound') ||
            message.includes('network');

          if (!isTransientNetworkError || attempt === MAX_RETRIES) {
            throw err;
          }

          const backoffMs = 1200 * (attempt + 1);
          safeWarn(`OpenRouter text request transient network error (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${backoffMs}ms`);
          await sleep(backoffMs);
        }
      }
      throw new Error('OpenRouter text request failed: no response received');
    };

    response = await sendWithRetries(selectedModel);

    if (!response) {
      throw new Error('OpenRouter text request failed: no response received');
    }

    safeLog('OpenRouter API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      const fallbackModel = getChatFallbackModel(selectedModel);
      const shouldFallback = !!fallbackModel && isGeoRestrictionStatus(response.status) && isOpenAIGeoRestrictionError(errorText);
      if (shouldFallback) {
        safeWarn(`⚠️ [CHAT FALLBACK] Модель ${selectedModel} недоступна по региону, переключаемся на ${fallbackModel}`);
        selectedModel = fallbackModel!;
        response = await sendWithRetries(selectedModel);
      } else {
        safeError('OpenRouter API error response:', errorText);
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText.substring(0, 500)}`);
      }
    }

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
    
    if (
      error.message.includes('fetch failed') ||
      error.message.includes('network') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('UND_ERR_CONNECT_TIMEOUT') ||
      error.message.includes('ETIMEDOUT') ||
      error.message.includes('ECONNRESET')
    ) {
      throw new Error('Ошибка сети при обращении к OpenRouter API. Проверьте подключение к интернету и настройки сервера.');
    }
    
    throw new Error(`Ошибка запроса: ${error.message}`);
  }
}
