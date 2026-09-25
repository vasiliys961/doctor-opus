/**
 * Стриминг для OpenRouter API
 * Реализует Server-Sent Events (SSE) для постепенного получения ответов и двухэтапный анализ
 */

import { calculateCombinedCost, calculateCost, formatCostLog } from './cost-calculator';
import { type ImageType, type Specialty, SYSTEM_PROMPT, DIALOGUE_SYSTEM_PROMPT, STRATEGIC_SYSTEM_PROMPT, prepareVisionDataForTextPrompt, resolvePromptRuntimeVars } from './prompts';
import { isAnthropicModel, isGeoRestrictionStatus, isOpenAIGeoRestrictionError, shouldUseStage2GeoFallback } from './geo-restriction';
import { getValidatedOpusModel } from './validated-opus-model';
import { canSwitchToNextLlmProvider, getLlmApiKey, getLlmChatCompletionsUrl, getLlmEndpointChain } from './llm-provider';
import { CLINICAL_DRAFT_DISCLAIMER } from './clinical-disclaimer';

const OPENROUTER_API_URL = getLlmChatCompletionsUrl();

// Актуальные модели (последние флагманы 2025-2026)
const MODELS = {
  OPUS: 'anthropic/claude-opus-5.5',                         // Claude Opus 5.5
  OPUS_VALIDATED: getValidatedOpusModel(),                 // Default: Opus 5.5, rollback: VALIDATED_OPUS_MODEL=4.7
  SONNET: 'anthropic/claude-sonnet-5',                   // Claude Sonnet 5
  GPT_5_2: 'openai/gpt-5.6-sol',                    // GPT-5.6 Sol (legacy key name kept for compatibility)
  HAIKU: 'anthropic/claude-haiku-4.5',                   // Claude Haiku 4.5
  LLAMA: 'meta-llama/llama-3.2-90b-vision-instruct',     // Резерв
  GEMINI_3_FLASH: 'google/gemini-3.8-flash',       // Gemini 3.8 Flash
  GEMINI_3_PRO: 'google/gemini-3.8-flash'          // Secondary vision model (same as flash)
};

function isNetworkStage2Error(error: any): boolean {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('fetch failed') ||
    message.includes('und_err_connect_timeout') ||
    message.includes('etimedout') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('network')
  );
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

