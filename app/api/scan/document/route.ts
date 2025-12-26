import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Модели для сканирования документов (Haiku или Llama, как в главной ветке)
const DOCUMENT_SCAN_MODELS = [
  'anthropic/claude-haiku-4.5',              // Haiku 4.5 — быстрое сканирование документов
  'meta-llama/llama-3.2-90b-vision-instruct', // Llama 3.2 90B — резерв для документов
  'anthropic/claude-sonnet-4.5'              // Sonnet 4.5 — fallback
];

/**
 * API endpoint для сканирования документов (эпикризы, справки)
 * Использует Haiku или Llama для простого извлечения текста без комментариев
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const prompt = formData.get('prompt') as string || 'Извлеки весь текст из документа. Просто скопируй текст как есть, без комментариев и анализа.';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY не настроен');
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');

    // Простой промпт для извлечения текста без комментариев
    const scanPrompt = `Извлеки весь текст из этого документа. Просто скопируй текст как есть, без комментариев, без анализа, без дополнительных объяснений. Только текст документа.

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
          max_tokens: 8000,
          temperature: 0.1 // Низкая температура для точного копирования текста
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

        if (response.ok) {
          const data = await response.json();
          const result = data.choices[0].message.content || '';
          console.log(`✅ [DOCUMENT SCAN] Успешно использована модель: ${model}`);
          return NextResponse.json({
            success: true,
            result: result,
            model: model
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
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


