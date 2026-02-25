/**
 * Стриминг для OpenRouter API
 * Реализует Server-Sent Events (SSE) для постепенного получения ответов и двухэтапный анализ
 */

import { calculateCombinedCost, calculateCost, formatCostLog } from './cost-calculator';
import { type ImageType, type Specialty, SYSTEM_PROMPT, DIALOGUE_SYSTEM_PROMPT, STRATEGIC_SYSTEM_PROMPT } from './prompts';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Актуальные модели (последние флагманы 2025-2026)
const MODELS = {
  OPUS: 'anthropic/claude-opus-4.6',                       // Claude Opus 4.6
  SONNET: 'anthropic/claude-sonnet-4.6',                 // Claude Sonnet 4.6
  GPT_5_2: 'openai/gpt-5.2-chat',                        // GPT-5.2 Chat
  HAIKU: 'anthropic/claude-haiku-4.5',                   // Claude Haiku 4.5
  LLAMA: 'meta-llama/llama-3.2-90b-vision-instruct',     // Резерв
  GEMINI_3_FLASH: 'google/gemini-3-flash-preview',       // Gemini 3 Flash Preview
  GEMINI_3_PRO: 'google/gemini-3.1-pro-preview'          // Gemini 3.1 Pro Preview
};

/**
 * Вспомогательная функция для преобразования потока с добавлением расчета стоимости
 */
function createTransformWithUsage(
  stream: ReadableStream, 
  model: string, 
  initialUsage?: { prompt_tokens: number, completion_tokens: number, model?: string, total_cost?: number, stages?: Array<{ model: string; prompt_tokens: number; completion_tokens: number }> },
  isEstimate: boolean = false
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
            // Отдаем [DONE] только после отправки usage/fallback
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
  const rawKey = process.env.OPENROUTER_API_KEY;
  const apiKey = rawKey?.trim();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

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

      const loadingHeader = `## 🩺 БЫСТРЫЙ АНАЛИЗ (${allImages.length} изображений)...\n\n> *Извлечение данных через Gemini Vision...*\n\n---\n\n`;
      await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: loadingHeader } }] })}\n\n`));

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
      
      const mainPrompt = `Ниже приведены данные из изображения. Как экспертный ассистент с компетенциями профессора медицины, проанализируй их.
    
=== СТРУКТУРИРОВАННЫЕ ДАННЫЕ ОТ GEMINI 3.0 ===
${JSON.stringify(jsonExtraction, null, 2)}

=== КОНТЕКСТ ===
${clinicalContext || 'Нет'}

