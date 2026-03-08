/**
 * OpenRouter API клиент с поддержкой файлов для чата
 * Расширяет функциональность openrouter.ts для работы с изображениями и документами
 */

import { MODELS } from './openrouter';
import { calculateCost, formatCostLog } from './cost-calculator';
import { Specialty, TITAN_CONTEXTS, SYSTEM_PROMPT, DIALOGUE_SYSTEM_PROMPT, STRATEGIC_SYSTEM_PROMPT } from './prompts';
import mammoth from 'mammoth';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Конвертация файла в base64 (Серверная версия для Node.js)
 */
async function fileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer).toString('base64');
}

/**
 * Определение MIME типа для изображения
 */
function getImageMimeType(file: File): string {
  if (file.type && file.type.startsWith('image/')) {
    return file.type;
  }
  const extension = file.name.toLowerCase().split('.').pop();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/jpeg';
  }
}

/**
 * Максимальный размер PDF для отправки как base64 (20 MB)
 */
const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;

/**
 * Модели, которые нативно поддерживают PDF как base64 в image_url
 * Gemini принимает application/pdf, остальные — нет (Azure GPT, Claude Azure)
 */
function modelSupportsPDFNatively(model: string): boolean {
  return model.includes('gemini');
}

function isOpenAIGeoRestrictionError(errorText: string): boolean {
  const normalized = String(errorText || '').toLowerCase();
  return (
    normalized.includes('unsupported_country_region_territory') ||
    normalized.includes('country, region, or territory not supported') ||
    normalized.includes('"provider_name":"openai"') ||
    normalized.includes('"provider_name": "openai"')
  );
}

function getChatFallbackModel(primaryModel: string): string | null {
  if (primaryModel === MODELS.GPT_5_2) {
    return MODELS.SONNET;
  }
  return null;
}

/**
 * Извлечение текста из PDF через Gemini Flash (Vision API)
 * Используется как fallback для моделей, не поддерживающих PDF нативно
 */
async function extractPDFTextViaGemini(base64PDF: string, fileName: string): Promise<string> {
  const rawKey = process.env.OPENROUTER_API_KEY;
  const apiKey = rawKey?.replace(/[\n\r\t]/g, '').trim();
  if (!apiKey) return '';

  try {
    const extractionPayload = {
      model: MODELS.GEMINI_3_FLASH,
      messages: [
        {
          role: 'user' as const,
          content: [
            {
              type: 'text',
              text: `Извлеки ВЕСЬ текст из этого PDF документа. Сохрани структуру: заголовки, таблицы (в текстовом виде), списки, числовые значения и единицы измерения. Не добавляй своих комментариев — только содержимое документа.`,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:application/pdf;base64,${base64PDF}`,
              },
            },
          ],
        },
      ],
      max_tokens: 16000,
      temperature: 0.0,
    };

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://doctor-opus.ru',
        'X-Title': 'Doctor Opus',
      },
      body: JSON.stringify(extractionPayload),
    });

    if (!response.ok) {
      console.warn(`⚠️ [PDF→Gemini] Ошибка извлечения текста из "${fileName}": ${response.status}`);
      return '';
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    const tokens = data.usage?.total_tokens || 0;
    console.log(`✅ [PDF→Gemini] Извлечён текст из "${fileName}": ${text.length} символов, ${tokens} токенов`);
    return text;
  } catch (err: any) {
    console.warn(`⚠️ [PDF→Gemini] Исключение при извлечении из "${fileName}":`, err.message);
    return '';
  }
}

/**
 * Чтение Word файла (.docx)
 */
async function readWordFile(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: Buffer.from(arrayBuffer) });
    return result.value;
  } catch (err) {
    console.warn('⚠️ Ошибка чтения Word файла:', err);
    return '';
  }
}

/**
 * Чтение текстового файла (txt, csv, json и т.д.)
 */
async function readTextFile(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const text = Buffer.from(arrayBuffer).toString('utf-8');
    return text.slice(0, 100000); // Ограничиваем 100K символов
  } catch {
    return '';
  }
}

/**
 * Подготовка контента сообщения с файлами
 * @param model — идентификатор модели, чтобы выбрать стратегию для PDF
 */
async function prepareMessageContent(
  message: string,
  files: File[],
  model: string
): Promise<Array<{ type: string; text?: string; image_url?: { url: string } }>> {
  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

  // Добавляем текстовое сообщение, если есть
  if (message.trim()) {
    content.push({ type: 'text', text: message });
  }

  // Вспомогательная функция для добавления текстового блока
  const appendText = (text: string) => {
    if (content.length > 0 && content[content.length - 1].type === 'text') {
      content[content.length - 1].text = (content[content.length - 1].text || '') + '\n\n' + text;
    } else {
      content.push({ type: 'text', text });
    }
  };

  // Обрабатываем файлы
  for (const file of files) {
    if (file.type.startsWith('image/')) {
      // Для изображений — конвертируем в base64
      const base64 = await fileToBase64(file);
      const mimeType = getImageMimeType(file);
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64}`
        }
      });
    } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      // === PDF ===
      if (file.size > MAX_PDF_SIZE_BYTES) {
        appendText(`[PDF файл "${file.name}" (${(file.size / (1024*1024)).toFixed(1)} MB) — слишком большой. Максимум ${MAX_PDF_SIZE_BYTES / (1024*1024)} MB. Загрузите скриншоты страниц или вставьте текст вручную.]`);
      } else {
        const base64 = await fileToBase64(file);

        if (modelSupportsPDFNatively(model)) {
          // Gemini — отправляем PDF как есть (поддерживает application/pdf)
          content.push({
            type: 'image_url',
            image_url: { url: `data:application/pdf;base64,${base64}` }
          });
          console.log(`✅ [PDF→Native] PDF "${file.name}" (${(file.size / 1024).toFixed(0)} KB) отправлен напрямую в ${model}`);
        } else {
          // GPT / Claude — не принимают PDF. Извлекаем текст через Gemini Flash
          console.log(`📄 [PDF→Extract] Модель ${model} не поддерживает PDF. Извлекаем текст через Gemini Flash...`);
          const extractedText = await extractPDFTextViaGemini(base64, file.name);
          if (extractedText.length > 50) {
            const header = `📄 Содержимое файла "${file.name}" (${(file.size / 1024).toFixed(0)} KB):`;
            appendText(`${header}\n\n${extractedText}`);
          } else {
            appendText(`[PDF файл "${file.name}" — не удалось извлечь содержимое. Пожалуйста, загрузите скриншоты страниц или вставьте данные вручную.]`);
          }
        }
      }
    } else if (
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      file.name.toLowerCase().endsWith('.docx')
    ) {
      // === Word (.docx) ===
      const wordText = await readWordFile(file);
      if (wordText) {
        appendText(`📄 Содержимое Word-документа "${file.name}":\n\n${wordText}`);
      } else {
        appendText(`[Word файл "${file.name}" — не удалось прочитать содержимое]`);
      }
    } else if (
      file.type.startsWith('text/') || 
      file.type === 'application/json' ||
      file.name.match(/\.(txt|csv|json|xml|md|log|vcf)$/i)
    ) {
      // Текстовые файлы — читаем содержимое
      const fileText = await readTextFile(file);
      if (fileText) {
        appendText(`📄 Содержимое файла "${file.name}":\n\n${fileText}`);
      } else {
        content.push({ type: 'text', text: `[Файл: ${file.name} — не удалось прочитать]` });
      }
    } else {
      // Неизвестный тип — добавляем метаданные
      const fileInfo = `[Файл: ${file.name}, размер: ${(file.size / 1024).toFixed(1)} KB, тип: ${file.type || 'неизвестен'}]`;
      appendText(fileInfo);
    }
  }

  return content;
}