async function fetchLlmStreamWithFallback(payload: unknown, timeoutMs = 45000): Promise<Response> {
  const endpoints = getLlmEndpointChain();
  let lastError: unknown = null;

  for (let i = 0; i < endpoints.length; i += 1) {
    const endpoint = endpoints[i];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const attemptResponse = await fetch(endpoint.chatCompletionsUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${endpoint.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://doctor-opus.online',
          'X-Title': 'Doctor Opus',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (attemptResponse.ok || !canSwitchToNextLlmProvider(attemptResponse.status, i, endpoints.length)) {
        return attemptResponse;
      }
      console.warn(`⚠️ [VISION STREAM] ${endpoint.name} returned ${attemptResponse.status}, switching once`);
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;
      if (i >= endpoints.length - 1) {
        throw error;
      }
      console.warn(`⚠️ [VISION STREAM] ${endpoint.name} failed, switching once`);
    }
  }

  throw lastError || new Error('LLM streaming request failed');
}

function shouldUsePermissionFallback(primaryModel: string, status: number, errorText: string): boolean {
  if (primaryModel !== MODELS.GPT_5_2) return false;
  const normalized = (errorText || '').toLowerCase();
  return (
    status === 401 ||
    status === 403 ||
    normalized.includes('permission_denied') ||
    normalized.includes('provider returned error') ||
    normalized.includes('azure')
  );
}

/**
 * Вспомогательная функция для преобразования потока с добавлением расчета стоимости
 */
function createTransformWithUsage(
  stream: ReadableStream, 
  model: string, 
  initialUsage?: { prompt_tokens: number, completion_tokens: number, model?: string, total_cost?: number, stages?: Array<{ model: string; prompt_tokens: number; completion_tokens: number }> },
  isEstimate: boolean = false,
  transformOptions?: { skipDisclaimer?: boolean }
): ReadableStream<Uint8Array> {
  const reader = stream.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let usageReceived = false;
  let totalContent = ''; // Собираем весь контент для fallback-расчёта

  return new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            // КРИТИЧНО: Fallback ПЕРЕД закрытием контроллера
            if (!usageReceived && totalContent) {
              try {
                const { calculateCost, formatCostLog } = await import('./cost-calculator');
                const { estimateTokens } = await import('./adaptive-tokens');
                
                const approxOutputTokens = estimateTokens(totalContent);
                // Если у нас есть оценка или реальные данные из прошлых этапов
                const approxInputTokens = initialUsage?.prompt_tokens || 0;
                const totalTokens = approxInputTokens + approxOutputTokens;
                
                const stageTwoCost = calculateCost(0, approxOutputTokens, model);
                const stageOneCostUnits = isEstimate
                  ? 0
                  : (typeof initialUsage?.total_cost === 'number'
                    ? initialUsage.total_cost
                    : (Array.isArray(initialUsage?.stages) && initialUsage.stages.length > 0
                      ? calculateCombinedCost(initialUsage.stages).totalCostUnits
                      : (initialUsage?.model
                        ? calculateCost(initialUsage.prompt_tokens || 0, initialUsage.completion_tokens || 0, initialUsage.model).totalCostUnits
                        : 0)));
                const totalCostUnits = stageOneCostUnits + stageTwoCost.totalCostUnits;
                
                console.log(`✅ [STREAMING FALLBACK] Анализ завершен (${model})`);
                if (initialUsage && initialUsage.prompt_tokens > 0) {
                  console.log(`   🔸 Входные токены (оценка): ${initialUsage.prompt_tokens}`);
                }
                if (!isEstimate && (typeof initialUsage?.total_cost === 'number' || (Array.isArray(initialUsage?.stages) && initialUsage.stages.length > 0))) {
                  console.log(`   📊 ИТОГО (примерно, комбинированно): ${totalTokens.toLocaleString('ru-RU')} токенов, ${totalCostUnits.toFixed(2)} ед.`);
                } else {
                  console.log(`   📊 ИТОГО (примерно): ${formatCostLog(model, approxInputTokens, approxOutputTokens, totalTokens)}`);
                }
                
                // Отправляем usage клиенту ПЕРЕД завершением
                const usageUpdate = {
                  usage: {
                    prompt_tokens: approxInputTokens,
                    completion_tokens: approxOutputTokens,
                    total_tokens: totalTokens,
                    total_cost: totalCostUnits
                  },
                  model: model
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(usageUpdate)}\n\n`));
              } catch (e) {
                console.error('[USAGE FALLBACK] Ошибка расчёта:', e);
              }
            }
            if (!transformOptions?.skipDisclaimer && !totalContent.includes('Draft Clinical Output (Beta)')) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    choices: [{ delta: { content: `\n\n${CLINICAL_DRAFT_DISCLAIMER}` } }],
                  })}\n\n`
                )
              );
            }

            // Отдаем [DONE] только после отправки usage/fallback и юридического постфикса
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            break; // Выходим из цикла
          }

          const chunk = decoder.decode(value, { stream: true });
          
          // Не пробрасываем provider [DONE] напрямую: иначе UI может завершить чтение
          // до получения отдельного чанка с usage/cost.
          const chunkWithoutDone = chunk.replace(/data:\s*\[DONE\]\s*\n\n/g, '');
          if (chunkWithoutDone) {
            controller.enqueue(encoder.encode(chunkWithoutDone));
          }
          
          // Обрабатываем контент для fallback и точного usage
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (dataStr === '[DONE]') continue;
              
              try {
                const data = JSON.parse(dataStr);
                
                // Собираем текст ответа
                if (data.choices?.[0]?.delta?.content) {
                  totalContent += data.choices[0].delta.content;
                }
                
                if (data.usage) {
                  usageReceived = true; // Пометили, что usage пришёл
                  
                  // МГНОВЕННО рассчитываем и логируем (без таймаутов)
                  try {
                    const { calculateCost, formatCostLog } = await import('./cost-calculator');
                    
                    // Если это НЕ оценка, а реальные данные из прошлого этапа (Gemini), то суммируем.
                    // Если это была просто оценка для fallback в чате (isEstimate=true), 
                    // то НЕ суммируем, так как data.usage уже включает входные токены.
                    const totalPrompt = data.usage.prompt_tokens + (isEstimate ? 0 : (initialUsage?.prompt_tokens || 0));
                    const totalCompletion = data.usage.completion_tokens + (isEstimate ? 0 : (initialUsage?.completion_tokens || 0));
                    const totalTokens = totalPrompt + totalCompletion;

                    const stageTwoPrompt = data.usage.prompt_tokens || 0;
                    const stageTwoCompletion = data.usage.completion_tokens || 0;
                    const stageTwoCost = calculateCost(stageTwoPrompt, stageTwoCompletion, model);
                    const stageOneCostUnits = isEstimate
                      ? 0
                      : (typeof initialUsage?.total_cost === 'number'
                        ? initialUsage.total_cost
                        : (Array.isArray(initialUsage?.stages) && initialUsage.stages.length > 0
                          ? calculateCombinedCost(initialUsage.stages).totalCostUnits
                          : (initialUsage?.model
                            ? calculateCost(initialUsage.prompt_tokens || 0, initialUsage.completion_tokens || 0, initialUsage.model).totalCostUnits
                            : 0)));
                    const totalCostUnits = stageOneCostUnits + stageTwoCost.totalCostUnits;
                    
                    console.log(`✅ [STREAMING] Анализ завершен успешно (${model})`);
                    if (initialUsage && !isEstimate && (initialUsage.prompt_tokens > 0 || initialUsage.completion_tokens > 0)) {
                      console.log(`   🔸 Предварительные токены: ${initialUsage.prompt_tokens + initialUsage.completion_tokens}`);
                    }
                    if (!isEstimate && (typeof initialUsage?.total_cost === 'number' || (Array.isArray(initialUsage?.stages) && initialUsage.stages.length > 0))) {
                      console.log(`   📊 ИТОГО (комбинированно): ${totalTokens.toLocaleString('ru-RU')} токенов, ${totalCostUnits.toFixed(2)} ед.`);
                    } else {
                      console.log(`   📊 ИТОГО: ${formatCostLog(model, totalPrompt, totalCompletion, totalTokens)}`);
                    }
                    
                    // Отправляем обновленный usage отдельным чанком
                    const usageUpdate = {
                      usage: {
                        prompt_tokens: totalPrompt,
                        completion_tokens: totalCompletion,
                        total_tokens: totalTokens,
                        total_cost: totalCostUnits
                      },
                      model: model
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(usageUpdate)}\n\n`));
                  } catch (e) {
                    console.error('[USAGE] Ошибка вычисления:', e);
                  }
                }
              } catch (e) {}
            }
          }
        }
      } catch (error) {
        controller.error(error);
      } finally {
        controller.close();
        reader.releaseLock();
      }
    }
  });
}

/**
 * Streaming быстрый анализ (Gemini 3.0 JSON -> Gemini 3.0 Professor Mode)
 */
export async function analyzeImageFastStreaming(
  prompt: string,
  imagesBase64: string | string[],
  imageType?: string,
  clinicalContext?: string,
  specialty?: Specialty,
  history: any[] = [],
  isRadiologyOnly: boolean = false,
  isComparative: boolean = false
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = getLlmApiKey();
  if (!apiKey) throw new Error('LLM_API_KEY (or OPENROUTER_API_KEY) is not configured');

  const allImages = Array.isArray(imagesBase64) ? imagesBase64 : [imagesBase64];

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    let heartbeat: any;
    try {
      // 1. Форсированный старт потока (Padding)
      const padding = ': ' + ' '.repeat(2048) + '\n\n';
      await writer.write(encoder.encode(padding));

      await writer.write(encoder.encode(': extracting\n\n'));

      // 2. Запускаем фоновый Heartbeat на весь период анализа
      heartbeat = setInterval(async () => {
        try {
          await writer.write(encoder.encode(': keep-alive heartbeat\n\n'));
        } catch (e) {
          if (heartbeat) clearInterval(heartbeat);
        }
      }, 5000);

      const { extractImageJSON } = await import('./openrouter');
      const extractionResult = await extractImageJSON({
        imagesBase64: allImages,
        modality: imageType || 'unknown',
        specialty: specialty,
        enableSmartRouting: false,
        preferModel: MODELS.GEMINI_3_FLASH,
        isComparative
      });
      const jsonExtraction = extractionResult.data;
      const initialUsage = extractionResult.usage;

      const { getDirectivePrompt, RADIOLOGY_PROTOCOL_PROMPT } = await import('./prompts');
      const directivePrompt = getDirectivePrompt(imageType as any, prompt, specialty);

      // Выбираем системный промпт: для первого сообщения - полная директива, для диалога - краткий режим
      const basePrompt = isRadiologyOnly ? RADIOLOGY_PROTOCOL_PROMPT : (specialty === 'ai_consultant' ? SYSTEM_PROMPT : STRATEGIC_SYSTEM_PROMPT);
      let systemPrompt = history.length > 0 ? DIALOGUE_SYSTEM_PROMPT : basePrompt;
      
      const mainPrompt = `Below are the extracted image data. As an expert medical AI assistant with professor-level competency, analyze them.
    
=== STRUCTURED DATA FROM GEMINI 3.0 ===
${JSON.stringify(prepareVisionDataForTextPrompt(jsonExtraction), null, 2)}

=== CONTEXT ===
${clinicalContext || 'None'}

=== INSTRUCTION ===
${directivePrompt}`;

      const model = MODELS.GEMINI_3_FLASH;

      const response = await fetchLlmStreamWithFallback({
        model,
        messages: [
          { role: 'system', content: resolvePromptRuntimeVars(systemPrompt) },
          { role: 'user', content: mainPrompt }
        ],
        max_tokens: 8000,
        temperature: 0.1,
        stream: true,
        stream_options: { include_usage: true }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Fast analysis failed: ${response.status} - ${errorText}`);
      }

      // Heartbeat остановится в finally
      const transformer = createTransformWithUsage(response.body!, model, initialUsage);
      const reader = transformer.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
      }
    } catch (error: any) {
      console.error('Fast Stream Error:', error);
      try {
        await writer.write(encoder.encode(`data: ${JSON.stringify({ error: { message: error.message || 'Fast analysis failed' } })}\n\n`));
      } catch {}
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      try { await writer.close(); } catch {}
    }
  })();

  return readable;
}