=== ИНСТРУКЦИЯ ===
${directivePrompt}`;

      const model = MODELS.GEMINI_3_FLASH;

      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://doctor-opus.online',
          'X-Title': 'Doctor Opus'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: mainPrompt }
          ],
          max_tokens: 8000, // Оптимизировано: быстрый режим Gemini, достаточно для базового протокола
          temperature: 0.1,
          stream: true,
          stream_options: { include_usage: true }
        })
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
      try { await writer.write(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`)); } catch {}
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
  isRadiologyOnly: boolean = false
): Promise<ReadableStream<Uint8Array>> {
  const rawKey = process.env.OPENROUTER_API_KEY;
  const apiKey = rawKey?.trim();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Запускаем процесс асинхронно
  (async () => {
    let heartbeat: any;
    let loadingInterval: any;
    try {
      // 1. Форсированный старт потока (Padding) - 4KB для обхода агрессивных прокси
      const padding = ': ' + ' '.repeat(4096) + '\n\n';
      await writer.write(encoder.encode(padding));

      let loadingSeconds = 0;
      const getLoadingHeader = (sec: number) => {
        const dots = '.'.repeat((sec % 3) + 1);
        return `## 🩺 ПОДГОТОВКА К АНАЛИЗУ${dots}\n\n> *Этап 1: Извлечение структурированных данных через Gemini Vision... (${sec}с)*\n\n---\n\n`;
      };

      await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: getLoadingHeader(0) } }] })}\n\n`));

      // 2. Умная индикация загрузки с ротацией сообщений (каждые 4 секунды)
      const stage1Messages = [
        "🔍 Анализ анатомических структур",
        "📏 Измерение размеров образований",
        "⚡ Оценка плотности тканей (HU)",
        "🩺 Проверка контрастного усиления",
        "🔬 Детализация патологических изменений"
      ];
      
      loadingInterval = setInterval(async () => {
        loadingSeconds += 2;
        try {
          // Каждые 4 секунды меняем сообщение, между ними — точки
          if (loadingSeconds % 4 === 0) {
            const msgIndex = Math.floor(loadingSeconds / 4) % stage1Messages.length;
            const statusMsg = `\n\n> ${stage1Messages[msgIndex]}...`;
            await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: statusMsg } }] })}\n\n`));
          } else {
            await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: `.` } }] })}\n\n`));
          }
        } catch (e) {
          if (loadingInterval) clearInterval(loadingInterval);
        }
      }, 2000);

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
      
      // Останавливаем индикацию Этапа 1
      if (loadingInterval) clearInterval(loadingInterval);
      
      // Показываем краткую сводку извлеченных данных
      const findingsCount = jsonExtraction?.findings?.length || 0;
      const metricsCount = Object.keys(jsonExtraction?.metrics || {}).length || 0;
      const summaryLine = `\n\n✅ **Данные извлечены:** ${findingsCount} находок, ${metricsCount} метрик\n`;
      await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: summaryLine } }] })}\n\n`));
      
      // Обновляем статус перед запуском второй модели
      const stage2Header = `\n> *Этап 2: Клинический разбор через ${model.includes('opus') ? 'Opus 4.6' : 'Sonnet 4.6'}...*\n\n---\n\n`;
      await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: stage2Header } }] })}\n\n`));

      const { getDirectivePrompt, RADIOLOGY_PROTOCOL_PROMPT, STRATEGIC_SYSTEM_PROMPT } = await import('./prompts');
      const directivePrompt = getDirectivePrompt(imageType || 'universal', prompt, specialty);

      // Формируем единый контекст для основной модели
      const mainPrompt = `ИНСТРУКЦИЯ: ${directivePrompt}

### ТЕХНИЧЕСКИЕ ДАННЫЕ ИЗ ИЗОБРАЖЕНИЯ (JSON):
${JSON.stringify(jsonExtraction, null, 2)}

