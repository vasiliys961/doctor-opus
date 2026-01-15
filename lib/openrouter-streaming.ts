/**
 * Стриминг для OpenRouter API
 * Реализует Server-Sent Events (SSE) для постепенного получения ответов и двухэтапный анализ
 */

import { calculateCost, formatCostLog } from './cost-calculator';
import { type ImageType, type Specialty } from './prompts';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Системный промпт профессора
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

2. **Диференциальный диагноз и Коды**
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
    - Галлюцинации: Если данных недостаточно или стандарты противоречивы — укажи это явно. Не выдумывай дозировки.
    
    ### IMPORTANT
    Заверши ответ сразу после выполнения всех разделов. Не добавляй никаких технических пояснений, пустых фраз или повторов в конце.`;

const MODELS = {
  OPUS: 'anthropic/claude-opus-4.5',                       // Claude Opus 4.5
  SONNET: 'anthropic/claude-sonnet-4.5',                 // Claude Sonnet 4.5
  GPT_5_2: 'openai/gpt-5.2-chat',                        // GPT-5.2
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
  imageBase64: string,
  imageType?: string,
  clinicalContext?: string,
  specialty?: Specialty
): Promise<ReadableStream<Uint8Array>> {
  const rawKey = process.env.OPENROUTER_API_KEY;
  const apiKey = rawKey?.trim();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    try {
      const { extractImageJSON } = await import('./openrouter');
      const extractionResult = await extractImageJSON({
        imageBase64,
        modality: imageType || 'unknown',
        specialty: specialty
      });
      const jsonExtraction = extractionResult.data;
      const initialUsage = extractionResult.usage;

      const { getDirectivePrompt } = await import('./prompts');
      const directivePrompt = getDirectivePrompt(imageType as any, prompt, specialty);

      const mainPrompt = `Ниже приведены данные из изображения. Как Профессор медицины, проанализируй их.
    
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
            { role: 'system', content: SYSTEM_PROMPT },
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
  model: string = MODELS.SONNET
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
    try {
      // Padding для форсирования потока
      const padding = ': ' + ' '.repeat(1024) + '\n\n';
      await writer.write(encoder.encode(padding));

      const loadingHeader = "## 🩺 ПОДГОТОВКА К АНАЛИЗУ...\n\n> *Извлечение структурированных данных через Gemini Vision...*\n\n---\n\n";
      await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: loadingHeader } }] })}\n\n`));

      console.log(`🚀 [OPTIMIZED STREAMING] Шаг 1: Извлечение JSON...`);
      const { extractImageJSON } = await import('./openrouter');
      const extractionResult = await extractImageJSON({ imageBase64, modality: imageType || 'unknown', specialty });
      const jsonExtraction = extractionResult.data;
      const initialUsage = extractionResult.usage;
      
      const { getDirectivePrompt } = await import('./prompts');
      const directivePrompt = getDirectivePrompt(imageType || 'universal', prompt, specialty);

      // Формируем единый контекст для основной модели
      const mainPrompt = `ИНСТРУКЦИЯ: ${directivePrompt}

### ТЕХНИЧЕСКИЕ ДАННЫЕ ИЗ ИЗОБРАЖЕНИЯ (JSON):
${JSON.stringify(jsonExtraction, null, 2)}

