/**
 * Стриминг для OpenRouter API
 * Реализует Server-Sent Events (SSE) для постепенного получения ответов и двухэтапный анализ
 */

import { calculateCost, formatCostLog } from './cost-calculator';
import { type ImageType } from './prompts';

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
  HAIKU: 'anthropic/claude-haiku-4.5',
  LLAMA: 'meta-llama/llama-3.2-90b-vision-instruct',
  GEMINI_3_FLASH: 'google/gemini-3-flash-preview',
  GEMINI_3_PRO: 'google/gemini-3-flash-preview',
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
  mimeTypes: string[] = []
): Promise<ReadableStream<Uint8Array>> {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // Запускаем процесс асинхронно
  (async () => {
    try {
      let accumulatedFirstPart = '';

      // --- ЧАСТЬ 1: Описание ---
      console.log(`📡 [SEQUENTIAL] Запуск Части 1 (Описание)...`);
      const response1 = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://doctor-opus.vercel.app',
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
          stream: true
        })
      });

      if (!response1.ok) throw new Error(`Step 1 failed: ${response1.status}`);
      
      const reader1 = response1.body!.getReader();
      writer.write(encoder.encode('data: {"choices": [{"delta": {"content": "## 🔍 ОБЪЕКТИВНЫЙ СТАТУС (ОПИСАНИЕ)\\n\\n"}}]}\n\n'));

      while (true) {
        const { done, value } = await reader1.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        writer.write(value);

        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ') && line.trim() !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6));
              accumulatedFirstPart += data.choices[0]?.delta?.content || '';
            } catch (e) {}
          }
        }
      }

      // Пингуем канал, чтобы не закрылся
      writer.write(encoder.encode(': keep-alive\\n\\n'));

      // --- ЧАСТЬ 2: Клиника ---
      console.log(`📡 [SEQUENTIAL] Запуск Части 2 (Директива)...`);
      const response2 = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://doctor-opus.vercel.app',
          'X-Title': 'Doctor Opus'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { 
              role: 'user', 
              content: `ИНСТРУКЦИЯ: ${secondPartPrompt}\n\nОПИСАНИЕ СНИМКОВ:\n${accumulatedFirstPart}\n\nСФОРМУЛИРУЙ ТОЛЬКО ДИАГНОЗЫ, ПЛАН ЛЕЧЕНИЯ И ССЫЛКИ.` 
            }
          ],
          max_tokens: 5000,
          temperature: 0.2,
          stream: true
        })
      });

      if (!response2.ok) {
        const errorText = await response2.text();
        throw new Error(`Part 2 error: ${response2.status} - ${errorText}`);
      }

      const reader2 = response2.body!.getReader();
      // Выводим разделитель перед второй частью
      writer.write(encoder.encode('\n\ndata: {"choices": [{"delta": {"content": "\\n\\n---\\n\\n## 🩺 КЛИНИЧЕСКАЯ ДИРЕКТИВА\\n\\n"}}]}\n\n'));

      while (true) {
        const { done, value } = await reader2.read();
        if (done) break;
        writer.write(value); // Стримим вторую часть
      }

      // Явно сигнализируем о завершении
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
  clinicalContext?: string
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

  const { extractImageJSON } = await import('./openrouter');
  const jsonExtraction = await extractImageJSON({
    imageBase64,
    modality: imageType || 'unknown'
  });

  const { getDirectivePrompt } = await import('./prompts');
  const directivePrompt = getDirectivePrompt(imageType as any, prompt);

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
    ['image/png']
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
  mimeTypes: string[] = []
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

  try {
    console.log(`🚀 [MULTI-OPTIMIZED STREAMING] Шаг 1: Извлечение JSON...`);
    const { extractImageJSON } = await import('./openrouter');
    const jsonExtraction = await extractImageJSON({
      imagesBase64,
      modality: imageType || 'unknown'
    });
    
    const { getDescriptionPrompt, getDirectivePrompt } = await import('./prompts');
    const descriptionPromptCriteria = getDescriptionPrompt(imageType || 'universal');
    const clinicalPromptCriteria = getDirectivePrompt(imageType || 'universal', prompt);

    const step1Prompt = `${descriptionPromptCriteria}\n\n=== СТРУКТУРИРОВАННЫЕ ДАННЫЕ (GEMINI JSON) ===\n${JSON.stringify(jsonExtraction, null, 2)}\n\n${clinicalContext ? `Контекст пациента: ${clinicalContext}` : ''}`;
    const step2Prompt = clinicalPromptCriteria;

    return createSequentialStream(step1Prompt, step2Prompt, imagesBase64, MODELS.SONNET, apiKey, mimeTypes);
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
  mimeTypes: string[] = []
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

  try {
    const { extractImageJSON } = await import('./openrouter');
    const jsonExtraction = await extractImageJSON({ imagesBase64, modality: imageType || 'unknown' });
    
    const { getDescriptionPrompt, getDirectivePrompt } = await import('./prompts');
    const descriptionPromptCriteria = getDescriptionPrompt(imageType || 'universal');
    const clinicalPromptCriteria = getDirectivePrompt(imageType || 'universal', prompt);

    const step1Prompt = `${descriptionPromptCriteria}\n\n=== СТРУКТУРИРОВАННЫЕ ДАННЫЕ (GEMINI JSON) ===\n${JSON.stringify(jsonExtraction, null, 2)}\n\n${clinicalContext ? `Контекст пациента: ${clinicalContext}` : ''}`;
    const step2Prompt = clinicalPromptCriteria;

    return createSequentialStream(step1Prompt, step2Prompt, imagesBase64, MODELS.OPUS, apiKey, mimeTypes);
  } catch (error: any) {
    throw error;
  }
}