${clinicalContext ? `### КЛИНИЧЕСКИЙ КОНТЕКСТ ПАЦИЕНТА:\n${clinicalContext}\n\n` : ''}ПРОАНАЛИЗИРУЙ ДАННЫЕ И СФОРМУЛИРУЙ ПОЛНЫЙ ОТЧЕТ.`;

      // Настройка системного промпта
      const { TITAN_CONTEXTS } = await import('./prompts');
      // Выбираем системный промпт: для первого сообщения - полная директива, для диалога - краткий режим
      const basePrompt = isRadiologyOnly ? RADIOLOGY_PROTOCOL_PROMPT : (specialty === 'ai_consultant' ? SYSTEM_PROMPT : STRATEGIC_SYSTEM_PROMPT);
      let systemPrompt = history.length > 0 ? DIALOGUE_SYSTEM_PROMPT : basePrompt;
      if (specialty && TITAN_CONTEXTS[specialty]) {
        systemPrompt = `${systemPrompt}\n\n${TITAN_CONTEXTS[specialty]}`;
      }

      console.log(`📡 [OPTIMIZED STREAMING] Шаг 2: Запуск ${model} (единый поток)...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 секунд таймаут на запуск модели

      // Запускаем второй интервал для Этапа 2 с ротацией сообщений
      const stage2Messages = [
        "📝 Формирование диагностического протокола",
        "🧠 Построение дифференциальной диагностики",
        "⚕️ Оценка клинической значимости",
        "📊 Синтез клинических гипотез"
      ];
      
      let stage2Seconds = 0;
      const stage2Interval = setInterval(async () => {
        stage2Seconds += 2;
        try {
          // Каждые 4 секунды меняем сообщение
          if (stage2Seconds % 4 === 0) {
            const msgIndex = Math.floor(stage2Seconds / 4) % stage2Messages.length;
            const statusMsg = `\n\n> ${stage2Messages[msgIndex]}...`;
            await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: statusMsg } }] })}\n\n`));
          } else {
            await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: `.` } }] })}\n\n`));
          }
        } catch (e) {}
      }, 2000);

      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://doctor-opus.online',
          'X-Title': 'Doctor Opus'
        },
        body: JSON.stringify(        {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { 
              role: 'user', 
              content: [
                { type: 'text', text: mainPrompt },
                { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } }
              ]
            }
          ],
          max_tokens: 8000, // Оптимизировано: одно изображение, достаточно для экспертного протокола
          temperature: 0.1,
          stream: true,
          stream_options: { include_usage: true }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      clearInterval(stage2Interval);

      // Останавливаем Heartbeat только в блоке finally
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Main model failed: ${response.status} - ${errorText}`);
      }

      // Перенаправляем поток через наш трансформер с учетом начальных токенов Gemini
      const transformer = createTransformWithUsage(response.body!, model, initialUsage);
      const reader = transformer.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
        process.stdout.write('·');
      }

    } catch (error: any) {
      console.error('Optimized Stream Error:', error);
      try { await writer.write(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`)); } catch {}
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      if (loadingInterval) clearInterval(loadingInterval);
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
  const rawKey = process.env.OPENROUTER_API_KEY;
  const apiKey = rawKey?.trim();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    let heartbeat: any;
    let loadingInterval: any;
    try {
      // 1. Форсированный старт потока
      const padding = ': ' + ' '.repeat(4096) + '\n\n';
      await writer.write(encoder.encode(padding));

      let loadingSeconds = 0;
      const getLoadingHeader = (sec: number) => {
        const dots = '.'.repeat((sec % 3) + 1);
        return isComparative
          ? `## 🩺 ПОДГОТОВКА К СРАВНИТЕЛЬНОМУ АНАЛИЗУ${dots}\n\n> *Этап 1: Сбор и анализ данных из нескольких изображений через Gemini Vision... (${sec}с)*\n\n---\n\n`
          : `## 🩺 ПОДГОТОВКА К АНАЛИЗУ СЕРИИ СРЕЗОВ${dots}\n\n> *Этап 1: Сбор и анализ данных из нескольких изображений одного исследования... (${sec}с)*\n\n---\n\n`;
      };

      await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: getLoadingHeader(0) } }] })}\n\n`));

      // 2. Умная индикация загрузки с ротацией сообщений
      const stage1Messages = [
        "🔍 Анализ серии изображений",
        "📏 Сравнение структурных изменений",
        "⚡ Оценка динамики процесса",
        "🩺 Выявление новых находок",
        "🔬 Сопоставление метрических данных"
      ];
      
      loadingInterval = setInterval(async () => {
        loadingSeconds += 2;
        try {
          if (loadingSeconds % 4 === 0) {
            const msgIndex = Math.floor(loadingSeconds / 4) % stage1Messages.length;
            const statusMsg = `\n\n> ${stage1Messages[msgIndex]}...`;
            await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: statusMsg } }] })}\n\n`));
          } else {
            await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: `.` } }] })}\n\n`));
          }
        } catch (e) {
          if (loadingInterval) clearInterval(loadingInterval);
        }
      }, 2000);

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
      
      // Останавливаем индикацию Этапа 1
      if (loadingInterval) clearInterval(loadingInterval);
      
      // Показываем краткую сводку
      const findingsCount = jsonExtraction?.findings?.length || 0;
      const metricsCount = Object.keys(jsonExtraction?.metrics || {}).length || 0;
      const summaryLine = `\n\n✅ **Данные извлечены:** ${findingsCount} находок, ${metricsCount} метрик из ${imagesBase64.length} изображений\n`;
      await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: summaryLine } }] })}\n\n`));
      
      const stage2Header = isComparative
        ? `\n> *Этап 2: Детальный клинический разбор и сравнение через ${model.includes('opus') ? 'Opus 4.6' : 'Sonnet 4.6'}...*\n\n---\n\n`
        : `\n> *Этап 2: Детальный клинический разбор серии через ${model.includes('opus') ? 'Opus 4.6' : 'Sonnet 4.6'}...*\n\n---\n\n`;
      await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: stage2Header } }] })}\n\n`));

      const { getDirectivePrompt, RADIOLOGY_PROTOCOL_PROMPT } = await import('./prompts');
      const directivePrompt = getDirectivePrompt(imageType || 'universal', prompt, specialty);

      const mainPrompt = `ИНСТРУКЦИЯ: ${directivePrompt}

