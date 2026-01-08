/**
 * Стриминг для OpenRouter API
 * Реализует Server-Sent Events (SSE) для постепенного получения ответов и двухэтапный анализ
 */

import { calculateCost, formatCostLog } from './cost-calculator';
import { type ImageType, type Specialty } from './prompts';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Системный промпт профессора (ТОЧНАЯ КОПИЯ из openrouter.ts)
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
  GPT_5_2: 'openai/gpt-5.2-chat',
  HAIKU: 'anthropic/claude-haiku-4.5',
  LLAMA: 'meta-llama/llama-3.2-90b-vision-instruct',
  GEMINI_3_FLASH: 'google/gemini-3-flash-preview',
  GEMINI_3_PRO: 'google/gemini-3-pro-preview',
};

/**
 * Вспомогательная функция для создания объединенного потока из двух последовательных вызовов
 */
async function createSequentialStream(
  firstPartPrompt: string,
  secondPartPrompt: string,
  imagesBase64: string[],
  model: string,
  apiKey: string,
  mimeTypes: string[] = [],
  initialUsage?: { prompt_tokens: number, completion_tokens: number },
  hiddenContext?: string,
  specialty?: Specialty
): Promise<ReadableStream<Uint8Array>> {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const decoderForAccumulation = new TextDecoder();

  // Запускаем процесс асинхронно
  (async () => {
    try {
      let accumulatedFirstPart = '';
      let totalUsage = initialUsage 
        ? { prompt_tokens: initialUsage.prompt_tokens, completion_tokens: initialUsage.completion_tokens }
        : { prompt_tokens: 0, completion_tokens: 0 };

      // Подготовка системного промпта для Части 2 с учетом специальности
      const { TITAN_CONTEXTS } = await import('./prompts');
      let systemPromptPart2 = SYSTEM_PROMPT;
      if (specialty && TITAN_CONTEXTS[specialty]) {
        systemPromptPart2 = `${SYSTEM_PROMPT}\n\n${TITAN_CONTEXTS[specialty]}`;
      }

      // --- ЧАСТЬ 1: Описание ---
      console.log(`📡 [SEQUENTIAL] Запуск Части 1 (Описание) через ${model}...`);
      const response1 = await fetch(OPENROUTER_API_URL, {
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
            { role: 'system', content: 'Ты — эксперт-диагност. Дай максимально краткое, но емкое описание патологий. Фокусируйся на фактах для врача. Не пиши вступлений.' },
            { 
              role: 'user', 
              content: [
                { type: 'text', text: firstPartPrompt },
                ...imagesBase64.map((img, i) => ({
                  type: 'image_url',
                  image_url: { url: `data:${mimeTypes[i] || 'image/png'};base64,${img}` }
                }))
              ]
            }
          ],
          max_tokens: 3000,
          temperature: 0.2,
          stream: true,
          stream_options: { include_usage: true }
        })
      });

      if (!response1.ok) throw new Error(`Step 1 failed: ${response1.status}`);
      
      const reader1 = response1.body!.getReader();
      writer.write(encoder.encode('data: {"choices": [{"delta": {"content": "## 🔍 ОБЪЕКТИВНЫЙ СТАТУС (ОПИСАНИЕ)\\n\\n"}}]}\n\n'));

      let partialLine1 = '';
      while (true) {
        const { done, value } = await reader1.read();
        if (done) break;
        
        const chunk = decoderForAccumulation.decode(value, { stream: true });
        const lines = (partialLine1 + chunk).split('\n');
        partialLine1 = lines.pop() || '';

        let filteredValue = '';
        for (const line of lines) {
          // Пропускаем сигнал завершения первой части, чтобы не закрыть общий поток
          if (line.trim() === 'data: [DONE]') continue;
          
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.usage) {
                totalUsage.prompt_tokens += data.usage.prompt_tokens;
                totalUsage.completion_tokens += data.usage.completion_tokens;
                continue; // Не прокидываем промежуточный usage
              }
              const content = data.choices?.[0]?.delta?.content || '';
              if (content) accumulatedFirstPart += content;
            } catch (e) {}
          }
          filteredValue += line + '\n';
        }

        if (filteredValue) {
          writer.write(encoder.encode(filteredValue));
        }
      }

      // Пингуем канал
      writer.write(encoder.encode(': keep-alive\n\n'));

      // --- ЧАСТЬ 2: Клиника ---
      console.log(`📡 [SEQUENTIAL] Запуск Части 2 (Директива) через ${model}...`);
      const response2 = await fetch(OPENROUTER_API_URL, {
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
            { role: 'system', content: systemPromptPart2 },
            { 
              role: 'user', 
              content: `ИНСТРУКЦИЯ: ${secondPartPrompt}\n\n${hiddenContext ? `ТЕХНИЧЕСКИЕ ДАННЫЕ (JSON) ДЛЯ АНАЛИЗА:\n${hiddenContext}\n\n` : ''}ОПИСАНИЕ СНИМКОВ:\n${accumulatedFirstPart}\n\nСФОРМУЛИРУЙ ТОЛЬКО ДИАГНОЗЫ, ПЛАН ЛЕЧЕНИЯ И ССЫЛКИ.` 
            }
          ],
          max_tokens: 5000,
          temperature: 0.2,
          stream: true,
          stream_options: { include_usage: true }
        })
      });

      if (!response2.ok) {
        const errorText = await response2.text();
        throw new Error(`Part 2 error: ${response2.status} - ${errorText}`);
      }

      const reader2 = response2.body!.getReader();
      writer.write(encoder.encode('data: {"choices": [{"delta": {"content": "\\n\\n---\\n\\n## 🩺 КЛИНИЧЕСКАЯ ДИРЕКТИВА\\n\\n"}}]}\n\n'));

      let partialLine2 = '';
      while (true) {
        const { done, value } = await reader2.read();
        if (done) break;
        
        const chunk = decoderForAccumulation.decode(value, { stream: true });
        const lines = (partialLine2 + chunk).split('\n');
        partialLine2 = lines.pop() || '';

        let filteredValue = '';
        for (const line of lines) {
          // Пропускаем сигнал завершения второй части
          if (line.trim() === 'data: [DONE]') continue;

          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.usage) {
                totalUsage.prompt_tokens += data.usage.prompt_tokens;
                totalUsage.completion_tokens += data.usage.completion_tokens;
                continue; // Не прокидываем промежуточный usage
              }
            } catch (e) {}
          }
          filteredValue += line + '\n';
        }

        if (filteredValue) {
          writer.write(encoder.encode(filteredValue));
        }
      }

      // Финальный отчет в терминал
      const { formatCostLog } = await import('./cost-calculator');
      const costLog = formatCostLog(model, totalUsage.prompt_tokens, totalUsage.completion_tokens, totalUsage.prompt_tokens + totalUsage.completion_tokens);
      console.log(`✅ [SEQUENTIAL] Анализ завершен успешно`);
      console.log(`   📊 ${costLog}`);

      // Финальный чек для фронтенда
      const { calculateCost } = await import('./cost-calculator');
      const costInfo = calculateCost(totalUsage.prompt_tokens, totalUsage.completion_tokens, model);
      const usageChunk = {
        usage: {
          prompt_tokens: totalUsage.prompt_tokens,
          completion_tokens: totalUsage.completion_tokens,
          total_tokens: totalUsage.prompt_tokens + totalUsage.completion_tokens,
          total_cost: costInfo.totalCostUnits
        },
        model: model
      };
      
      writer.write(encoder.encode(`data: ${JSON.stringify(usageChunk)}\n\n`));
      writer.write(encoder.encode('data: [DONE]\n\n'));
    } catch (error: any) {
      console.error('Sequential Stream Error:', error);
      writer.write(encoder.encode(`data: {"error": "${error.message.replace(/"/g, '\\"')}"}\n\n`));
    } finally {
      writer.close();
    }
  })();

  return readable;
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
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

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

  const contextPrompt = `Ниже приведены данные из изображения. Как Профессор медицины, проанализируй их.
    
=== СТРУКТУРИРОВАННЫЕ ДАННЫЕ ОТ GEMINI 3.0 ===
${JSON.stringify(jsonExtraction, null, 2)}

=== КОНТЕКСТ ===
${clinicalContext || 'Нет'}

=== ИНСТРУКЦИЯ ===
${directivePrompt}`;

  return createSequentialStream(
    "Выполни краткий обзор находок.",
    contextPrompt,
    [imageBase64],
    MODELS.GEMINI_3_FLASH,
    apiKey,
    ['image/png'],
    initialUsage,
    undefined,
    specialty
  );
}