/**
 * Streaming оптимизированный анализ (Gemini JSON → Основная модель)
 */
export async function analyzeImageOpusTwoStageStreaming(
  prompt: string,
  imageBase64: string,
  imageType?: ImageType,
  clinicalContext?: string,
  specialty?: Specialty,
  model: string = MODELS.SONNET,
  history: any[] = [],
  isRadiologyOnly: boolean = false,
  mimeType: string = 'image/png'
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = getLlmApiKey();
  if (!apiKey) throw new Error('LLM_API_KEY (or OPENROUTER_API_KEY) is not configured');

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Запускаем процесс асинхронно
  (async () => {
    let heartbeat: any;
    try {
      // 1. Форсированный старт потока (Padding) - 4KB для обхода агрессивных прокси
      const padding = ': ' + ' '.repeat(4096) + '\n\n';
      await writer.write(encoder.encode(padding));

      await writer.write(encoder.encode(': extracting\n\n'));

      // 3. Фоновый Heartbeat для поддержания канала
      heartbeat = setInterval(async () => {
        try {
          await writer.write(encoder.encode(': keep-alive heartbeat\n\n'));
        } catch (e) {
          if (heartbeat) clearInterval(heartbeat);
        }
      }, 5000);

      console.log(`🚀 [OPTIMIZED STREAMING] Шаг 1: Извлечение JSON...`);
      const { extractImageJSON } = await import('./openrouter');
      const extractionResult = await extractImageJSON({ imageBase64, modality: imageType || 'unknown', specialty, enableSmartRouting: true });
      const jsonExtraction = extractionResult.data;
      const initialUsage = extractionResult.usage;
      
      // Показываем краткую сводку извлеченных данных
      await writer.write(encoder.encode(': writing-report\n\n'));

      const { getDirectivePrompt, RADIOLOGY_PROTOCOL_PROMPT, STRATEGIC_SYSTEM_PROMPT } = await import('./prompts');
      const directivePrompt = getDirectivePrompt(imageType || 'universal', prompt, specialty);

      // Формируем единый контекст для основной модели
      const mainPrompt = `INSTRUCTION: ${directivePrompt}

### TECHNICAL IMAGE DATA (JSON):
${JSON.stringify(prepareVisionDataForTextPrompt(jsonExtraction), null, 2)}

${clinicalContext ? `### PATIENT CLINICAL CONTEXT:\n${clinicalContext}\n\n` : ''}ANALYZE THE DATA AND GENERATE A COMPLETE REPORT.`;

      // Настройка системного промпта
      const { TITAN_CONTEXTS } = await import('./prompts');
      // Выбираем системный промпт: для первого сообщения - полная директива, для диалога - краткий режим
      const basePrompt = isRadiologyOnly ? RADIOLOGY_PROTOCOL_PROMPT : (specialty === 'ai_consultant' ? SYSTEM_PROMPT : STRATEGIC_SYSTEM_PROMPT);
      let systemPrompt = history.length > 0 ? DIALOGUE_SYSTEM_PROMPT : basePrompt;
      if (specialty && TITAN_CONTEXTS[specialty]) {
        systemPrompt = `${systemPrompt}\n\n${TITAN_CONTEXTS[specialty]}`;
      }

      console.log(`📡 [OPTIMIZED STREAMING] Шаг 2: Запуск ${model} (единый поток)...`);
      const fallbackModel = getStage2FallbackModel(model);
      let stage2ModelUsed = model;

      const runStage2Request = async (targetModel: string) => {
        return fetchLlmStreamWithFallback({
          model: targetModel,
          messages: [
            { role: 'system', content: resolvePromptRuntimeVars(systemPrompt) },
            {
              role: 'user',
              content: imageType === 'lab'
                ? mainPrompt
                : [
                    { type: 'text', text: mainPrompt },
                    { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
                  ]
            }
          ],
          max_tokens: 8000,
          temperature: 0.1,
          stream: true,
          stream_options: { include_usage: true },
          ...(targetModel.includes('gpt') ? { reasoning: { effort: 'low' } } : {}),
        }, 120000);
      };

      let response: Response;
      try {
        response = await runStage2Request(model);
      } catch (primaryError: any) {
        const shouldFallback = !!fallbackModel && isNetworkStage2Error(primaryError);
        if (!shouldFallback) {
          throw primaryError;
        }

        const switchMsg = `\n\n> Primary model timed out or had a network issue. Switching to ${fallbackModel} fallback...\n\n`;
        await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: switchMsg } }] })}\n\n`));
        stage2ModelUsed = fallbackModel!;
        response = await runStage2Request(stage2ModelUsed);
      }

      if (!response.ok) {
        const errorText = await response.text();
        const shouldFallback = !!fallbackModel && stage2ModelUsed === model && shouldUseStage2GeoFallback(model, response.status, errorText);
        if (shouldFallback) {
          const switchMsg = `\n\n> Primary model is temporarily unavailable in the current provider region. Switching to ${fallbackModel} fallback...\n\n`;
          await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: switchMsg } }] })}\n\n`));
          stage2ModelUsed = fallbackModel!;
          response = await runStage2Request(stage2ModelUsed);
        } else {
          throw new Error(`Main model failed: ${response.status} - ${errorText}`);
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Main model failed: ${response.status} - ${errorText}`);
      }

      // Перенаправляем поток через наш трансформер с учетом начальных токенов Gemini
      const transformer = createTransformWithUsage(response.body!, stage2ModelUsed, initialUsage);
      const reader = transformer.getReader();
      let gotBytes = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value?.byteLength) gotBytes = true;
        await writer.write(value);
        process.stdout.write('·');
      }
      if (!gotBytes) {
        throw new Error('The model returned an empty report. Try again.');
      }

    } catch (error: any) {
      console.error('Optimized Stream Error:', error);
      try { await writer.write(encoder.encode(`data: ${JSON.stringify({ error: { message: error.message || 'Optimized analysis failed' } })}\n\n`)); } catch {}
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      try { await writer.close(); } catch {}
    }
  })();

  return readable;
}

/**
 * Streaming оптимизированный анализ для множественных изображений (Gemini JSON → Основная модель)
 */
export async function analyzeMultipleImagesOpusTwoStageStreaming(
  prompt: string,
  imagesBase64: string[],
  imageType?: ImageType,
  clinicalContext?: string,
  mimeTypes: string[] = [],
  model: string = MODELS.SONNET,
  specialty?: Specialty,
  history: any[] = [],
  isRadiologyOnly: boolean = false,
  isComparative: boolean = false
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = getLlmApiKey();
  if (!apiKey) throw new Error('LLM_API_KEY (or OPENROUTER_API_KEY) is not configured');

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    let heartbeat: any;
    try {
      // 1. Форсированный старт потока
      const padding = ': ' + ' '.repeat(4096) + '\n\n';
      await writer.write(encoder.encode(padding));

      await writer.write(encoder.encode(': extracting\n\n'));

      // 3. Запускаем фоновый Heartbeat на весь период анализа
      heartbeat = setInterval(async () => {
        try {
          await writer.write(encoder.encode(': keep-alive heartbeat\n\n'));
        } catch (e) {
          if (heartbeat) clearInterval(heartbeat);
        }
      }, 5000);

      console.log(`🚀 [MULTI-OPTIMIZED STREAMING] Шаг 1: Извлечение JSON...`);
      const { extractImageJSON } = await import('./openrouter');
      const extractionResult = await extractImageJSON({
        imagesBase64,
        modality: imageType || 'unknown',
        specialty: specialty,
        enableSmartRouting: true,
        isComparative
      });
      const jsonExtraction = extractionResult.data;
      const initialUsage = extractionResult.usage;

      // Показываем краткую сводку
      await writer.write(encoder.encode(': writing-report\n\n'));

      const { getDirectivePrompt, RADIOLOGY_PROTOCOL_PROMPT } = await import('./prompts');
      const directivePrompt = getDirectivePrompt(imageType || 'universal', prompt, specialty);

      const mainPrompt = `INSTRUCTION: ${directivePrompt}

### ${isComparative ? 'COMPARATIVE IMAGE DATA' : 'DATA FROM MULTIPLE IMAGES OF A SINGLE STUDY'} (JSON):
${JSON.stringify(prepareVisionDataForTextPrompt(jsonExtraction), null, 2)}

${clinicalContext ? `### PATIENT CLINICAL CONTEXT:\n${clinicalContext}\n\n` : ''}ANALYZE THE DATA AND GENERATE A COMPLETE REPORT.`;

      // Настройка системного промпта
      const { TITAN_CONTEXTS } = await import('./prompts');
      // Выбираем системный промпт
      const basePrompt = isRadiologyOnly ? RADIOLOGY_PROTOCOL_PROMPT : (specialty === 'ai_consultant' ? SYSTEM_PROMPT : STRATEGIC_SYSTEM_PROMPT);
      let systemPrompt = history.length > 0 ? DIALOGUE_SYSTEM_PROMPT : basePrompt;
      if (specialty && TITAN_CONTEXTS[specialty]) {
        systemPrompt = `${systemPrompt}\n\n${TITAN_CONTEXTS[specialty]}`;
      }

      console.log(`📡 [MULTI-OPTIMIZED STREAMING] Шаг 2: Запуск ${model} (единый поток)...`);

      const contentItems: any[] = [
        { type: 'text', text: mainPrompt },
        ...imagesBase64.map((img, i) => ({
          type: 'image_url',
          image_url: { url: `data:${mimeTypes[i] || 'image/png'};base64,${img}` }
        }))
      ];

      const fallbackModel = getStage2FallbackModel(model);
      let stage2ModelUsed = model;
      const runStage2Request = async (targetModel: string) => {
        return fetchLlmStreamWithFallback({
          model: targetModel,
          messages: [
            { role: 'system', content: resolvePromptRuntimeVars(systemPrompt) },
            { role: 'user', content: contentItems }
          ],
          max_tokens: 12000,
          temperature: 0.1,
          stream: true,
          stream_options: { include_usage: true }
        }, 180000);
      };

      let response: Response;
      try {
        response = await runStage2Request(model);
      } catch (primaryError: any) {
        const shouldFallback = !!fallbackModel && isNetworkStage2Error(primaryError);
        if (!shouldFallback) {
          throw primaryError;
        }
        const switchMsg = `\n\n> Primary model timed out or had a network issue. Switching to ${fallbackModel} fallback...\n\n`;
        await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: switchMsg } }] })}\n\n`));
        stage2ModelUsed = fallbackModel!;
        response = await runStage2Request(stage2ModelUsed);
      }

      // Heartbeat остановится в finally
      if (!response.ok) {
        const errorText = await response.text();
        const shouldFallback = !!fallbackModel && stage2ModelUsed === model && shouldUseStage2GeoFallback(model, response.status, errorText);
        if (shouldFallback) {
          const switchMsg = `\n\n> Primary model is temporarily unavailable in the current provider region. Switching to ${fallbackModel} fallback...\n\n`;
          await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: switchMsg } }] })}\n\n`));
          stage2ModelUsed = fallbackModel!;
          response = await runStage2Request(stage2ModelUsed);
        } else {
          throw new Error(`Main model failed: ${response.status} - ${errorText}`);
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Main model failed: ${response.status} - ${errorText}`);
      }

      const transformer = createTransformWithUsage(response.body!, stage2ModelUsed, initialUsage);
      const reader = transformer.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
        process.stdout.write('·');
      }

    } catch (error: any) {
      console.error('Multi-Optimized Stream Error:', error);
      try { await writer.write(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`)); } catch {}
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      try { await writer.close(); } catch {};
    }
  })();

  return readable;
}

/**
 * Streaming анализ множественных изображений через Основную модель с использованием JSON от Gemini (Validated)
 */
export async function analyzeMultipleImagesWithJSONStreaming(
  prompt: string,
  imagesBase64: string[],
  imageType?: ImageType,
  clinicalContext?: string,
  mimeTypes: string[] = [],
  specialty?: Specialty,
  model: string = MODELS.OPUS,
  history: any[] = []
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = getLlmApiKey();
  if (!apiKey) throw new Error('LLM_API_KEY (or OPENROUTER_API_KEY) is not configured');

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    let heartbeat: any;
    try {
      // Padding для форсирования flush
      const padding = ': ' + ' '.repeat(4096) + '\n\n';
      await writer.write(encoder.encode(padding));

      await writer.write(encoder.encode(': extracting\n\n'));

      // 3. Запускаем фоновый Heartbeat
      heartbeat = setInterval(() => {
        try {
          writer.write(encoder.encode(': keep-alive heartbeat\n\n'));
        } catch (e) {
          if (heartbeat) clearInterval(heartbeat);
        }
      }, 5000);

      const { extractImageJSON } = await import('./openrouter');
      const extractionResult = await extractImageJSON({ imagesBase64, modality: imageType || 'unknown', specialty, enableSmartRouting: true });
      const jsonExtraction = extractionResult.data;
      const initialUsage = extractionResult.usage;

      await writer.write(encoder.encode(': writing-report\n\n'));

      const { getDirectivePrompt } = await import('./prompts');
      const directivePrompt = getDirectivePrompt(imageType || 'universal', prompt, specialty);

      const mainPrompt = `INSTRUCTION: ${directivePrompt}

### СТРУКТУРИРОВАННЫЕ ДАННЫЕ ИЗ ИЗОБРАЖЕНИЙ (JSON):
${JSON.stringify(prepareVisionDataForTextPrompt(jsonExtraction), null, 2)}

${clinicalContext ? `### PATIENT CLINICAL CONTEXT:\n${clinicalContext}\n\n` : ''}ANALYZE THE DATA AND GENERATE A COMPLETE EXPERT REPORT.`;

      const { TITAN_CONTEXTS } = await import('./prompts');
      // Выбираем системный промпт: для первого сообщения - полная директива, для диалога - краткий режим
      const basePrompt = specialty === 'ai_consultant' ? SYSTEM_PROMPT : STRATEGIC_SYSTEM_PROMPT;
      let systemPrompt = history.length > 0 ? DIALOGUE_SYSTEM_PROMPT : basePrompt;
      if (specialty && TITAN_CONTEXTS[specialty]) {
        systemPrompt = `${systemPrompt}\n\n${TITAN_CONTEXTS[specialty]}`;
      }

      console.log(`📡 [MULTI-VALIDATED STREAMING] Шаг 2: Запуск ${model} (единый поток)...`);

      const contentItems: any[] = [
        { type: 'text', text: mainPrompt },
        ...imagesBase64.map((img, i) => ({
          type: 'image_url',
          image_url: { url: `data:${mimeTypes[i] || 'image/png'};base64,${img}` }
        }))
      ];

      const fallbackModel = getStage2FallbackModel(model);
      let stage2ModelUsed = model;
      const runStage2Request = async (targetModel: string) => {
        return fetchLlmStreamWithFallback({
          model: targetModel,
          messages: [
            { role: 'system', content: resolvePromptRuntimeVars(systemPrompt) },
            { role: 'user', content: contentItems }
          ],
          max_tokens: 10000,
          temperature: 0.1,
          stream: true,
          stream_options: { include_usage: true }
        }, 240000);
      };

      let response: Response;
      try {
        response = await runStage2Request(model);
      } catch (primaryError: any) {
        const shouldFallback = !!fallbackModel && isNetworkStage2Error(primaryError);
        if (!shouldFallback) {
          throw primaryError;
        }
        const switchMsg = `\n\n> Primary model timed out or had a network issue. Switching to ${fallbackModel} fallback...\n\n`;
        await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: switchMsg } }] })}\n\n`));
        stage2ModelUsed = fallbackModel!;
        response = await runStage2Request(stage2ModelUsed);
      }

      if (!response.ok) {
        const errorText = await response.text();
        const shouldFallback = !!fallbackModel && stage2ModelUsed === model && shouldUseStage2GeoFallback(model, response.status, errorText);
        if (shouldFallback) {
          const switchMsg = `\n\n> Primary model is temporarily unavailable in the current provider region. Switching to ${fallbackModel} fallback...\n\n`;
          await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: switchMsg } }] })}\n\n`));
          stage2ModelUsed = fallbackModel!;
          response = await runStage2Request(stage2ModelUsed);
        } else {
          throw new Error(`Main model failed: ${response.status} - ${errorText}`);
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Main model failed: ${response.status} - ${errorText}`);
      }

      const transformer = createTransformWithUsage(response.body!, stage2ModelUsed, initialUsage);
      const reader = transformer.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
        process.stdout.write('·');
      }
    } catch (error: any) {
      console.error('Multi-Validated Stream Error:', error);
      try { await writer.write(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`)); } catch {}
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      try { await writer.close(); } catch {};
    }
  })();

  return readable;
}

/**
 * Streaming анализ изображения через Основную модель с использованием JSON от Gemini
 */
export async function analyzeImageWithJSONStreaming(
  jsonExtractionWrapper: any,
  imageBase64: string,
  prompt: string = 'Analyze the medical image.',
  mimeType: string = 'image/png',
  imageType?: ImageType,
  clinicalContext?: string,
  specialty?: Specialty,
  model: string = MODELS.OPUS,
  history: any[] = []
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = getLlmApiKey();
  if (!apiKey) throw new Error('LLM_API_KEY (or OPENROUTER_API_KEY) is not configured');

  const jsonExtraction = jsonExtractionWrapper.data || jsonExtractionWrapper;
  const initialUsage = jsonExtractionWrapper.usage;

  const { getDirectivePrompt } = await import('./prompts');
  const directivePrompt = getDirectivePrompt(imageType || 'universal', prompt, specialty);

  const mainPrompt = `INSTRUCTION: ${directivePrompt}

### TECHNICAL IMAGE DATA (JSON):
${JSON.stringify(prepareVisionDataForTextPrompt(jsonExtraction), null, 2)}

${clinicalContext ? `### PATIENT CLINICAL CONTEXT:\n${clinicalContext}\n\n` : ''}ANALYZE THE DATA AND GENERATE A COMPLETE REPORT.`;

  const { TITAN_CONTEXTS } = await import('./prompts');
  // Выбираем системный промпт: для первого сообщения - полная директива, для диалога - краткий режим
  const basePrompt = specialty === 'ai_consultant' ? SYSTEM_PROMPT : STRATEGIC_SYSTEM_PROMPT;
  let systemPrompt = history.length > 0 ? DIALOGUE_SYSTEM_PROMPT : basePrompt;
  
  if (specialty && TITAN_CONTEXTS[specialty]) {
    systemPrompt = `${systemPrompt}\n\n${TITAN_CONTEXTS[specialty]}`;
  }

  const fallbackModel = getStage2FallbackModel(model);
  let modelUsed = model;

  const runRequest = async (targetModel: string) => {
    return fetchLlmStreamWithFallback({
      model: targetModel,
      messages: [
        { role: 'system', content: resolvePromptRuntimeVars(systemPrompt) },
        {
          role: 'user',
          content: [
            { type: 'text', text: mainPrompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
          ]
        }
      ],
      max_tokens: 8000,
      temperature: 0.1,
      stream: true,
      stream_options: { include_usage: true }
    }, 120000);
  };

  let response = await runRequest(model);
  if (!response.ok) {
    const errorText = await response.text();
    const shouldFallback = !!fallbackModel && shouldUseStage2GeoFallback(model, response.status, errorText);
    console.warn(`[GEO-DEBUG] stream model=${model} status=${response.status} shouldFallback=${shouldFallback} err=${errorText.substring(0, 300)}`);
    if (shouldFallback) {
      modelUsed = fallbackModel!;
      response = await runRequest(modelUsed);
    } else {
      throw new Error(`Main model failed: ${response.status} - ${errorText}`);
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Main model failed: ${response.status} - ${errorText}`);
  }

  return createTransformWithUsage(response.body!, modelUsed, initialUsage);
}