### ${isComparative ? 'СРАВНИТЕЛЬНЫЕ ДАННЫЕ ИЗ ИЗОБРАЖЕНИЙ' : 'ДАННЫЕ ИЗ НЕСКОЛЬКИХ ИЗОБРАЖЕНИЙ ОДНОГО ИССЛЕДОВАНИЯ'} (JSON):
${JSON.stringify(jsonExtraction, null, 2)}

${clinicalContext ? `### КЛИНИЧЕСКИЙ КОНТЕКСТ ПАЦИЕНТА:\n${clinicalContext}\n\n` : ''}ПРОАНАЛИЗИРУЙ ДАННЫЕ И СФОРМУЛИРУЙ ПОЛНЫЙ ОТЧЕТ.`;

      // Настройка системного промпта
      const { TITAN_CONTEXTS } = await import('./prompts');
      // Выбираем системный промпт
      const basePrompt = isRadiologyOnly ? RADIOLOGY_PROTOCOL_PROMPT : (specialty === 'ai_consultant' ? SYSTEM_PROMPT : STRATEGIC_SYSTEM_PROMPT);
      let systemPrompt = history.length > 0 ? DIALOGUE_SYSTEM_PROMPT : basePrompt;
      if (specialty && TITAN_CONTEXTS[specialty]) {
        systemPrompt = `${systemPrompt}\n\n${TITAN_CONTEXTS[specialty]}`;
      }

      console.log(`📡 [MULTI-OPTIMIZED STREAMING] Шаг 2: Запуск ${model} (единый поток)...`);
      
      const stage2Messages = [
        "📝 Формирование сравнительного протокола",
        "🧠 Оценка динамики изменений",
        "⚕️ Анализ прогрессирования/регрессии",
        "📊 Синтез клинических выводов"
      ];
      
      let stage2Seconds = 0;
      const stage2Interval = setInterval(async () => {
        stage2Seconds += 2;
        try {
          if (stage2Seconds % 4 === 0) {
            const msgIndex = Math.floor(stage2Seconds / 4) % stage2Messages.length;
            const statusMsg = `\n\n> ${stage2Messages[msgIndex]}...`;
            await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: statusMsg } }] })}\n\n`));
          } else {
            await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: `.` } }] })}\n\n`));
          }
        } catch (e) {}
      }, 2000);

      const contentItems: any[] = [
        { type: 'text', text: mainPrompt },
        ...imagesBase64.map((img, i) => ({
          type: 'image_url',
          image_url: { url: `data:${mimeTypes[i] || 'image/png'};base64,${img}` }
        }))
      ];

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000); // 180 секунд для сравнения

      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://doctor-opus.online',
          'X-Title': 'Doctor Opus'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: contentItems }
          ],
          max_tokens: 12000, // Оптимизировано: множественные изображения, сравнительный анализ
          temperature: 0.1,
          stream: true,
          stream_options: { include_usage: true }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      clearInterval(stage2Interval);

      // Heartbeat остановится в finally
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Main model failed: ${response.status} - ${errorText}`);
      }

      const transformer = createTransformWithUsage(response.body!, model, initialUsage);
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
      if (loadingInterval) clearInterval(loadingInterval);
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
  const rawKey = process.env.OPENROUTER_API_KEY;
  const apiKey = rawKey?.trim();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    let heartbeat: any;
    let loadingInterval: any;
    try {
      // Padding для форсирования flush
      const padding = ': ' + ' '.repeat(4096) + '\n\n';
      await writer.write(encoder.encode(padding));

      let loadingSeconds = 0;
      const getLoadingHeader = (sec: number) => {
        const dots = '.'.repeat((sec % 3) + 1);
        return `## 🩺 ПОДГОТОВКА К ЭКСПЕРТНОМУ АНАЛИЗУ${dots}\n\n> *Этап 1: Сбор данных через Gemini Vision... (${sec}с)*\n\n---\n\n`;
      };

      await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: getLoadingHeader(0) } }] })}\n\n`));

      // 2. Умная индикация загрузки с ротацией сообщений
      const stage1MessagesValidated = [
        "🔍 Детальный анализ всех изображений",
        "📏 Прецизионное измерение структур",
        "⚡ Перекрестная верификация данных",
        "🩺 Углубленная оценка находок",
        "🔬 Финальная валидация метрик"
      ];
      
      loadingInterval = setInterval(async () => {
        loadingSeconds += 2;
        try {
          if (loadingSeconds % 4 === 0) {
            const msgIndex = Math.floor(loadingSeconds / 4) % stage1MessagesValidated.length;
            const statusMsg = `\n\n> ${stage1MessagesValidated[msgIndex]}...`;
            await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: statusMsg } }] })}\n\n`));
          } else {
            await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: `.` } }] })}\n\n`));
          }
        } catch (e) {
          if (loadingInterval) clearInterval(loadingInterval);
        }
      }, 2000);

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
      
      // Останавливаем индикацию и показываем сводку
      if (loadingInterval) clearInterval(loadingInterval);
      
      const findingsCount = jsonExtraction?.findings?.length || 0;
      const metricsCount = Object.keys(jsonExtraction?.metrics || {}).length || 0;
      const summaryLine = `\n\n✅ **Данные проверены:** ${findingsCount} находок, ${metricsCount} метрик из ${imagesBase64.length} изображений\n`;
      await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: summaryLine } }] })}\n\n`));
      
      const stage2Header = `\n> *Этап 2: Профессорский разбор через Opus 4.6 (максимальная точность)...*\n\n---\n\n`;
      await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: stage2Header } }] })}\n\n`));

      const { getDirectivePrompt } = await import('./prompts');
      const directivePrompt = getDirectivePrompt(imageType || 'universal', prompt, specialty);

      const mainPrompt = `ИНСТРУКЦИЯ: ${directivePrompt}

