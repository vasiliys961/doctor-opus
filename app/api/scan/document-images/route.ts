import { NextRequest, NextResponse } from 'next/server';
import { calculateCost } from '@/lib/cost-calculator';
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
 * API endpoint для сканирования документов из массива изображений (PDF страницы)
 * Принимает изображения в base64 и сканирует их через Vision API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { images, prompt, maskImage: maskImageInput } = body;
    const responseLanguageInstruction = await getForcedLanguageInstructionForRequest();
    const normalizedPrompt = String(prompt || 'Extract text from all pages while preserving structure.');
    const languageAwarePrompt = appendLanguageInstruction(normalizedPrompt, responseLanguageInstruction);
    const maskImage = maskImageInput === undefined ? true : Boolean(maskImageInput);

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No images provided' },
        { status: 400 }
      );
    }

    console.log(`📄 [DOC IMAGES] Получено ${images.length} изображений для сканирования`);

    const results: string[] = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalCost = 0;
    let lastModelUsed = '';

    // Сканируем каждое изображение (страницу PDF)
    for (let i = 0; i < images.length; i++) {
      let imageBase64 = images[i];

      // Если маскирование включено — затираем данные на изображении
      if (maskImage) {
        console.log(`🛡️ [DOC IMAGES] Анонимизация страницы ${i + 1}`);
        const buffer = Buffer.from(imageBase64, 'base64');
        const anonBuffer = await anonymizeImageBuffer(buffer, 'image/png');
        imageBase64 = anonBuffer.toString('base64');
      }

      const pagePrompt = i === 0 
        ? `${languageAwarePrompt}\n\nThis is page ${i + 1} of ${images.length}. Preserve tables in Markdown with all rows and columns.`
        : `Continuation of document scan. Page ${i + 1} of ${images.length}. Preserve tables in Markdown with all rows and columns.`;
      
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

${pagePrompt}`, responseLanguageInstruction);

      let pageResult = '';
      let modelUsed = '';

      // Пробуем модели в порядке приоритета (Haiku → Llama → Sonnet)
      for (const model of DOCUMENT_SCAN_MODELS) {
        try {
          console.log(`📄 [DOC IMAGES] Страница ${i + 1}/${images.length}, пробую модель: ${model}`);
          
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
                      url: `data:image/png;base64,${imageBase64}`
                    }
                  }
                ]
              }
            ],
            max_tokens: 16000, // Фиксированное значение для OCR множественных страниц
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
            pageResult = data.choices[0].message.content || '';
            modelUsed = model;
            lastModelUsed = model;
            
            if (data.usage) {
              totalPromptTokens += data.usage.prompt_tokens || 0;
              totalCompletionTokens += data.usage.completion_tokens || 0;
              const costInfo = calculateCost(data.usage.prompt_tokens, data.usage.completion_tokens, model);
              totalCost += costInfo.totalCostUnits;
            }
            
            console.log(`✅ [DOC IMAGES] Страница ${i + 1} отсканирована через ${model}`);
            break; // Успешно, выходим из цикла моделей
          } else if (response.status === 404) {
            console.warn(`⚠️ [DOC IMAGES] Модель ${model} недоступна, пробую следующую...`);
            continue;
          } else if (response.status === 402) {
            console.warn(`⚠️ [DOC IMAGES] Недостаточно кредитов для ${model}, пробую следующую...`);
            continue;
          } else {
            const errorText = await response.text();
            console.warn(`⚠️ [DOC IMAGES] Ошибка ${response.status} от ${model}: ${errorText.substring(0, 200)}`);
            continue;
          }
        } catch (error: any) {
          console.warn(`⚠️ [DOC IMAGES] Ошибка с ${model}: ${error.message}, пробую следующую модель...`);
          continue;
        }
      }

      if (!pageResult) {
        throw new Error(`Не удалось отсканировать страницу ${i + 1} ни через одну модель`);
      }

      results.push(`\n\n=== Page ${i + 1} ===\n${pageResult}`);
    }

    // Объединяем результаты всех страниц
    let finalResult = results.join('\n');
    
    if (images.length > 1) {
      console.log('📊 [DOC IMAGES] Объединение результатов со всех страниц...');
      // Можно добавить дополнительную структуризацию, но обычно просто объединяем
      finalResult = `=== DOCUMENT SCAN (${images.length} pages) ===\n${finalResult}`;
    }

    console.log('✅ [DOC IMAGES] Сканирование завершено успешно');

    return NextResponse.json({
      success: true,
      result: finalResult,
      cost: totalCost,
      usage: {
        prompt_tokens: totalPromptTokens,
        completion_tokens: totalCompletionTokens,
        total_tokens: totalPromptTokens + totalCompletionTokens
      },
      model: lastModelUsed
    });
  } catch (error: any) {
    console.error('❌ [DOC IMAGES] Общая ошибка:', error);
    return NextResponse.json(
      { success: false, error: 'Document image processing error' },
      { status: 500 }
    );
  }
}