${clinicalContext ? `### КЛИНИЧЕСКИЙ КОНТЕКСТ ПАЦИЕНТА:\n${clinicalContext}\n\n` : ''}ПРОАНАЛИЗИРУЙ ДАННЫЕ И СФОРМУЛИРУЙ ПОЛНЫЙ ОТЧЕТ (ОПИСАНИЕ И ДИРЕКТИВУ).`;

      // Настройка системного промпта
      const { TITAN_CONTEXTS } = await import('./prompts');
      let systemPrompt = SYSTEM_PROMPT;
      if (specialty && TITAN_CONTEXTS[specialty]) {
        systemPrompt = `${SYSTEM_PROMPT}\n\n${TITAN_CONTEXTS[specialty]}`;
      }

      console.log(`📡 [OPTIMIZED STREAMING] Шаг 2: Запуск ${model} (единый поток)...`);
      
      // Запускаем Heartbeat
      heartbeat = setInterval(() => {
        try {
          process.stdout.write('♥');
          writer.write(encoder.encode(': keep-alive heartbeat\n\n'));
        } catch (e) {}
      }, 15000);

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
        })
      });

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
  specialty?: Specialty
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
      // Padding для форсирования потока
      const padding = ': ' + ' '.repeat(1024) + '\n\n';
      await writer.write(encoder.encode(padding));

      const loadingHeader = "## 🩺 ПОДГОТОВКА К АНАЛИЗУ...\n\n> *Сбор и анализ данных из нескольких изображений через Gemini Vision...*\n\n---\n\n";
      await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: loadingHeader } }] })}\n\n`));

      console.log(`🚀 [MULTI-OPTIMIZED STREAMING] Шаг 1: Извлечение JSON...`);
      const { extractImageJSON } = await import('./openrouter');
      const extractionResult = await extractImageJSON({
        imagesBase64,
        modality: imageType || 'unknown',
        specialty: specialty
      });
      const jsonExtraction = extractionResult.data;
      const initialUsage = extractionResult.usage;
      
      const { getDirectivePrompt } = await import('./prompts');
      const directivePrompt = getDirectivePrompt(imageType || 'universal', prompt, specialty);

      const mainPrompt = `ИНСТРУКЦИЯ: ${directivePrompt}

### СРАВНИТЕЛЬНЫЕ ДАННЫЕ ИЗ ИЗОБРАЖЕНИЙ (JSON):
${JSON.stringify(jsonExtraction, null, 2)}

${clinicalContext ? `### КЛИНИЧЕСКИЙ КОНТЕКСТ ПАЦИЕНТА:\n${clinicalContext}\n\n` : ''}ПРОАНАЛИЗИРУЙ ДАННЫЕ И СФОРМУЛИРУЙ ПОЛНЫЙ ОТЧЕТ.`;

      // Настройка системного промпта
      const { TITAN_CONTEXTS } = await import('./prompts');
      let systemPrompt = SYSTEM_PROMPT;
      if (specialty && TITAN_CONTEXTS[specialty]) {
        systemPrompt = `${SYSTEM_PROMPT}\n\n${TITAN_CONTEXTS[specialty]}`;
      }

      console.log(`📡 [MULTI-OPTIMIZED STREAMING] Шаг 2: Запуск ${model} (единый поток)...`);
      
      // Запускаем Heartbeat
      heartbeat = setInterval(() => {
        try {
          process.stdout.write('♥');
          writer.write(encoder.encode(': keep-alive heartbeat\n\n'));
        } catch (e) {}
      }, 15000);

      const contentItems: any[] = [
        { type: 'text', text: mainPrompt },
        ...imagesBase64.map((img, i) => ({
          type: 'image_url',
          image_url: { url: `data:${mimeTypes[i] || 'image/png'};base64,${img}` }
        }))
      ];

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
  model: string = MODELS.OPUS
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
      // Padding для форсирования flush
      const padding = ': ' + ' '.repeat(1024) + '\n\n';
      await writer.write(encoder.encode(padding));

      const loadingHeader = "## 🩺 ПОДГОТОВКА К ЭКСПЕРТНОМУ АНАЛИЗУ...\n\n> *Сбор данных через Gemini Vision...*\n\n---\n\n";
      await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: loadingHeader } }] })}\n\n`));

      const { extractImageJSON } = await import('./openrouter');
      const extractionResult = await extractImageJSON({ imagesBase64, modality: imageType || 'unknown', specialty });
      const jsonExtraction = extractionResult.data;
      const initialUsage = extractionResult.usage;
      
      const { getDirectivePrompt } = await import('./prompts');
      const directivePrompt = getDirectivePrompt(imageType || 'universal', prompt, specialty);

      const mainPrompt = `ИНСТРУКЦИЯ: ${directivePrompt}

### СТРУКТУРИРОВАННЫЕ ДАННЫЕ ИЗ ИЗОБРАЖЕНИЙ (JSON):
${JSON.stringify(jsonExtraction, null, 2)}

