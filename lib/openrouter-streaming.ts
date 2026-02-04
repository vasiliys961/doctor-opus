/**
 * Стриминг для OpenRouter API
 * Реализует Server-Sent Events (SSE) для постепенного получения ответов и двухэтапный анализ
 */

import { calculateCost, formatCostLog } from './cost-calculator';
import { type ImageType, type Specialty, SYSTEM_PROMPT, DIALOGUE_SYSTEM_PROMPT, STRATEGIC_SYSTEM_PROMPT } from './prompts';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Актуальные модели (последние флагманы 2025-2026)
const MODELS = {
  OPUS: 'anthropic/claude-opus-4.5',                       // Claude Opus 4.5
  SONNET: 'anthropic/claude-sonnet-4.5',                 // Claude Sonnet 4.5
  GPT_5_2: 'openai/gpt-5.2-chat',                        // GPT-5.2 Chat
  HAIKU: 'anthropic/claude-haiku-4.5',                   // Claude Haiku 4.5
  LLAMA: 'meta-llama/llama-3.2-90b-vision-instruct',     // Резерв
  GEMINI_3_FLASH: 'google/gemini-3-flash-preview',       // Gemini 3 Flash Preview
  GEMINI_3_PRO: 'google/gemini-3-pro-preview'            // Gemini 3 Pro Preview
};

/**
 * Вспомогательная функция для преобразования потока с добавлением расчета стоимости
 */