/**
 * Streaming оптимизированный анализ для множественных изображений (Gemini JSON → Sonnet)
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
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

  try {
    console.log(`🚀 [MULTI-OPTIMIZED STREAMING] Шаг 1: Извлечение JSON...`);
    const { extractImageJSON } = await import('./openrouter');
    const extractionResult = await extractImageJSON({
      imagesBase64,
      modality: imageType || 'unknown',
      specialty: specialty
    });
    const jsonExtraction = extractionResult.data;
    const initialUsage = extractionResult.usage;
    
    const { getObjectiveDescriptionPrompt, getDirectivePrompt } = await import('./prompts');
    const descriptionPromptCriteria = getObjectiveDescriptionPrompt(imageType || 'universal', specialty);
    const clinicalPromptCriteria = getDirectivePrompt(imageType || 'universal', prompt, specialty);

    const step1Prompt = `${descriptionPromptCriteria}\n\n=== СТРУКТУРИРОВАННЫЕ ДАННЫЕ (GEMINI JSON) ===\n${JSON.stringify(jsonExtraction, null, 2)}\n\n${clinicalContext ? `Контекст пациента: ${clinicalContext}` : ''}`;
    const step2Prompt = clinicalPromptCriteria;

    return createSequentialStream(step1Prompt, step2Prompt, imagesBase64, model, apiKey, mimeTypes, initialUsage, JSON.stringify(jsonExtraction, null, 2), specialty);
  } catch (error: any) {
    throw error;
  }
}

/**
 * Streaming анализ множественных изображений через Opus с использованием JSON от Gemini (Validated)
 */