/**
 * Streaming запрос для текстового чата
 */
export async function sendTextRequestStreaming(
  prompt: string,
  history: Array<{role: string, content: string}> = [],
  model: string = MODELS.OPUS,
  specialty?: Specialty,
  customSystemPrompt?: string,
  options?: { skipDisclaimer?: boolean }
): Promise<ReadableStream<Uint8Array>> {
  const providerEndpoints = getLlmEndpointChain();
  if (!providerEndpoints.length) throw new Error('LLM provider endpoints are not configured');

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    let heartbeat: any;
    try {
      // 1. Форсированный старт потока
      const initialPadding = ': ' + ' '.repeat(2048) + '\n\n';
      await writer.write(encoder.encode(initialPadding));

      // 2. Запускаем фоновый Heartbeat на весь период анализа
      heartbeat = setInterval(async () => {
        try {
          // Отправляем комментарий раз в 5 секунд для поддержания канала
          await writer.write(encoder.encode(': keep-alive heartbeat\n\n'));
        } catch (e) {
          if (heartbeat) clearInterval(heartbeat);
        }
      }, 5000);

      const { TITAN_CONTEXTS } = await import('./prompts');
      const { calculateAdaptiveMaxTokens, estimateTokens } = await import('./adaptive-tokens');
      
      // Выбираем системный промпт: Всегда используем полный SYSTEM_PROMPT для глубины аналитики
      // в ИИ-Ассистенте, если не указано иное
      const basePrompt = (specialty === 'ai_consultant' || specialty === 'openevidence') ? SYSTEM_PROMPT : SYSTEM_PROMPT;
      let systemPrompt = customSystemPrompt || basePrompt;
      
      // Для режима диалога (когда это НЕ первое сообщение и НЕ пересылка анализа)
      // можно было бы использовать DIALOGUE_SYSTEM_PROMPT, но пользователь просит ПОЛНЫЙ промпт.
      // Поэтому оставляем SYSTEM_PROMPT как основной.
      
      if (specialty && TITAN_CONTEXTS[specialty]) {
        systemPrompt = `${systemPrompt}\n\n${TITAN_CONTEXTS[specialty]}`;
      }

      const messages = [
        { role: 'system' as const, content: resolvePromptRuntimeVars(systemPrompt) },
        ...history.map(msg => ({ role: msg.role as 'user' | 'assistant', content: msg.content })),
        { role: 'user' as const, content: prompt }
      ];

      // Адаптивный расчёт max_tokens на основе длины диалога
      const adaptiveMaxTokens = calculateAdaptiveMaxTokens({
        systemPrompt,
        history,
        userPrompt: prompt,
        mode: 'chat'
      });

      const REQUEST_TIMEOUT_MS = 45000;
      let response: Response | null = null;
      let modelUsed = model;

      const runStreamingRequest = async (targetModel: string): Promise<Response> => {
        let lastError: any = null;
        for (let i = 0; i < providerEndpoints.length; i += 1) {
          const endpoint = providerEndpoints[i];
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

          try {
            const attemptResponse = await fetch(endpoint.chatCompletionsUrl, {
              method: 'POST',
              headers: {
                  'Authorization': `Bearer ${endpoint.apiKey}`,
                  'Content-Type': 'application/json',
                  'HTTP-Referer': 'https://openrouter.ai',
                  'X-Title': 'Medical AI'
                },
              body: JSON.stringify({
                model: targetModel,
                messages,
                max_tokens: adaptiveMaxTokens, // Адаптивно в зависимости от длины диалога
                temperature: 0.1,
                stream: true,
                stream_options: { include_usage: true }
              }),
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (attemptResponse.ok || !canSwitchToNextLlmProvider(attemptResponse.status, i, providerEndpoints.length)) {
              return attemptResponse;
            }
            console.warn(`⚠️ [TEXT STREAM] ${endpoint.name} returned ${attemptResponse.status}, switching once to OpenRouter`);
          } catch (err: any) {
            clearTimeout(timeoutId);
            lastError = err;
            if (i >= providerEndpoints.length - 1) {
              throw err;
            }
            console.warn(`⚠️ [TEXT STREAM] ${endpoint.name} failed, switching once to OpenRouter`);
          }
        }
        throw lastError || new Error('OpenRouter streaming request failed: no response received');
      };

      response = await runStreamingRequest(modelUsed);

      if (!response) {
        throw new Error('OpenRouter streaming request failed: no response received');
      }

      const initialPromptTokens = estimateTokens(systemPrompt + prompt + history.map(m => m.content).join(' '));
      const initialUsage = { prompt_tokens: initialPromptTokens, completion_tokens: 0 };

      // Heartbeat остановится в finally
      if (!response.ok) {
        const errorText = await response.text();
        const fallbackModel = getChatFallbackModel(modelUsed);
        const shouldFallback = !!fallbackModel && (
          (isGeoRestrictionStatus(response.status) && isOpenAIGeoRestrictionError(errorText)) ||
          shouldUsePermissionFallback(modelUsed, response.status, errorText)
        );
        if (shouldFallback) {
          console.warn(`⚠️ [TEXT STREAM FALLBACK] ${modelUsed} недоступна по региону, переключаемся на ${fallbackModel}`);
          modelUsed = fallbackModel!;
          response = await runStreamingRequest(modelUsed);
        } else {
          throw new Error(`API error: ${response.status} - ${errorText}`);
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const transformer = createTransformWithUsage(response.body!, modelUsed, initialUsage, true, {
        skipDisclaimer: options?.skipDisclaimer,
      });
      const reader = transformer.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
      }
    } catch (error: any) {
      if (heartbeat) clearInterval(heartbeat);
      console.error(`❌ [TEXT STREAM ERROR]:`, error);
      try { await writer.write(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`)); } catch {}
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      try { await writer.close(); } catch {}
    }
  })();

  return readable;
}

/**
 * Streaming анализ изображения через OpenRouter API
 */
export async function analyzeImageStreaming(
  prompt: string,
  imageBase64: string,
  model: string = MODELS.OPUS,
  mimeType: string = 'image/png',
  clinicalContext?: string,
  specialty?: Specialty,
  history: Array<{role: string, content: string}> = [],
  isRadiologyOnly: boolean = false
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = getLlmApiKey();
  if (!apiKey) throw new Error('LLM_API_KEY (or OPENROUTER_API_KEY) is not configured');

  const { TITAN_CONTEXTS, RADIOLOGY_PROTOCOL_PROMPT, STRATEGIC_SYSTEM_PROMPT } = await import('./prompts');
  
  // Выбираем системный промпт: для первого сообщения - полная директива, для диалога - краткий режим
  const basePrompt = isRadiologyOnly ? RADIOLOGY_PROTOCOL_PROMPT : (specialty === 'ai_consultant' ? SYSTEM_PROMPT : STRATEGIC_SYSTEM_PROMPT);
  let systemPrompt = history.length > 0 ? DIALOGUE_SYSTEM_PROMPT : basePrompt;
  
  if (specialty && TITAN_CONTEXTS[specialty]) {
    systemPrompt = `${systemPrompt}\n\n${TITAN_CONTEXTS[specialty]}`;
  }

  let fullPrompt = prompt;
  if (clinicalContext) {
    fullPrompt = `${prompt}\n\n=== PATIENT CLINICAL CONTEXT ===\n${clinicalContext}`;
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    let heartbeat: any;
    try {
      // 1. Форсированный старт потока
      const initialPadding = ': ' + ' '.repeat(2048) + '\n\n';
      await writer.write(encoder.encode(initialPadding));

      // 2. Heartbeat для поддержания соединения
      heartbeat = setInterval(async () => {
        try {
          await writer.write(encoder.encode(': keep-alive heartbeat\n\n'));
        } catch (e) {
          if (heartbeat) clearInterval(heartbeat);
        }
      }, 5000);

      const response = await fetchLlmStreamWithFallback({
        model,
        messages: [
          { role: 'system', content: resolvePromptRuntimeVars(systemPrompt) },
          {
            role: 'user',
            content: [
              { type: 'text', text: fullPrompt },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
            ]
          }
        ],
        max_tokens: 8000,
        temperature: 0.1,
        stream: true,
        stream_options: { include_usage: true }
      }, 90000);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      // Оценка входных токенов для корректного отображения стоимости
      const { estimateTokens } = await import('./adaptive-tokens');
      const initialPromptTokens = estimateTokens(systemPrompt + (typeof fullPrompt === 'string' ? fullPrompt : '') + history.map(m => m.content).join(' '));
      const initialUsage = { prompt_tokens: initialPromptTokens, completion_tokens: 0 };

      const transformer = createTransformWithUsage(response.body!, model, initialUsage, true);
      const reader = transformer.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
      }
    } catch (error: any) {
      console.error(`❌ [IMAGE STREAM ERROR]:`, error);
      try { await writer.write(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`)); } catch {}
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      try { await writer.close(); } catch {}
    }
  })();

  return readable;
}