${clinicalContext ? `### КЛИНИЧЕСКИЙ КОНТЕКСТ ПАЦИЕНТА:\n${clinicalContext}\n\n` : ''}ПРОАНАЛИЗИРУЙ ДАННЫЕ И СФОРМУЛИРУЙ ПОЛНЫЙ ЭКСПЕРТНЫЙ ОТЧЕТ.`;

      const { TITAN_CONTEXTS } = await import('./prompts');
      let systemPrompt = SYSTEM_PROMPT;
      if (specialty && TITAN_CONTEXTS[specialty]) {
        systemPrompt = `${SYSTEM_PROMPT}\n\n${TITAN_CONTEXTS[specialty]}`;
      }

      // Запускаем Heartbeat
      heartbeat = setInterval(() => {
        try {
          process.stdout.write('♥');
          writer.write(encoder.encode(': keep-alive heartbeat\n\n'));
        } catch (e) {}
      }, 15000);

      const contentItems: any[] = [
        { type: 'text', text: mainPrompt },
        ...imagesBase64.map((img, i) => ({
          type: 'image_url',
          image_url: { url: `data:${mimeTypes[i] || 'image/png'};base64,${img}` }
        }))
      ];

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
  model: string = MODELS.OPUS
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
  let systemPrompt = SYSTEM_PROMPT;
  if (specialty && TITAN_CONTEXTS[specialty]) {
    systemPrompt = `${SYSTEM_PROMPT}\n\n${TITAN_CONTEXTS[specialty]}`;
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
  specialty?: Specialty
): Promise<ReadableStream<Uint8Array>> {
  const rawKey = process.env.OPENROUTER_API_KEY;
  const apiKey = rawKey?.trim();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

  const { TITAN_CONTEXTS } = await import('./prompts');
  
  let systemPrompt = SYSTEM_PROMPT;
  if (specialty && TITAN_CONTEXTS[specialty]) {
    systemPrompt = `${SYSTEM_PROMPT}\n\n${TITAN_CONTEXTS[specialty]}`;
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [OPENROUTER ERROR] Status: ${response.status}: ${errorText}`);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }
  return createTransformWithUsage(response.body!, model);
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
  specialty?: Specialty
): Promise<ReadableStream<Uint8Array>> {
  const rawKey = process.env.OPENROUTER_API_KEY;
  const apiKey = rawKey?.trim();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

  const { TITAN_CONTEXTS } = await import('./prompts');
  
  let systemPrompt = SYSTEM_PROMPT;
  if (specialty && TITAN_CONTEXTS[specialty]) {
    systemPrompt = `${SYSTEM_PROMPT}\n\n${TITAN_CONTEXTS[specialty]}`;
  }

  let fullPrompt = prompt;
  if (clinicalContext) {
    fullPrompt = `${prompt}\n\n=== КЛИНИЧЕСКИЙ КОНТЕКСТ ПАЦИЕНТА ===\n${clinicalContext}`;
  }

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
      console.error(`❌ [OPENROUTER ERROR] Status: ${response.status}: ${errorText}`);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }
  return createTransformWithUsage(response.body!, model);
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
  specialty?: Specialty
): Promise<ReadableStream<Uint8Array>> {
  const rawKey = process.env.OPENROUTER_API_KEY;
  const apiKey = rawKey?.trim();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

  const { TITAN_CONTEXTS } = await import('./prompts');
  
  let systemPrompt = SYSTEM_PROMPT;
  if (specialty && TITAN_CONTEXTS[specialty]) {
    systemPrompt = `${SYSTEM_PROMPT}\n\n${TITAN_CONTEXTS[specialty]}`;
  }

  let fullPrompt = prompt;
  if (clinicalContext) {
    fullPrompt = `${prompt}\n\n=== КЛИНИЧЕСКИЙ КОНТЕКСТ ПАЦИЕНТА ===\n${clinicalContext}`;
  }

  const contentItems: any[] = [{ type: 'text', text: fullPrompt }];
  imagesBase64.forEach((img, i) => {
    contentItems.push({ type: 'image_url', image_url: { url: `data:${mimeTypes[i] || 'image/png'};base64,${img}` } });
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
      console.error(`❌ [OPENROUTER ERROR] Status: ${response.status}: ${errorText}`);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }
  return createTransformWithUsage(response.body!, model);
}
