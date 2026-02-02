import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Максимальное время выполнения запроса (5 минут)
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Примерные тарифы OpenRouter за 1000 токенов в условных единицах (для отображения)
const PRICE_UNITS_PER_1K_TOKENS_SONNET = 2.0; // 2 единицы за 1000 токенов Claude Sonnet 4.5
const PRICE_UNITS_PER_1K_TOKENS_GEMINI = 0.4; // 0.4 единицы за 1000 токенов Gemini Flash

/**
 * ЭТАП 2. Дополнительное заключение врача-генетика
 * На основе уже выполненного извлечения, клинического контекста и вопроса пользователя.
 * Поддерживается два режима:
 *  - fast      → Gemini (дешевле, короче)
 *  - professor → Claude Sonnet 4.5 (подробное экспертное заключение)
 */
export async function POST(request: NextRequest) {
  try {
    // Проверка авторизации (ВРЕМЕННО ОТКЛЮЧЕНО)
    /*
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Необходима авторизация' },
        { status: 401 }
      );
    }
    */

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'OPENROUTER_API_KEY не настроен' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      analysis = '',
      clinicalContext = '',
      question = '',
      mode = 'professor',
      model = 'sonnet', // Добавляем поддержку выбора модели
      useStreaming = true,
      history = [],
      isFollowUp = false,
      files = [],
    } = body || {};

    if (!analysis || typeof analysis !== 'string' || analysis.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Нет исходного анализа/данных для интерпретации' },
        { status: 400 }
      );
    }

    // Если это продолжение диалога, используем историю
    let messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string | any[] }> = [];
    
    if (isFollowUp && history && history.length > 0) {
      // Продолжение диалога - используем историю
      const contextBlock =
        clinicalContext && clinicalContext.trim().length > 0
          ? `КЛИНИЧЕСКИЙ КОНТЕКСТ ПАЦИЕНТА:\n${clinicalContext.trim()}\n\n`
          : '';
      
      const systemPrompt = `${contextBlock}ИССХОДНЫЕ ДАННЫЕ ГЕНЕТИЧЕСКОГО АНАЛИЗА:\n\n${analysis}\n\n
Ты ведущий врач-генетик. Ранее ты провел анализ генетических данных и дал свое экспертное мнение.
Сейчас твоя задача — вести профессиональный диалог, отвечая на уточняющие вопросы лаконично и по существу.

### ПРАВИЛА:
1. **ЗАПРЕЩЕНО** заново использовать структуру полного отчета (Обзор, План действий и т.д.), если тебя об этом не просят прямо.
2. Отвечай прямо на поставленный вопрос, сохраняя экспертный тон.
3. Учитывай контекст предыдущего анализа и всей истории переписки.
4. Избегай вводных фраз вроде «Конечно», «Я понимаю». Сразу переходи к сути.`;

      messages.push({
        role: 'system',
        content: systemPrompt,
      });

      // Добавляем историю диалога
      history.forEach((msg: any) => {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content,
          });
        }
      });

      // Добавляем текущий вопрос с файлами
      if (question && question.trim().length > 0 || files.length > 0) {
        const userContent: any[] = [];
        
        // Добавляем текст вопроса если есть
        if (question && question.trim().length > 0) {
          userContent.push({
            type: 'text',
            text: question.trim(),
          });
        }
        
        // Добавляем информацию о файлах в текст
        if (files.length > 0) {
          const filesInfo = files.map((f: any) => `Файл: ${f.name} (${f.type})`).join('\n');
          userContent.push({
            type: 'text',
            text: `\n\nПРИКРЕПЛЕННЫЕ ФАЙЛЫ:\n${filesInfo}\n\nПроанализируй эти файлы в контексте генетического анализа и ответь на вопрос выше.`,
          });
          
          // Добавляем изображения как image_url для Vision API
          files.forEach((f: any) => {
            if (f.type.startsWith('image/')) {
              userContent.push({
                type: 'image_url',
                image_url: {
                  url: `data:${f.type};base64,${f.base64}`,
                },
              });
            }
          });
        }
        
        messages.push({
          role: 'user',
          content: userContent.length === 1 && userContent[0].type === 'text' 
            ? userContent[0].text 
            : userContent,
        });
      }
    } else {
      // Первый запрос - стандартная логика
      const contextBlock =
        clinicalContext && clinicalContext.trim().length > 0
          ? `КЛИНИЧЕСКИЙ КОНТЕКСТ ПАЦИЕНТА:\n${clinicalContext.trim()}\n\n`
          : '';

      const questionBlock =
        question && question.trim().length > 0
          ? `ДОПОЛНИТЕЛЬНЫЙ ЗАПРОС ОТ ВРАЧА:\n${question.trim()}\n\n`
          : 'Сформируй итоговое заключение врача-генетика для истории болезни и плана ведения пациента.\n\n';

      // Добавляем информацию о файлах если есть
      const filesBlock = files.length > 0
        ? `ПРИКРЕПЛЕННЫЕ ДОПОЛНИТЕЛЬНЫЕ ФАЙЛЫ:\n${files.map((f: any) => `- ${f.name} (${f.type})`).join('\n')}\n\nПроанализируй эти файлы в контексте генетического анализа.\n\n`
        : '';

      const userPrompt = `${contextBlock}${questionBlock}${filesBlock}ИССХОДНЫЕ ДАННЫЕ ГЕНЕТИЧЕСКОГО АНАЛИЗА / ПРЕДЫДУЩЕЕ ЗАКЛЮЧЕНИЕ:\n\n${analysis}\n\n
ТВОЯ ЗАДАЧА:
- Не пересказывать дословно текст выше, а на его основе сформировать чёткое, структурированное КЛИНИЧЕСКОЕ ЗАКЛЮЧЕНИЕ врача-генетика.
- Сделать акцент на: патогенных и вероятно патогенных вариантах, фармакогенетике, нутригеномике, рисках заболеваний и стратегии превентивной медицины/лонгевити.

ФОРМАТ ОТВЕТА:
1. Краткий клинический обзор генетического профиля (2–3 предложения).
2. Ключевые патогенные/вероятно патогенные варианты (ACMG классы, гены, rsID, клиническое значение).
3. Фармакогенетика (конкретные препараты, дозировки/ограничения, ссылки на CPIC/PharmGKB, если уместно).
4. Нутригеномика и метаболизм (витамины, макронутриенты, воспаление, антиоксидантные системы).
5. Персонализированные рекомендации по лечению, наблюдению и образу жизни (пошаговый план).
6. Рекомендации по скринингу и семейному консультированию (если уместно).

ПИШИ КАК ВРАЧ ДЛЯ ВРАЧА (не для пациента), профессиональным медицинским языком, с конкретикой.
Избегай «воды», сосредоточься на клинически значимых выводах и действиях.`;

      messages.push({
        role: 'system',
        content:
          mode === 'fast'
            ? 'Ты врач-генетик. Дай краткое, но клинически полезное заключение для врача на основе списка SNP и контекста.'
            : 'Ты ведущий врач-генетик. На основе генетического анализа и клинического контекста формируешь клинически применимое экспертное мнение для врача-коллеги, без лишней воды.',
      });
      
      // Если есть изображения, используем массив content
      if (files.length > 0 && files.some((f: any) => f.type.startsWith('image/'))) {
        const userContent: any[] = [
          {
            type: 'text',
            text: userPrompt,
          },
        ];
        
        // Добавляем изображения
        files.forEach((f: any) => {
          if (f.type.startsWith('image/')) {
            userContent.push({
              type: 'image_url',
              image_url: {
                url: `data:${f.type};base64,${f.base64}`,
              },
            });
          }
        });
        
        messages.push({
          role: 'user',
          content: userContent,
        });
      } else {
        messages.push({
          role: 'user',
          content: userPrompt,
        });
      }
    }

    const consultModel =
      model === 'gpt52' ? 'openai/gpt-5.2-chat' : 
      mode === 'fast' ? 'google/gemini-3-flash-preview' : 'anthropic/claude-opus-4.5';

    const payload: any = {
      model: consultModel,
      messages: messages,
      max_tokens: 16000,
      temperature: 0.25,
      stream: useStreaming,
      stream_options: useStreaming ? { include_usage: true } : undefined,
    };

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://doctor-opus.ru',
        'X-Title': 'Doctor Opus',
      },
      body: JSON.stringify(payload),
    });

    // Режим streaming: проксируем поток OpenRouter как SSE без пересборки
    if (useStreaming && response.body) {
      const readableStream = new ReadableStream({
        async start(controller) {
          const reader = response.body!.getReader();
          const encoder = new TextEncoder();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
                break;
              }
              // Просто пробрасываем как есть, streaming-utils умеет разбирать формат OpenRouter
              controller.enqueue(value);
            }
          } catch (err) {
            controller.error(err);
          } finally {
            reader.releaseLock();
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          'Content-Encoding': 'none',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          success: false,
          error: `Ошибка OpenRouter: ${response.status} - ${errorText.substring(0, 200)}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || '';

    const tokensUsed: number = data.usage?.total_tokens || 0;
    const inputTokens: number = data.usage?.prompt_tokens || 0;
    const outputTokens: number = data.usage?.completion_tokens || 0;

    const pricePer1k =
      consultModel.startsWith('google/gemini')
        ? PRICE_UNITS_PER_1K_TOKENS_GEMINI
        : PRICE_UNITS_PER_1K_TOKENS_SONNET;

    const approxCostUnits = Number(((tokensUsed / 1000) * pricePer1k).toFixed(2));

    console.log(
      `✅ [GENETIC CONSULT] Заключение готово (${consultModel}). Токенов: ${tokensUsed} (in=${inputTokens}, out=${outputTokens}), ~${approxCostUnits} ед.`
    );

    return NextResponse.json({
      success: true,
      result,
      tokensUsed,
      inputTokens,
      outputTokens,
      approxCostUnits,
      model: consultModel,
      mode,
    });
  } catch (error: any) {
    console.error('❌ [GENETIC CONSULT] Ошибка:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Внутренняя ошибка сервера',
      },
      { status: 500 }
    );
  }
}


