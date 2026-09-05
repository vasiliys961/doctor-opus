import { NextRequest, NextResponse } from 'next/server';
import { calculateCost } from '@/lib/cost-calculator';
import { anonymizeText } from "@/lib/anonymization";
import { anonymizeImageBuffer } from "@/lib/server-image-processing";
import { postLlmChatCompletionsWithFallback } from '@/lib/llm-provider';
import { appendLanguageInstruction, getForcedLanguageInstructionForRequest } from '@/lib/i18n/llm-response-language';

// Модели для сканирования документов (Gemini Flash, Haiku или Llama)
const DOCUMENT_SCAN_MODELS = [
  'google/gemini-3.8-flash',           // Gemini 1.5 Flash — стабильно и качественно для OCR
  'anthropic/claude-haiku-4.5',              // Haiku 4.5 — быстрое сканирование документов
  'meta-llama/llama-3.2-90b-vision-instruct', // Llama 3.2 90B — резерв для документов
];

/**
 * API endpoint для сканирования документов (эпикризы, справки)
 * Использует Haiku или Llama для простого извлечения текста без комментариев
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const prompt = anonymizeText(formData.get('prompt') as string || 'Извлеки весь текст из документа. Просто скопируй текст как есть, без комментариев и анализа.');
    const responseLanguageInstruction = await getForcedLanguageInstructionForRequest();
    const maskImageRaw = formData.get('maskImage');
    const maskImage = maskImageRaw === null ? true : maskImageRaw === 'true';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);

    // Если анонимно и это изображение - анонимизируем буфер
    if (maskImage && file.type.startsWith('image/')) {
      console.log(`🛡️ [SCAN] Анонимизация изображения: ${file.name}`);
      // @ts-expect-error - Несовместимость типов Buffer
      buffer = await anonymizeImageBuffer(buffer, file.type);
    }

    const base64Image = buffer.toString('base64');

    // Промпт для извлечения текста с сохранением структуры
    const scanPrompt = appendLanguageInstruction(`Extract all text from this document while preserving structure.

TABLE RULES:
- If you detect a table, preserve it in Markdown format.
- Example table:
  | Заголовок 1 | Заголовок 2 | Заголовок 3 |
  |-------------|-------------|-------------|
  | Ячейка 1    | Ячейка 2    | Ячейка 3    |
  | Ячейка 4    | Ячейка 5    | Ячейка 6    |
- Preserve all table rows/columns exactly as in source.
- Do not skip empty cells (use | |).
- Preserve alignment and inline formatting.

GENERAL RULES:
- Preserve numbered and bulleted lists.
- Preserve headings/subheadings (Markdown # allowed).
- Preserve paragraphs and indentation.
- Preserve emphasis (**bold**, *italic*).
- Do not add commentary or analysis.
- Return document text only, with structure preserved.

${prompt}`, responseLanguageInstruction);

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

        const response = await postLlmChatCompletionsWithFallback(payload, {
          headers: {
            'HTTP-Referer': 'https://doctor-opus.online',
            'X-Title': 'Doctor Opus'
          },
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
      { success: false, error: 'Document scanning error' },
      { status: 500 }
    );
  }
}