export async function analyzeMultipleImagesWithJSONStreaming(
  prompt: string,
  imagesBase64: string[],
  imageType?: ImageType,
  clinicalContext?: string,
  mimeTypes: string[] = [],
  specialty?: Specialty
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

  try {
    const { extractImageJSON } = await import('./openrouter');
    const extractionResult = await extractImageJSON({ imagesBase64, modality: imageType || 'unknown', specialty });
    const jsonExtraction = extractionResult.data;
    const initialUsage = extractionResult.usage;
    
    const { getObjectiveDescriptionPrompt, getDirectivePrompt } = await import('./prompts');
    const descriptionPromptCriteria = getObjectiveDescriptionPrompt(imageType || 'universal', specialty);
    const clinicalPromptCriteria = getDirectivePrompt(imageType || 'universal', prompt, specialty);

    const step1Prompt = `${descriptionPromptCriteria}\n\n=== СТРУКТУРИРОВАННЫЕ ДАННЫЕ (GEMINI JSON) ===\n${JSON.stringify(jsonExtraction, null, 2)}\n\n${clinicalContext ? `Контекст пациента: ${clinicalContext}` : ''}`;
    const step2Prompt = clinicalPromptCriteria;

    return createSequentialStream(step1Prompt, step2Prompt, imagesBase64, MODELS.OPUS, apiKey, mimeTypes, initialUsage, JSON.stringify(jsonExtraction, null, 2), specialty);
  } catch (error: any) {
    throw error;
  }
}

/**
 * Вспомогательная функция для преобразования потока с добавлением расчета стоимости
 */
function createTransformWithUsage(stream: ReadableStream, model: string): ReadableStream<Uint8Array> {
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
                  const { calculateCost } = await import('./cost-calculator');
                  const costInfo = calculateCost(data.usage.prompt_tokens, data.usage.completion_tokens, model);
                  data.usage.total_cost = costInfo.totalCostUnits;
                  data.model = model;
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
 * Streaming запрос для текстового чата
 */
export async function sendTextRequestStreaming(
  prompt: string,
  history: Array<{role: string, content: string}> = [],
  model: string = MODELS.OPUS,
  specialty?: Specialty
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
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
        'HTTP-Referer': 'https://doctor-opus.ru',
        'X-Title': 'Doctor Opus'
      },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 8192,
      temperature: 0.2,
      stream: true,
      stream_options: { include_usage: true }
    })
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);
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
  const apiKey = process.env.OPENROUTER_API_KEY;
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
      max_tokens: 8192,
      temperature: 0.2,
      stream: true,
      stream_options: { include_usage: true }
    })
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return createTransformWithUsage(response.body!, model);
}

/**
 * Streaming оптимизированный анализ (Gemini JSON → Sonnet)
 */