/**
 * Отправка текстового запроса с файлами (обычный режим)
 */
export async function sendTextRequestWithFiles(
  prompt: string,
  history: Array<{ role: string; content: string }> = [],
  files: File[],
  model: string = MODELS.OPUS,
  specialty?: Specialty
): Promise<string> {
  const rawKey = process.env.OPENROUTER_API_KEY;
  const apiKey = rawKey?.replace(/[\n\r\t]/g, '').trim();

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY не настроен');
  }

  // Подготавливаем контент с файлами (передаём модель для выбора стратегии PDF)
  const messageContent = await prepareMessageContent(prompt, files, model);

  // Выбираем системный промпт: Всегда используем полный SYSTEM_PROMPT для глубины аналитики
  const basePrompt = SYSTEM_PROMPT;
  let systemPrompt = basePrompt;
  
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
      content: typeof msg.content === 'string' ? msg.content : msg.content
    })),
    {
      role: 'user' as const,
      content: messageContent.length === 1 && messageContent[0].type === 'text'
        ? messageContent[0].text || prompt
        : messageContent
    }
  ];

  // Адаптивный расчёт max_tokens на основе размера файлов
  const { calculateAdaptiveMaxTokens } = await import('./adaptive-tokens');
  const adaptiveMaxTokens = calculateAdaptiveMaxTokens({
    systemPrompt,
    history,
    userPrompt: prompt,
    files,
    mode: 'file-analysis'
  });

  let modelUsed = model;

  try {
    console.log('Calling OpenRouter API with files:', {
      model: modelUsed,
      messageLength: prompt.length,
      filesCount: files.length,
      fileNames: files.map(f => f.name),
      adaptiveMaxTokens
    });

    const runRequest = async (targetModel: string) => {
      const payload = {
        model: targetModel,
        messages,
        max_tokens: adaptiveMaxTokens, // Адаптивно в зависимости от размера файлов
        temperature: 0.1,
      };

      return fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://doctor-opus.ru',
          'X-Title': 'Doctor Opus'
        },
        body: JSON.stringify(payload)
      });
    };

    let response = await runRequest(modelUsed);
    if (!response.ok) {
      const errorText = await response.text();
      const fallbackModel = getChatFallbackModel(modelUsed);
      const shouldFallback = !!fallbackModel && isOpenAIGeoRestrictionError(errorText);
      if (shouldFallback) {
        console.warn(`⚠️ [FILES FALLBACK] ${modelUsed} недоступна по региону, переключаемся на ${fallbackModel}`);
        modelUsed = fallbackModel!;
        response = await runRequest(modelUsed);
      } else {
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText.substring(0, 500)}`);
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText.substring(0, 500)}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Неверный формат ответа от OpenRouter API');
    }

    // Логирование токенов и стоимости
    const tokensUsed = data.usage?.total_tokens || 0;
    const inputTokens = data.usage?.prompt_tokens || Math.floor(tokensUsed / 2);
    const outputTokens = data.usage?.completion_tokens || Math.floor(tokensUsed / 2);

    if (tokensUsed > 0) {
      console.log(`✅ [${modelUsed}] Запрос с файлами завершен`);
      console.log(`   📊 ${formatCostLog(modelUsed, inputTokens, outputTokens, tokensUsed)}`);
    }

    return data.choices[0].message.content || '';
  } catch (error: any) {
    console.error('Error calling OpenRouter API with files:', error);
    throw new Error(`Ошибка отправки запроса с файлами: ${error.message}`);
  }
}

/**
 * Отправка текстового запроса с файлами (streaming режим)
 */
export async function sendTextRequestStreamingWithFiles(
  prompt: string,
  history: Array<{ role: string; content: string }> = [],
  files: File[],
  model: string = MODELS.OPUS,
  specialty?: Specialty
): Promise<ReadableStream<Uint8Array>> {
  const rawKey = process.env.OPENROUTER_API_KEY;
  const apiKey = rawKey?.replace(/[\n\r\t]/g, '').trim();

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY не настроен');
  }

  // Подготавливаем контент с файлами (передаём модель для выбора стратегии PDF)
  const messageContent = await prepareMessageContent(prompt, files, model);

  // Выбираем системный промпт: Всегда используем полный SYSTEM_PROMPT для глубины аналитики
  const basePrompt = SYSTEM_PROMPT;
  let systemPrompt = basePrompt;
  
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
      content: typeof msg.content === 'string' ? msg.content : msg.content
    })),
    {
      role: 'user' as const,
      content: messageContent.length === 1 && messageContent[0].type === 'text'
        ? messageContent[0].text || prompt
        : messageContent
    }
  ];

  // Адаптивный расчёт max_tokens на основе размера файлов
  const { calculateAdaptiveMaxTokens } = await import('./adaptive-tokens');
  const adaptiveMaxTokens = calculateAdaptiveMaxTokens({
    systemPrompt,
    history,
    userPrompt: prompt,
    files,
    mode: 'file-analysis'
  });

  let modelUsed = model;

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    let heartbeat: any;
    try {
      // 1. Форсированный старт потока
      const initialPadding = ': ' + ' '.repeat(2048) + '\n\n';
      await writer.write(encoder.encode(initialPadding));

      // 2. Запускаем Heartbeat на весь период
      heartbeat = setInterval(async () => {
        try {
          await writer.write(encoder.encode(': keep-alive heartbeat\n\n'));
        } catch (e) {
          if (heartbeat) clearInterval(heartbeat);
        }
      }, 5000);

      const runStreamingRequest = async (targetModel: string) => {
        const payload = {
          model: targetModel,
          messages,
          max_tokens: adaptiveMaxTokens, // Адаптивно в зависимости от размера файлов
          temperature: 0.1,
          stream: true,
          stream_options: { include_usage: true }
        };
        return fetch(OPENROUTER_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://doctor-opus.ru',
            'X-Title': 'Doctor Opus'
          },
          body: JSON.stringify(payload)
        });
      };

      let response = await runStreamingRequest(modelUsed);

      // Heartbeat остановится в finally
      if (!response.ok) {
        const errorText = await response.text();
        const fallbackModel = getChatFallbackModel(modelUsed);
        const shouldFallback = !!fallbackModel && isOpenAIGeoRestrictionError(errorText);
        if (shouldFallback) {
          console.warn(`⚠️ [FILES STREAM FALLBACK] ${modelUsed} недоступна по региону, переключаемся на ${fallbackModel}`);
          modelUsed = fallbackModel!;
          response = await runStreamingRequest(modelUsed);
        } else {
          throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
      }
    } catch (error: any) {
      if (heartbeat) clearInterval(heartbeat);
      console.error(`❌ [FILE STREAM ERROR]:`, error);
      await writer.write(encoder.encode(`data: ${JSON.stringify({ error: error.message })}\n\n`));
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      await writer.close();
    }
  })();

  return readable;
}