function createTransformWithUsage(
  stream: ReadableStream, 
  model: string, 
  initialUsage?: { prompt_tokens: number, completion_tokens: number }
): ReadableStream<Uint8Array> {
  const reader = stream.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          let modifiedChunk = chunk;

          for (const line of lines) {
            if (line.startsWith('data: ') && line.trim() !== 'data: [DONE]') {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.usage) {
                  const { calculateCost, formatCostLog } = await import('./cost-calculator');
                  
                  // Суммируем токены (Gemini + Основная модель)
                  const totalPrompt = (data.usage.prompt_tokens || 0) + (initialUsage?.prompt_tokens || 0);
                  const totalCompletion = (data.usage.completion_tokens || 0) + (initialUsage?.completion_tokens || 0);
                  const totalTokens = totalPrompt + totalCompletion;

                  const costInfo = calculateCost(totalPrompt, totalCompletion, model);
                  data.usage.prompt_tokens = totalPrompt;
                  data.usage.completion_tokens = totalCompletion;
                  data.usage.total_tokens = totalTokens;
                  data.usage.total_cost = costInfo.totalCostUnits;
                  data.model = model;
                  
                  // Логирование в терминал для всех стримов
                  console.log(`✅ [STREAMING] Анализ завершен успешно (${model})`);
                  if (initialUsage) {
                    console.log(`   🔸 Этап 0 (Gemini JSON): ${initialUsage.prompt_tokens + initialUsage.completion_tokens} токенов`);
                  }
                  console.log(`   📊 ИТОГО: ${formatCostLog(model, totalPrompt, totalCompletion, totalTokens)}`);
                  
                  modifiedChunk = modifiedChunk.replace(line, `data: ${JSON.stringify(data)}`);
                }
              } catch (e) {}
            }
          }
          controller.enqueue(encoder.encode(modifiedChunk));
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
  isRadiologyOnly: boolean = false
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
        specialty: specialty
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
          'HTTP-Referer': 'https://doctor-opus.ru',
          'X-Title': 'Doctor Opus'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: mainPrompt }
          ],
          max_tokens: 16000,
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
      await writer.write(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
    } finally {
      await writer.close();
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

      // 2. Умная индикация загрузки (обновляет текст, чтобы пользователь видел прогресс)
      loadingInterval = setInterval(async () => {
        loadingSeconds += 2;
        try {
          // Отправляем просто точку для визуального прогресса
          const updateChunk = {
            choices: [{
              delta: {
                content: `.`
              }
            }]
          };
          await writer.write(encoder.encode(`data: ${JSON.stringify(updateChunk)}\n\n`));
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
      const extractionResult = await extractImageJSON({ imageBase64, modality: imageType || 'unknown', specialty });
      const jsonExtraction = extractionResult.data;
      const initialUsage = extractionResult.usage;
      
      // Обновляем статус перед запуском второй модели
      if (loadingInterval) clearInterval(loadingInterval);
      const stage2Header = `\n\n> *Этап 2: Клинический разбор через ${model.includes('opus') ? 'Opus 4.5' : 'Sonnet 4.5'}...*\n\n---\n\n`;
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

      // Запускаем второй интервал для Этапа 2
      let stage2Seconds = 0;
      const stage2Interval = setInterval(async () => {
        stage2Seconds += 2;
        try {
          const updateChunk = { choices: [{ delta: { content: `.` } }] };
          await writer.write(encoder.encode(`data: ${JSON.stringify(updateChunk)}\n\n`));
        } catch (e) {}
      }, 2000);

      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://doctor-opus.ru',
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
                { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } }
              ]
            }
          ],
          max_tokens: 16000,
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
      await writer.write(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      await writer.close();
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
  isRadiologyOnly: boolean = false
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
        return `## 🩺 ПОДГОТОВКА К СРАВНИТЕЛЬНОМУ АНАЛИЗУ${dots}\n\n> *Этап 1: Сбор и анализ данных из нескольких изображений через Gemini Vision... (${sec}с)*\n\n---\n\n`;
      };

      await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: getLoadingHeader(0) } }] })}\n\n`));

      // 2. Умная индикация загрузки
      loadingInterval = setInterval(async () => {
        loadingSeconds += 2;
        try {
          const updateChunk = { choices: [{ delta: { content: `.` } }] };
          await writer.write(encoder.encode(`data: ${JSON.stringify(updateChunk)}\n\n`));
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
        specialty: specialty
      });
      const jsonExtraction = extractionResult.data;
      const initialUsage = extractionResult.usage;
      
      if (loadingInterval) clearInterval(loadingInterval);
      const stage2Header = `\n\n> *Этап 2: Детальный клинический разбор и сравнение через ${model.includes('opus') ? 'Opus 4.5' : 'Sonnet 4.5'}...*\n\n---\n\n`;
      await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: stage2Header } }] })}\n\n`));

      const { getDirectivePrompt, RADIOLOGY_PROTOCOL_PROMPT } = await import('./prompts');
      const directivePrompt = getDirectivePrompt(imageType || 'universal', prompt, specialty);

      const mainPrompt = `ИНСТРУКЦИЯ: ${directivePrompt}

### СРАВНИТЕЛЬНЫЕ ДАННЫЕ ИЗ ИЗОБРАЖЕНИЙ (JSON):
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
      
      const stage2Interval = setInterval(async () => {
        try {
          const updateChunk = { choices: [{ delta: { content: `.` } }] };
          await writer.write(encoder.encode(`data: ${JSON.stringify(updateChunk)}\n\n`));
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
          'HTTP-Referer': 'https://doctor-opus.ru',
          'X-Title': 'Doctor Opus'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: contentItems }
          ],
          max_tokens: 16000,
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
      await writer.write(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      if (loadingInterval) clearInterval(loadingInterval);
      await writer.close();
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

      // 2. Умная индикация загрузки
      loadingInterval = setInterval(async () => {
        loadingSeconds += 2;
        try {
          const updateChunk = { choices: [{ delta: { content: `.` } }] };
          await writer.write(encoder.encode(`data: ${JSON.stringify(updateChunk)}\n\n`));
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
      const extractionResult = await extractImageJSON({ imagesBase64, modality: imageType || 'unknown', specialty });
      const jsonExtraction = extractionResult.data;
      const initialUsage = extractionResult.usage;
      
      if (loadingInterval) clearInterval(loadingInterval);
      const stage2Header = `\n\n> *Этап 2: Профессорский разбор через Opus 4.5 (максимальная точность)...*\n\n---\n\n`;
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
      
      const stage2Interval = setInterval(async () => {
        try {
          const updateChunk = { choices: [{ delta: { content: `.` } }] };
          await writer.write(encoder.encode(`data: ${JSON.stringify(updateChunk)}\n\n`));
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
          'HTTP-Referer': 'https://doctor-opus.ru',
          'X-Title': 'Doctor Opus'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: contentItems }
          ],
          max_tokens: 16000,
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
      await writer.write(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      if (loadingInterval) clearInterval(loadingInterval);
      await writer.close();
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
      'HTTP-Referer': 'https://doctor-opus.ru',
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
      max_tokens: 16000,
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
          max_tokens: 16000,
          temperature: 0.1,
          stream: true,
          stream_options: { include_usage: true }
        })
      });

      // Heartbeat остановится в finally
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const transformer = createTransformWithUsage(response.body!, model);
      const reader = transformer.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
      }
    } catch (error: any) {
      if (heartbeat) clearInterval(heartbeat);
      console.error(`❌ [TEXT STREAM ERROR]:`, error);
      await writer.write(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      await writer.close();
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
            'HTTP-Referer': 'https://doctor-opus.ru',
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
          max_tokens: 16000,
          temperature: 0.1,
          stream: true,
          stream_options: { include_usage: true }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const transformer = createTransformWithUsage(response.body!, model);
      const reader = transformer.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
      }
    } catch (error: any) {
      console.error(`❌ [IMAGE STREAM ERROR]:`, error);
      await writer.write(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      await writer.close();
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
            'HTTP-Referer': 'https://doctor-opus.ru',
            'X-Title': 'Doctor Opus'
          },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: contentItems }
          ],
          max_tokens: 16000,
          temperature: 0.1,
          stream: true,
          stream_options: { include_usage: true }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const transformer = createTransformWithUsage(response.body!, model);
      const reader = transformer.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
      }
    } catch (error: any) {
      console.error(`❌ [MULTI-IMAGE STREAM ERROR]:`, error);
      await writer.write(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      await writer.close();
    }
  })();

  return readable;
}
