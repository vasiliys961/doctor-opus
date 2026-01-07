/**
 * OpenRouter API клиент с поддержкой файлов для чата
 * Расширяет функциональность openrouter.ts для работы с изображениями и документами
 */

import { MODELS, SYSTEM_PROMPT } from './openrouter';
import { calculateCost, formatCostLog } from './cost-calculator';
import { Specialty, TITAN_CONTEXTS } from './prompts';

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
 * Подготовка контента сообщения с файлами
 */
async function prepareMessageContent(
  message: string,
  files: File[]
): Promise<Array<{ type: string; text?: string; image_url?: { url: string } }>> {
  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

  // Добавляем текстовое сообщение, если есть
  if (message.trim()) {
    content.push({ type: 'text', text: message });
  }

  // Обрабатываем файлы
  for (const file of files) {
    if (file.type.startsWith('image/')) {
      // Для изображений - конвертируем в base64
      const base64 = await fileToBase64(file);
      const mimeType = getImageMimeType(file);
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64}`
        }
      });
    } else {
      // Для других файлов - добавляем информацию о файле в текст
      const fileInfo = `[Файл: ${file.name}, размер: ${(file.size / 1024).toFixed(1)} KB, тип: ${file.type || 'неизвестен'}]`;
      if (content.length === 0 || content[content.length - 1].type !== 'text') {
        content.push({ type: 'text', text: fileInfo });
      } else {
        content[content.length - 1].text = (content[content.length - 1].text || '') + '\n' + fileInfo;
      }
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
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY не настроен');
  }

  // Подготавливаем контент с файлами
  const messageContent = await prepareMessageContent(prompt, files);

  let systemPrompt = SYSTEM_PROMPT;
  if (specialty && TITAN_CONTEXTS[specialty]) {
    systemPrompt = `${SYSTEM_PROMPT}\n\n${TITAN_CONTEXTS[specialty]}`;
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

  const payload = {
    model,
    messages,
    max_tokens: 8000,
    temperature: 0.2
  };

  try {
    console.log('Calling OpenRouter API with files:', {
      model,
      messageLength: prompt.length,
      filesCount: files.length,
      fileNames: files.map(f => f.name)
    });

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://doctor-opus.vercel.app',
        'X-Title': 'Doctor Opus'
      },
      body: JSON.stringify(payload)
    });

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
      console.log(`✅ [${model}] Запрос с файлами завершен`);
      console.log(`   📊 ${formatCostLog(model, inputTokens, outputTokens, tokensUsed)}`);
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
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY не настроен');
  }

  // Подготавливаем контент с файлами
  const messageContent = await prepareMessageContent(prompt, files);

  let systemPrompt = SYSTEM_PROMPT;
  if (specialty && TITAN_CONTEXTS[specialty]) {
    systemPrompt = `${SYSTEM_PROMPT}\n\n${TITAN_CONTEXTS[specialty]}`;
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

  const payload = {
    model,
    messages,
    max_tokens: 8000,
    temperature: 0.2,
    stream: true
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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  console.log('📡 [STREAMING WITH FILES] Запрос отправлен:', {
    model,
    filesCount: files.length,
    fileNames: files.map(f => f.name)
  });

  // Возвращаем поток как есть - OpenRouter уже возвращает правильный SSE формат
  return response.body;
}