/**
 * Streaming анализ множественных images
 */
export async function analyzeMultipleImagesStreaming(
  prompt: string,
  imagesBase64: string[],
  mimeTypes: string[] = [],
  model: string = MODELS.OPUS,
  clinicalContext?: string,
  specialty?: Specialty,
  history: Array<{role: string, content: string}> = [],
  isRadiologyOnly: boolean = false
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = getLlmApiKey();
  if (!apiKey) throw new Error('LLM_API_KEY (or OPENROUTER_API_KEY) is not configured');

  const { TITAN_CONTEXTS, RADIOLOGY_PROTOCOL_PROMPT, STRATEGIC_SYSTEM_PROMPT } = await import('./prompts');
  
  // Выбираем системный промпт: для первого сообщения - полная директива, для диалога - краткий режим
  const basePrompt = isRadiologyOnly ? RADIOLOGY_PROTOCOL_PROMPT : (specialty === 'ai_consultant' ? SYSTEM_PROMPT : STRATEGIC_SYSTEM_PROMPT);
  let systemPrompt = history.length > 0 ? DIALOGUE_SYSTEM_PROMPT : basePrompt;
  
  if (specialty && TITAN_CONTEXTS[specialty]) {
    systemPrompt = `${systemPrompt}\n\n${TITAN_CONTEXTS[specialty]}`;
  }

  let fullPrompt = prompt;
  if (clinicalContext) {
    fullPrompt = `${prompt}\n\n=== PATIENT CLINICAL CONTEXT ===\n${clinicalContext}`;
  }

  const contentItems: any[] = [{ type: 'text', text: fullPrompt }];
  imagesBase64.forEach((img, i) => {
    contentItems.push({ type: 'image_url', image_url: { url: `data:${mimeTypes[i] || 'image/png'};base64,${img}` } });
  });

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    let heartbeat: any;
    try {
      // 1. Форсированный старт потока
      const initialPadding = ': ' + ' '.repeat(2048) + '\n\n';
      await writer.write(encoder.encode(initialPadding));

      // 2. Heartbeat для поддержания соединения
      heartbeat = setInterval(async () => {
        try {
          await writer.write(encoder.encode(': keep-alive heartbeat\n\n'));
        } catch (e) {
          if (heartbeat) clearInterval(heartbeat);
        }
      }, 5000);

      const response = await fetchLlmStreamWithFallback({
        model,
        messages: [
          { role: 'system', content: resolvePromptRuntimeVars(systemPrompt) },
          { role: 'user', content: contentItems }
        ],
        max_tokens: 12000,
        temperature: 0.1,
        stream: true,
        stream_options: { include_usage: true }
      }, 120000);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      // Оценка входных токенов для корректного отображения стоимости
      const { estimateTokens } = await import('./adaptive-tokens');
      const initialPromptTokens = estimateTokens(systemPrompt + (typeof fullPrompt === 'string' ? fullPrompt : '') + history.map(m => m.content).join(' '));
      const initialUsage = { prompt_tokens: initialPromptTokens, completion_tokens: 0 };

      const transformer = createTransformWithUsage(response.body!, model, initialUsage, true);
      const reader = transformer.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
      }
    } catch (error: any) {
      console.error(`❌ [MULTI-IMAGE STREAM ERROR]:`, error);
      try { await writer.write(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`)); } catch {}
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      try { await writer.close(); } catch {}
    }
  })();

  return readable;
}
