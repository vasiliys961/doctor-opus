import { NextRequest, NextResponse } from 'next/server';

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
      useStreaming = mode === 'professor', // по умолчанию стриминг для «профессора»
    } = body || {};

    if (!analysis || typeof analysis !== 'string' || analysis.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Нет исходного анализа/данных для интерпретации' },
        { status: 400 }
      );
    }

    const contextBlock =
      clinicalContext && clinicalContext.trim().length > 0
        ? `КЛИНИЧЕСКИЙ КОНТЕКСТ ПАЦИЕНТА:\n${clinicalContext.trim()}\n\n`
        : '';

    const questionBlock =
      question && question.trim().length > 0
        ? `ДОПОЛНИТЕЛЬНЫЙ ЗАПРОС ОТ ВРАЧА:\n${question.trim()}\n\n`
        : 'Сформируй итоговое заключение врача-генетика для истории болезни и плана ведения пациента.\n\n';

    const userPrompt = `${contextBlock}${questionBlock}ИССХОДНЫЕ ДАННЫЕ ГЕНЕТИЧЕСКОГО АНАЛИЗА / ПРЕДЫДУЩЕЕ ЗАКЛЮЧЕНИЕ:\n\n${analysis}\n\n
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

    const consultModel =
      mode === 'fast' ? 'google/gemini-3-flash-preview' : 'anthropic/claude-sonnet-4.5';

    const payload: any = {
      model: consultModel,
      messages: [
        {
          role: 'system' as const,
          content:
            mode === 'fast'
              ? 'Ты врач-генетик. Дай краткое, но клинически полезное заключение для врача на основе списка SNP и контекста.'
              : 'Ты ведущий врач-генетик-консультант. На основе генетического анализа и клинического контекста формируешь клинически применимое заключение для врача-коллеги, без лишней воды.',
        },
        {
          role: 'user' as const,
          content: userPrompt,
        },
      ],
      max_tokens: 6000,
      temperature: 0.25,
      stream: useStreaming,
    };

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/vasiliys961/medical-assistant1',
        'X-Title': 'Genetic Consultant',
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
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
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