### СТРУКТУРИРОВАННЫЕ ДАННЫЕ ИЗ ИЗОБРАЖЕНИЙ (JSON):
${JSON.stringify(jsonExtraction, null, 2)}

${clinicalContext ? `### КЛИНИЧЕСКИЙ КОНТЕКСТ ПАЦИЕНТА:\n${clinicalContext}\n\n` : ''}ПРОАНАЛИЗИРУЙ ДАННЫЕ И СФОРМУЛИРУЙ ПОЛНЫЙ ЭКСПЕРТНЫЙ ОТЧЕТ.`;

      const { TITAN_CONTEXTS } = await import('./prompts');
      // Выбираем системный промпт: для первого сообщения - полная директива, для диалога - краткий режим
      const basePrompt = specialty === 'ai_consultant' ? SYSTEM_PROMPT : STRATEGIC_SYSTEM_PROMPT;
      let systemPrompt = history.length > 0 ? DIALOGUE_SYSTEM_PROMPT : basePrompt;
      if (specialty && TITAN_CONTEXTS[specialty]) {
        systemPrompt = `${systemPrompt}\n\n${TITAN_CONTEXTS[specialty]}`;
      }

      console.log(`📡 [MULTI-VALIDATED STREAMING] Шаг 2: Запуск ${model} (единый поток)...`);
      
      const stage2MessagesValidated = [
        "📝 Экспертное формирование протокола",
        "🧠 Глубокий дифференциальный анализ",
        "⚕️ Критическая оценка находок",
        "📊 Синтез клинических заключений"
      ];
      
      let stage2SecondsValidated = 0;
      const stage2Interval = setInterval(async () => {
        stage2SecondsValidated += 2;
        try {
          if (stage2SecondsValidated % 4 === 0) {
            const msgIndex = Math.floor(stage2SecondsValidated / 4) % stage2MessagesValidated.length;
            const statusMsg = `\n\n> ${stage2MessagesValidated[msgIndex]}...`;
            await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: statusMsg } }] })}\n\n`));
          } else {
            await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: `.` } }] })}\n\n`));
          }
        } catch (e) {}
      }, 2000);

      const contentItems: any[] = [
        { type: 'text', text: mainPrompt },
        ...imagesBase64.map((img, i) => ({
          type: 'image_url',
          image_url: { url: `data:${mimeTypes[i] || 'image/png'};base64,${img}` }
        }))
      ];

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 240000); // 4 минуты для супер-точного Opus

      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://doctor-opus.online',
          'X-Title': 'Doctor Opus'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: contentItems }
          ],
          max_tokens: 10000, // Оптимизировано: validated режим с JSON-контекстом
          temperature: 0.1,
          stream: true,
          stream_options: { include_usage: true }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      clearInterval(stage2Interval);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Main model failed: ${response.status} - ${errorText}`);
      }

      const transformer = createTransformWithUsage(response.body!, model, initialUsage);
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
      if (loadingInterval) clearInterval(loadingInterval);
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
  prompt: string = 'Проанализируйте медицинское изображение.',
  mimeType: string = 'image/png',
  imageType?: ImageType,
  clinicalContext?: string,
  specialty?: Specialty,
  model: string = MODELS.OPUS,
  history: any[] = []
): Promise<ReadableStream<Uint8Array>> {
  const rawKey = process.env.OPENROUTER_API_KEY;
  const apiKey = rawKey?.trim();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

  const jsonExtraction = jsonExtractionWrapper.data || jsonExtractionWrapper;
  const initialUsage = jsonExtractionWrapper.usage;

  const { getDirectivePrompt } = await import('./prompts');
  const directivePrompt = getDirectivePrompt(imageType || 'universal', prompt, specialty);

  const mainPrompt = `ИНСТРУКЦИЯ: ${directivePrompt}

### ТЕХНИЧЕСКИЕ ДАННЫЕ ИЗ ИЗОБРАЖЕНИЯ (JSON):
${JSON.stringify(jsonExtraction, null, 2)}

${clinicalContext ? `### КЛИНИЧЕСКИЙ КОНТЕКСТ ПАЦИЕНТА:\n${clinicalContext}\n\n` : ''}ПРОАНАЛИЗИРУЙ ДАННЫЕ И СФОРМУЛИРУЙ ПОЛНЫЙ ОТЧЕТ.`;

  const { TITAN_CONTEXTS } = await import('./prompts');
  // Выбираем системный промпт: для первого сообщения - полная директива, для диалога - краткий режим
  const basePrompt = specialty === 'ai_consultant' ? SYSTEM_PROMPT : STRATEGIC_SYSTEM_PROMPT;
  let systemPrompt = history.length > 0 ? DIALOGUE_SYSTEM_PROMPT : basePrompt;
  
  if (specialty && TITAN_CONTEXTS[specialty]) {
    systemPrompt = `${systemPrompt}\n\n${TITAN_CONTEXTS[specialty]}`;
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://doctor-opus.online',
      'X-Title': 'Doctor Opus'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: [
            { type: 'text', text: mainPrompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
          ]
        }
      ],
      max_tokens: 8000, // Оптимизировано: одно изображение, базовый протокол
      temperature: 0.1,
      stream: true,
      stream_options: { include_usage: true }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Main model failed: ${response.status} - ${errorText}`);
  }

  return createTransformWithUsage(response.body!, model, initialUsage);
}

/**
 * Streaming запрос для текстового чата
 */
export async function sendTextRequestStreaming(
  prompt: string,
  history: Array<{role: string, content: string}> = [],
  model: string = MODELS.OPUS,
  specialty?: Specialty,
  customSystemPrompt?: string
): Promise<ReadableStream<Uint8Array>> {
  const rawKey = process.env.OPENROUTER_API_KEY;
  const apiKey = rawKey?.trim();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

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
        { role: 'system' as const, content: systemPrompt },
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

      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://openrouter.ai',
            'X-Title': 'Medical AI'
          },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: adaptiveMaxTokens, // Адаптивно в зависимости от длины диалога
          temperature: 0.1,
          stream: true,
          stream_options: { include_usage: true }
        })
      });

      const initialPromptTokens = estimateTokens(systemPrompt + prompt + history.map(m => m.content).join(' '));
      const initialUsage = { prompt_tokens: initialPromptTokens, completion_tokens: 0 };

      // Heartbeat остановится в finally
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const transformer = createTransformWithUsage(response.body!, model, initialUsage, true);
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
  const rawKey = process.env.OPENROUTER_API_KEY;
  const apiKey = rawKey?.trim();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

  const { TITAN_CONTEXTS, RADIOLOGY_PROTOCOL_PROMPT, STRATEGIC_SYSTEM_PROMPT } = await import('./prompts');
  
  // Выбираем системный промпт: для первого сообщения - полная директива, для диалога - краткий режим
  const basePrompt = isRadiologyOnly ? RADIOLOGY_PROTOCOL_PROMPT : (specialty === 'ai_consultant' ? SYSTEM_PROMPT : STRATEGIC_SYSTEM_PROMPT);
  let systemPrompt = history.length > 0 ? DIALOGUE_SYSTEM_PROMPT : basePrompt;
  
  if (specialty && TITAN_CONTEXTS[specialty]) {
    systemPrompt = `${systemPrompt}\n\n${TITAN_CONTEXTS[specialty]}`;
  }

  let fullPrompt = prompt;
  if (clinicalContext) {
    fullPrompt = `${prompt}\n\n=== КЛИНИЧЕСКИЙ КОНТЕКСТ ПАЦИЕНТА ===\n${clinicalContext}`;
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

      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://doctor-opus.online',
            'X-Title': 'Doctor Opus'
          },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { 
              role: 'user', 
              content: [
                { type: 'text', text: fullPrompt },
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
              ] 
            }
          ],
          max_tokens: 8000, // Оптимизировано: одно изображение, базовый протокол
          temperature: 0.1,
          stream: true,
          stream_options: { include_usage: true }
        })
      });

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
 * Streaming анализ множественных изображений
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
  const rawKey = process.env.OPENROUTER_API_KEY;
  const apiKey = rawKey?.trim();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

  const { TITAN_CONTEXTS, RADIOLOGY_PROTOCOL_PROMPT, STRATEGIC_SYSTEM_PROMPT } = await import('./prompts');
  
  // Выбираем системный промпт: для первого сообщения - полная директива, для диалога - краткий режим
  const basePrompt = isRadiologyOnly ? RADIOLOGY_PROTOCOL_PROMPT : (specialty === 'ai_consultant' ? SYSTEM_PROMPT : STRATEGIC_SYSTEM_PROMPT);
  let systemPrompt = history.length > 0 ? DIALOGUE_SYSTEM_PROMPT : basePrompt;
  
  if (specialty && TITAN_CONTEXTS[specialty]) {
    systemPrompt = `${systemPrompt}\n\n${TITAN_CONTEXTS[specialty]}`;
  }

  let fullPrompt = prompt;
  if (clinicalContext) {
    fullPrompt = `${prompt}\n\n=== КЛИНИЧЕСКИЙ КОНТЕКСТ ПАЦИЕНТА ===\n${clinicalContext}`;
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

      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://doctor-opus.online',
            'X-Title': 'Doctor Opus'
          },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: contentItems }
          ],
          max_tokens: 12000, // Оптимизировано: множественные изображения
          temperature: 0.1,
          stream: true,
          stream_options: { include_usage: true }
        })
      });

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