/**
 * Streaming запрос для текстового чата
 */
export async function sendTextRequestStreaming(
  prompt: string,
  history: Array<{role: string, content: string}> = [],
  model: string = MODELS.OPUS
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    ...history.map(msg => ({ role: msg.role as 'user' | 'assistant', content: msg.content })),
    { role: 'user' as const, content: prompt }
  ];

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://doctor-opus.vercel.app',
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
  return response.body!;
}

/**
 * Streaming анализ изображения через OpenRouter API
 */
export async function analyzeImageStreaming(
  prompt: string,
  imageBase64: string,
  model: string = MODELS.OPUS,
  mimeType: string = 'image/png',
  clinicalContext?: string
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

  let fullPrompt = prompt;
  if (clinicalContext) {
    fullPrompt = `${prompt}\n\n=== КЛИНИЧЕСКИЙ КОНТЕКСТ ПАЦИЕНТА ===\n${clinicalContext}`;
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://doctor-opus.vercel.app',
      'X-Title': 'Doctor Opus'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
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
  return response.body!;
}

/**
 * Streaming оптимизированный анализ (Gemini JSON → Sonnet)
 */
export async function analyzeImageOpusTwoStageStreaming(
  prompt: string,
  imageBase64: string,
  imageType?: ImageType,
  clinicalContext?: string
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

  try {
    const { extractImageJSON } = await import('./openrouter');
    const jsonExtraction = await extractImageJSON({ imageBase64, modality: imageType || 'unknown' });
    
    const { getDescriptionPrompt, getDirectivePrompt } = await import('./prompts');
    const descriptionPromptCriteria = getDescriptionPrompt(imageType || 'universal');
    const clinicalPromptCriteria = getDirectivePrompt(imageType || 'universal', prompt);

    const step1Prompt = `${descriptionPromptCriteria}\n\n=== СТРУКТУРИРОВАННЫЕ ДАННЫЕ (GEMINI JSON) ===\n${JSON.stringify(jsonExtraction, null, 2)}\n\n${clinicalContext ? `Контекст пациента: ${clinicalContext}` : ''}`;
    const step2Prompt = clinicalPromptCriteria;

    return createSequentialStream(step1Prompt, step2Prompt, [imageBase64], MODELS.SONNET, apiKey, ['image/png']);
  } catch (error: any) {
    throw error;
  }
}

/**
 * Streaming анализ изображения через Opus с использованием JSON от Gemini
 */
export async function analyzeImageWithJSONStreaming(
  jsonExtraction: any,
  imageBase64: string,
  prompt: string = 'Проанализируйте медицинское изображение.',
  mimeType: string = 'image/png',
  imageType?: ImageType,
  clinicalContext?: string
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

  const { getDescriptionPrompt, getDirectivePrompt } = await import('./prompts');
  const descriptionPromptCriteria = getDescriptionPrompt(imageType || 'universal');
  const clinicalPromptCriteria = getDirectivePrompt(imageType || 'universal', prompt);

  const step1Prompt = `${descriptionPromptCriteria}\n\n=== СТРУКТУРИРОВАННЫЕ ДАННЫЕ (GEMINI JSON) ===\n${JSON.stringify(jsonExtraction, null, 2)}\n\n${clinicalContext ? `Контекст пациента: ${clinicalContext}` : ''}`;
  const step2Prompt = clinicalPromptCriteria;

    return createSequentialStream(step1Prompt, step2Prompt, [imageBase64], MODELS.OPUS, apiKey, [mimeType]);
}

/**
 * Стриминг для получения ТОЛЬКО описания изображений (Шаг 1 в ручном режиме)
 */
export async function analyzeMultipleImagesDescriptionStreaming(
  prompt: string,
  imagesBase64: string[],
  imageType: string = 'universal',
  clinicalContext?: string,
  mimeTypes: string[] = []
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

  const { getDescriptionPrompt } = await import('./prompts');
  const descriptionPrompt = getDescriptionPrompt(imageType as any);

  const fullPrompt = `${descriptionPrompt}\n\n${prompt}\n\n${clinicalContext ? `Контекст пациента: ${clinicalContext}` : ''}`;

  return analyzeMultipleImagesStreaming(fullPrompt, imagesBase64, mimeTypes, MODELS.SONNET, '');
}

/**
 * Стриминг для получения ТОЛЬКО клинической директивы на основе описания (Шаг 2 в ручном режиме)
 */
export async function analyzeMultipleImagesDirectiveStreaming(
  prompt: string,
  description: string,
  imagesBase64: string[],
  clinicalContext?: string,
  mimeTypes: string[] = []
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

  const { getDirectivePrompt } = await import('./prompts');
  const directivePrompt = getDirectivePrompt('universal', prompt);

  const fullPrompt = `${directivePrompt}\n\nОПИСАНИЕ ИССЛЕДОВАНИЯ:\n${description}\n\n${clinicalContext ? `Контекст пациента: ${clinicalContext}` : ''}`;

  // Для директивы используем Opus или Sonnet
  return analyzeMultipleImagesStreaming(fullPrompt, imagesBase64, mimeTypes, MODELS.SONNET, '');
}

/**
 * Streaming анализ множественных изображений
 */
export async function analyzeMultipleImagesStreaming(
  prompt: string,
  imagesBase64: string[],
  mimeTypes: string[] = [],
  model: string = MODELS.OPUS,
  clinicalContext?: string
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY не настроен');

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
      'HTTP-Referer': 'https://doctor-opus.vercel.app',
      'X-Title': 'Doctor Opus'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: contentItems }
      ],
      max_tokens: 8000,
      temperature: 0.2,
      stream: true,
      stream_options: { include_usage: true }
    })
  });

  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.body!;
}
