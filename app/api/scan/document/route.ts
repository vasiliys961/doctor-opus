import { NextRequest, NextResponse } from 'next/server';
import { calculateCost } from '@/lib/cost-calculator';
import { anonymizeText } from "@/lib/anonymization";
import { anonymizeImageBuffer } from "@/lib/server-image-processing";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { checkAndDeductBalance, checkAndDeductGuestBalance } from '@/lib/server-billing';
import { getRateLimitKey } from '@/lib/rate-limiter';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Модели для сканирования документов (Gemini Flash, Haiku или Llama)
const DOCUMENT_SCAN_MODELS = [
  'google/gemini-3-flash-preview',           // Gemini 1.5 Flash — стабильно и качественно для OCR
  'anthropic/claude-haiku-4.5',              // Haiku 4.5 — быстрое сканирование документов
  'meta-llama/llama-3.2-90b-vision-instruct', // Llama 3.2 90B — резерв для документов
];

function estimateDocumentScanCost(fileSizeBytes: number): number {
  const sizeMb = fileSizeBytes / (1024 * 1024);
  const estimated = 1.4 + Math.min(4.5, sizeMb * 0.35);
  return Number(Math.min(10, Math.max(1.2, estimated)).toFixed(2));
}

/**
 * API endpoint для сканирования документов (эпикризы, справки)
 * Использует Haiku или Llama для простого извлечения текста без комментариев
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email || null;
    const guestKey = userEmail ? null : getRateLimitKey(request);

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const prompt = anonymizeText(formData.get('prompt') as string || 'Извлеки весь текст из документа. Просто скопируй текст как есть, без комментариев и анализа.');
    const isAnonymous = formData.get('isAnonymous') === 'true';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    const estimatedCost = estimateDocumentScanCost(file.size);
    const billing = userEmail
      ? await checkAndDeductBalance(userEmail, estimatedCost, 'Document scan', {
          fileName: file.name,
          fileType: file.type || 'unknown',
          fileSize: file.size,
          source: 'scan_document',
        })
      : await checkAndDeductGuestBalance(guestKey!, estimatedCost, 'Guest trial: document scan', {
          fileName: file.name,
          fileType: file.type || 'unknown',
          fileSize: file.size,
          source: 'scan_document',
        });
    if (!billing.allowed) {
      return NextResponse.json(
        { success: false, error: billing.error || 'Недостаточно единиц для сканирования документа' },
        { status: 402 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY не настроен');
    }

    const arrayBuffer = await file.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);

    // Если анонимно и это изображение - анонимизируем буфер
    if (isAnonymous && file.type.startsWith('image/')) {
      console.log(`🛡️ [SCAN] Анонимизация изображения: ${file.name}`);
      // @ts-expect-error - Несовместимость типов Buffer
      buffer = await anonymizeImageBuffer(buffer, file.type);
    }

    const base64Image = buffer.toString('base64');

    // Промпт для извлечения текста с сохранением структуры
    const scanPrompt = `Извлеки весь текст из этого документа, СОХРАНЯЯ СТРУКТУРУ:

ВАЖНО ДЛЯ ТАБЛИЦ:
- Если видишь таблицу, ОБЯЗАТЕЛЬНО сохрани её в формате Markdown
- Пример таблицы:
  | Заголовок 1 | Заголовок 2 | Заголовок 3 |
  |-------------|-------------|-------------|
  | Ячейка 1    | Ячейка 2    | Ячейка 3    |
  | Ячейка 4    | Ячейка 5    | Ячейка 6    |
- Сохраняй ВСЕ строки и столбцы таблицы точно как в оригинале
- Не пропускай ячейки, даже если они пустые (используй пустую строку: | |)
- Сохраняй выравнивание и форматирование внутри ячеек

ДЛЯ ОСТАЛЬНОГО:
- Сохраняй нумерованные и маркированные списки
- Сохраняй заголовки и подзаголовки (используй # для заголовков)
- Сохраняй абзацы и отступы
- Сохраняй выделение текста (жирный **, курсив *)
- Не добавляй комментарии, анализ или объяснения
- Только текст документа с сохранением структуры

${prompt}`;

    // Пробуем модели в порядке приоритета (Haiku → Llama → Sonnet)
    for (const model of DOCUMENT_SCAN_MODELS) {
      try {
        console.log(`📄 [DOCUMENT SCAN] Пробую модель: ${model}`);
        
        const payload = {
          model,
          messages: [
            {
              role: 'user' as const,
              content: [
                {
                  type: 'text',
                  text: scanPrompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 16000, // Фиксированное значение для OCR (документы могут быть большими)
          temperature: 0.1 // Низкая температура для точного копирования текста
        };

        const response = await fetch(OPENROUTER_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://doctor-opus.ru',
            'X-Title': 'Doctor Opus'
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const data = await response.json();
          const result = data.choices[0].message.content || '';
          const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0 };
          
          // Рассчитываем стоимость
          const costInfo = calculateCost(usage.prompt_tokens, usage.completion_tokens, model);
          
          console.log(`✅ [DOCUMENT SCAN] Успешно использована модель: ${model}`);
          return NextResponse.json({
            success: true,
            result: result,
            model: model,
            usage: usage,
            cost: costInfo.totalCostUnits
          });
        } else if (response.status === 404) {
          console.warn(`⚠️ [DOCUMENT SCAN] Модель ${model} недоступна, пробую следующую...`);
          continue;
        } else if (response.status === 402) {
          console.warn(`⚠️ [DOCUMENT SCAN] Недостаточно кредитов для ${model}, пробую следующую...`);
          continue;
        } else {
          const errorText = await response.text();
          console.warn(`⚠️ [DOCUMENT SCAN] Ошибка ${response.status} от ${model}: ${errorText.substring(0, 200)}`);
          continue;
        }
      } catch (error: any) {
        console.warn(`⚠️ [DOCUMENT SCAN] Ошибка с ${model}: ${error.message}, пробую следующую модель...`);
        continue;
      }
    }

    throw new Error('Не удалось отсканировать документ ни через одну модель');
  } catch (error: any) {
    console.error('Error scanning document:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка сканирования документа' },
      { status: 500 }
    );
  }
}