export async function analyzeImageOpusTwoStageStreaming(
  prompt: string,
  imageBase64: string,
  imageType?: ImageType,
  clinicalContext?: string,
  specialty?: Specialty,
  model: string = MODELS.SONNET
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

  try {
    const { extractImageJSON } = await import('./openrouter');
    const extractionResult = await extractImageJSON({ imageBase64, modality: imageType || 'unknown', specialty });
    const jsonExtraction = extractionResult.data;
    const initialUsage = extractionResult.usage;
    
    const { getObjectiveDescriptionPrompt, getDirectivePrompt } = await import('./prompts');
    const descriptionPromptCriteria = getObjectiveDescriptionPrompt(imageType || 'universal', specialty);
    const clinicalPromptCriteria = getDirectivePrompt(imageType || 'universal', prompt, specialty);

    const step1Prompt = `${descriptionPromptCriteria}\n\n=== СТРУКТУРИРОВАННЫЕ ДАННЫЕ (GEMINI JSON) ===\n${JSON.stringify(jsonExtraction, null, 2)}\n\n${clinicalContext ? `Контекст пациента: ${clinicalContext}` : ''}`;
    const step2Prompt = clinicalPromptCriteria;

    return createSequentialStream(step1Prompt, step2Prompt, [imageBase64], model, apiKey, ['image/png'], initialUsage, JSON.stringify(jsonExtraction, null, 2), specialty);
  } catch (error: any) {
    throw error;
  }
}

/**
 * Streaming анализ изображения через Opus с использованием JSON от Gemini
 */
export async function analyzeImageWithJSONStreaming(
  jsonExtractionWrapper: any,
  imageBase64: string,
  prompt: string = 'Проанализируйте медицинское изображение.',
  mimeType: string = 'image/png',
  imageType?: ImageType,
  clinicalContext?: string,
  specialty?: Specialty
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

  const jsonExtraction = jsonExtractionWrapper.data || jsonExtractionWrapper;
  const initialUsage = jsonExtractionWrapper.usage;

  const { getObjectiveDescriptionPrompt, getDirectivePrompt } = await import('./prompts');
  const descriptionPromptCriteria = getObjectiveDescriptionPrompt(imageType || 'universal', specialty);
  const clinicalPromptCriteria = getDirectivePrompt(imageType || 'universal', prompt, specialty);

  const step1Prompt = `${descriptionPromptCriteria}\n\n=== СТРУКТУРИРОВАННЫЕ ДАННЫЕ (GEMINI JSON) ===\n${JSON.stringify(jsonExtraction, null, 2)}\n\n${clinicalContext ? `Контекст пациента: ${clinicalContext}` : ''}`;
  const step2Prompt = clinicalPromptCriteria;

    return createSequentialStream(step1Prompt, step2Prompt, [imageBase64], MODELS.OPUS, apiKey, [mimeType], initialUsage, JSON.stringify(jsonExtraction, null, 2), specialty);
}

/**
 * Стриминг для получения ТОЛЬКО описания изображений (Шаг 1 в ручном режиме)
 */
export async function analyzeMultipleImagesDescriptionStreaming(
  prompt: string,
  imagesBase64: string[],
  imageType: string = 'universal',
  clinicalContext?: string,
  mimeTypes: string[] = [],
  specialty?: Specialty
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

  const { getObjectiveDescriptionPrompt } = await import('./prompts');
  const descriptionPrompt = getObjectiveDescriptionPrompt(imageType as any, specialty);

  const fullPrompt = `${descriptionPrompt}\n\n${prompt}\n\n${clinicalContext ? `Контекст пациента: ${clinicalContext}` : ''}`;

  return analyzeMultipleImagesStreaming(fullPrompt, imagesBase64, mimeTypes, MODELS.SONNET, '', specialty);
}

/**
 * Стриминг для получения ТОЛЬКО клинической директивы на основе описания (Шаг 2 в ручном режиме)
 */
export async function analyzeMultipleImagesDirectiveStreaming(
  prompt: string,
  description: string,
  imagesBase64: string[],
  clinicalContext?: string,
  mimeTypes: string[] = [],
  specialty?: Specialty
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

  const { getDirectivePrompt } = await import('./prompts');
  const directivePrompt = getDirectivePrompt('universal', prompt, specialty);

  const fullPrompt = `${directivePrompt}\n\nОПИСАНИЕ ИССЛЕДОВАНИЯ:\n${description}\n\n${clinicalContext ? `Контекст пациента: ${clinicalContext}` : ''}`;

  // Для директивы используем Opus или Sonnet
  return analyzeMultipleImagesStreaming(fullPrompt, imagesBase64, mimeTypes, MODELS.SONNET, '', specialty);
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
  const apiKey = process.env.OPENROUTER_API_KEY;
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
        'HTTP-Referer': 'https://doctor-opus.ru',
        'X-Title': 'Doctor Opus'
      },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contentItems }
      ],
      max_tokens: 8000,
      temperature: 0.2,
      stream: true,
      stream_options: { include_usage: true }
    })
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return createTransformWithUsage(response.body!, model);
}
