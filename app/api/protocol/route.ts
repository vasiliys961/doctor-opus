import { NextRequest, NextResponse } from 'next/server';
import { sendTextRequest, MODELS } from '@/lib/openrouter';
import { sendTextRequestStreaming } from '@/lib/openrouter-streaming';
import { formatCostLog } from '@/lib/cost-calculator';
import { anonymizeText } from '@/lib/anonymization';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      rawText: rawIncomingText, 
      useStreaming = true, 
      model = 'sonnet',
      templateId,
      customTemplate,
      specialistName,
      universalPrompt = ''
    } = body;
    const rawText = anonymizeText(rawIncomingText);

    if (!rawText || !rawText.trim()) {
      return NextResponse.json({ success: false, error: 'Текст не предоставлен' }, { status: 400 });
    }

    // Добавляем специфическую инструкцию специалиста в промпт
    const specialistDirective = universalPrompt ? `СПЕЦИФИЧЕСКАЯ ИНСТРУКЦИЯ ДЛЯ ПРОФИЛЯ (${specialistName}): ${universalPrompt}\n\n` : '';

    // АДАПТИРОВАННЫЙ ПРОМПТ НА ОСНОВЕ ВАШЕГО ЗАПРОСА
    const prompt = `Вы — опытный врач-специалист (${specialistName || 'Терапевт'}), экспертный интеллектуальный ассистент с компетенциями профессора клинической медицины и ведущий специалист университетской клиники с многолетним клиническим опытом.
${specialistDirective}
Вы совмещаете клиническую строгость и ответственность, обрабатывая несистемно изложенную информацию и облекая её в стандартный протокол осмотра с рекомендациями по обследованию и лечению.

ВАША ЗАДАЧА:
Создать полный и структурированный протокол осмотра на основании следующих данных:
${rawText}

СТРОГИЙ ШАБЛОН ДЛЯ ЗАПОЛНЕНИЯ:
${customTemplate}

ОГРАНИЧЕНИЯ И ПРАВИЛА СТИЛЯ (ОБЯЗАТЕЛЬНО):
1. Начало ответа: Начни СРАЗУ с заголовка "ПРОТОКОЛ ПРИЕМА". Без вводных слов и приветствий.
2. Форматирование текста: Текст в разделах (жалобы, анамнез, осмотр) должен быть БЕЗ дополнительных абзацев и пустых строк. Пиши ЕДИНЫМ ПОЛОТНОМ внутри каждого раздела.
3. Объективный осмотр: Не используй выражения "не проводилась". Описывай норму для всех основных систем, если нет данных о патологии.
4. Диагноз: Выноси на основании российских классификаций болезней (МКБ-10).
5. Рекомендации: Пиши по пунктам 1., 2., и т.д. Используй сокращения для длинных строк. Не делай пропусков между строками.
6. Лекарства: Указывай международное название (МНН) и 2 коммерческих названия (бренд и копию/генерик), доступных в РФ. Без лишних пропусков.
7. Объем: Придерживайся стиля, чтобы текст уместился на 2 страницы А4.
8. Подвал: Тезис о согласии в конце сделай мелким шрифтом (используй тег <small> или просто выдели текстом в конце).
9. Ссылки: Указывай ссылки на проверенные международные источники (UpToDate, PubMed, Cochrane, NCCN, ESC, WHO и др.) для ключевых шагов терапии (предпочтительно ≤5 лет).

Стиль: строго профессиональный, клинически и технически точный. Язык: русский.`;

    const MODEL = model === 'opus' ? MODELS.OPUS : 
                 model === 'gpt52' ? MODELS.GPT_5_2 : 
                 (model === 'gemini' ? MODELS.GEMINI_3_FLASH : MODELS.SONNET);
    
    if (useStreaming) {
      const stream = await sendTextRequestStreaming(prompt, [], MODEL);
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    let result = await sendTextRequest(prompt, []);
    return NextResponse.json({ success: true, protocol: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Ошибка генерации протокола' }, { status: 500 });
  }
}
