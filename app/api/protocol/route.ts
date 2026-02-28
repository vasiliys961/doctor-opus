import { NextRequest, NextResponse } from 'next/server';
import { sendTextRequest, MODELS } from '@/lib/openrouter';
import { sendTextRequestStreaming } from '@/lib/openrouter-streaming';
import { formatCostLog } from '@/lib/cost-calculator';
import { anonymizeText } from '@/lib/anonymization';

function buildProtocolCorrectionPrompt(params: {
  rawText: string;
  template: string;
  draft: string;
}): string {
  const { rawText, template, draft } = params;
  return `Ты — старший врач-контролер качества меддокументации.

ПРОВЕРЬ И ИСПРАВЬ ЧЕРНОВИК ПРОТОКОЛА:
1) Сохрани структуру шаблона 1:1 (пункты, порядок, таблицы).
2) Клинические данные должны быть ТОЛЬКО из текущего случая.
3) Если в черновике есть старые данные из шаблона — замени на данные текущего случая.
4) Если клинические данные не указаны — заполняй нормой (а не старыми значениями шаблона).
5) Диагноз и тактика обязательны.
6) Не пиши пояснений. Верни только итоговый исправленный документ.

ТЕКУЩИЙ СЛУЧАЙ:
${rawText}

ШАБЛОН (КАРКАС):
${template}

ЧЕРНОВИК ДЛЯ ИСПРАВЛЕНИЯ:
${draft}`;
}

function sanitizeProtocolSse(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  const sanitizeEventBlock = (block: string): string => {
    const lines = block.split('\n');
    const sanitizedLines = lines.map((line) => {
      if (!line.startsWith('data: ')) return line;

      const payload = line.slice(6).trim();
      if (payload === '[DONE]') return line;

      try {
        const parsed = JSON.parse(payload);
        const content = parsed?.choices?.[0]?.delta?.content;
        if (typeof content === 'string' && content.length > 0) {
          parsed.choices[0].delta.content = anonymizeText(content);
        }
        return `data: ${JSON.stringify(parsed)}`;
      } catch {
        return line;
      }
    });
    return sanitizedLines.join('\n');
  };

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          let delimiterIndex = buffer.indexOf('\n\n');
          while (delimiterIndex !== -1) {
            const eventBlock = buffer.slice(0, delimiterIndex);
            buffer = buffer.slice(delimiterIndex + 2);
            const sanitized = sanitizeEventBlock(eventBlock);
            controller.enqueue(encoder.encode(`${sanitized}\n\n`));
            delimiterIndex = buffer.indexOf('\n\n');
          }
        }

        if (buffer.length > 0) {
          const sanitized = sanitizeEventBlock(buffer);
          controller.enqueue(encoder.encode(sanitized));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });
}

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
      universalPrompt = '',
      ragExamples = [],
      strictTemplateMode = true
    } = body;
    const rawText = anonymizeText(String(rawIncomingText ?? ''));
    const safeTemplate = anonymizeText(String(customTemplate ?? '')).trim();
    const isStrictTemplateMode = strictTemplateMode !== false;

    if (!rawText || !rawText.trim()) {
      return NextResponse.json({ success: false, error: 'Текст не предоставлен' }, { status: 400 });
    }
    if (!safeTemplate) {
      return NextResponse.json({ success: false, error: 'Шаблон не предоставлен' }, { status: 400 });
    }

    // Добавляем специфическую инструкцию специалиста в промпт
    const specialistDirective = universalPrompt
      ? `СПЕЦИФИЧЕСКАЯ ИНСТРУКЦИЯ ДЛЯ ПРОФИЛЯ (${specialistName}): ${universalPrompt}\n\n`
      : '';
    const safeRagExamples = Array.isArray(ragExamples)
      ? ragExamples
          .map((chunk: unknown) => anonymizeText(String(chunk ?? '')).trim())
          .filter(Boolean)
          .slice(0, 8)
      : [];
    const ragDirective = safeRagExamples.length > 0
      ? `ПРИМЕРЫ ИЗ ПЕРСОНАЛЬНОЙ RAG-БИБЛИОТЕКИ (это эталон ФОРМЫ и порядка заполнения; медицинские факты бери ТОЛЬКО из текущего случая):
${safeRagExamples.map((chunk: string, index: number) => `--- ОБРАЗЕЦ #${index + 1} ---\n${chunk}`).join('\n\n')}

`
      : '';

    const isEcgFunctionalConclusion = templateId === 'ecg-functional-conclusion';
    const hasDiagnosisSection = /(диагноз|заключени|мкб|diagnosis|assessment)/i.test(safeTemplate);
    const hasTreatmentSection = /(лечени|терап|рекомендац|назначени|plan|treatment)/i.test(safeTemplate);
    const templateHasMarkdownTable = /\|.+\|\s*\n\|[\s:-]+\|/m.test(safeTemplate);
    const requiredClinicalBlockDirective =
      !isEcgFunctionalConclusion && (!hasDiagnosisSection || !hasTreatmentSection)
        ? `\n10. Если в шаблоне нет явных разделов для диагноза/лечения, добавь в КОНЦЕ два коротких раздела: "Диагностическое заключение" и "План лечения и рекомендации".`
        : '';
    const strictTemplateDirective = isStrictTemplateMode
      ? `\nСТРОГИЙ РЕЖИМ ЗАПОЛНЕНИЯ:
- Сохраняй порядок и названия разделов шаблона 1:1.
- Заполняй КАЖДЫЙ раздел шаблона.
- Не оставляй пустые поля.
- Не добавляй произвольные новые разделы (кроме случая из п.10).`
      : `\nГИБКИЙ РЕЖИМ:
- Ориентируйся на шаблон как на основной каркас, но можешь слегка адаптировать формулировки для клинической ясности.`;
    const tableDirective = templateHasMarkdownTable
      ? `\nТАБЛИЦЫ (ОБЯЗАТЕЛЬНО):
- Если в шаблоне есть таблица, выведи таблицу в Markdown-формате.
- Сохрани количество столбцов и порядок колонок из шаблона.
- Не превращай таблицу в обычный текст.`
      : '';
    const diagnosisDirective = !isEcgFunctionalConclusion
      ? `\nДИАГНОЗ И ТАКТИКА (ОБЯЗАТЕЛЬНО):
- Пункт(ы) "Диагноз" должны быть заполнены всегда.
- Сформулируй основной клинический диагноз по данным случая.
- Добавь код МКБ-10: если код явно указан во входных данных — перенеси его; если кода нет, укажи наиболее клинически обоснованный код.
- Обязательно заполни блок лечения/рекомендаций в рамках структуры шаблона (или добавь по правилу п.10).`
      : '';
    const refreshFromCurrentCaseDirective = `\nПРИОРИТЕТ ДАННЫХ (КРИТИЧЕСКИ ВАЖНО):
- Загруженный шаблон и RAG-образцы используй только как ФОРМУ/каркас.
- Если в шаблоне уже есть старые клинические значения (жалобы, анамнез, АД, ЧСС, ЭКГ, диагноз, лечение) — ЗАМЕНИ их на значения из текущего случая.
- Не переписывай старый кейс "как есть". Нужна новая заполненная карта по текущим вводным.
- При конфликте данных всегда приоритет у "ВХОДНЫЕ ДАННЫЕ текущего случая".`;
    const clinicalDefaultsDirective = !isEcgFunctionalConclusion
      ? `\nПРАВИЛО НОРМЫ ПРИ НЕПОЛНЫХ ДАННЫХ:
- Для клинических полей (объективный статус, системы органов, локальный статус, базовые формулировки осмотра) при отсутствии явной патологии заполняй физиологической нормой.
- Не подтягивай "старые" отклонения из шаблона, если врач их не указал в текущем случае.
- "НЕТ ДАННЫХ" используй только там, где норму задать некорректно: административные поля, время/документы/подписи/номерные реквизиты, а также неизвестные точные числовые значения, которые нельзя безопасно предположить.
- Если врач указал отклонение (например, АД 180, головная боль, тошнота), оно имеет приоритет и обязательно отражается в соответствующих разделах.`
      : '';
    const clinicalReasoningDirective = !isEcgFunctionalConclusion
      ? `\nКЛИНИЧЕСКИЙ ИНТЕЛЛЕКТ (ОБЯЗАТЕЛЬНО, но НЕ ПОКАЗЫВАЙ рассуждения):
- Перед финальным выводом выполни внутреннюю проверку "симптомы → объективно → диагноз → тактика".
- Диагноз должен объяснять ключевые жалобы и объективные признаки текущего случая.
- Лечение и рекомендации должны соответствовать тяжести состояния и данным витальных показателей.
- Исключи клинические противоречия (например, тяжелые жалобы при полностью несоответствующем описании без объяснения).
- Если данных мало, выбирай безопасную консервативную тактику и указывай контроль/повторную оценку.
- Не выводи chain-of-thought, только итоговый протокол.`
      : '';
    const evidencePriorityDirective = `\nПРИОРИТЕТ ИСТОЧНИКОВ:
1) Текущие вводные врача (главный источник).
2) Структура загруженного шаблона.
3) RAG-образцы только как стиль/форма.
Никогда не подменяй факты текущего случая содержимым шаблона или RAG.`;

    // Для ЭКГ делаем отдельный режим: короткое формальное заключение функционалиста.
    // Это специально, чтобы НЕ появлялись "клинические гипотезы", тактика и рассуждения.
    const prompt = isEcgFunctionalConclusion
      ? `Вы — врач функциональной диагностики (ЭКГ). Сформируй КОРОТКОЕ формальное заключение по ЭКГ на основании входного текста.
${specialistDirective}ВХОДНЫЕ ДАННЫЕ (из анализа ЭКГ):
${rawText}

${ragDirective}СТРОГИЙ ШАБЛОН ДЛЯ ВЫВОДА (заполни по нему):
${safeTemplate}

ОГРАНИЧЕНИЯ (ОБЯЗАТЕЛЬНО):
1. Выводи ТОЛЬКО заключение по шаблону. Без разделов "клинические гипотезы", "differential diagnosis", тактики, верификации, дисклеймеров и рассуждений.
2. Длина: 4–6 строк (коротко).
3. Не придумывай параметры. Числа (PQ/QRS/QTc, мм ST) указывай только если они явно есть во входном тексте. Если нет — пиши "нет данных".
4. Не меняй знак ST: если написано "депрессия" — не пиши "элевация" и наоборот.
5. Не ставь диагнозы ОКС/ИМ и не добавляй фразы про "ОКС нет", если этого нет во входном тексте.
${refreshFromCurrentCaseDirective}
Язык: русский.`
      : `Вы — опытный врач-специалист (${specialistName || 'Терапевт'}), экспертный интеллектуальный ассистент с компетенциями профессора клинической медицины и ведущий специалист университетской клиники с многолетним клиническим опытом.
${specialistDirective}Вы совмещаете клиническую строгость и ответственность, обрабатывая несистемно изложенную информацию и облекая её в стандартный протокол осмотра с рекомендациями по обследованию и лечению.

ВАША ЗАДАЧА:
Создать полный и структурированный протокол осмотра на основании следующих данных:
${rawText}

${ragDirective}СТРОГИЙ ШАБЛОН ДЛЯ ЗАПОЛНЕНИЯ:
${safeTemplate}

ОГРАНИЧЕНИЯ И ПРАВИЛА СТИЛЯ (ОБЯЗАТЕЛЬНО):
1. Начало ответа: Начни строго с первой строки шаблона. Без вводных слов, без приветствий, без префиксов.
2. Форматирование текста: Текст в разделах (жалобы, анамнез, осмотр) должен быть БЕЗ дополнительных абзацев и пустых строк. Пиши ЕДИНЫМ ПОЛОТНОМ внутри каждого раздела.
3. Объективный осмотр: Не используй выражения "не проводилась". Описывай норму для всех основных систем, если нет данных о патологии.
4. Диагноз: Выноси на основании российских классификаций болезней (МКБ-10).
5. Рекомендации: Пиши по пунктам 1., 2., и т.д. Используй сокращения для длинных строк. Не делай пропусков между строками.
6. Лекарства: Указывай международное название (МНН) и 2 коммерческих названия (бренд и копию/генерик), доступных в РФ. Без лишних пропусков.
7. Объем: Придерживайся стиля, чтобы текст уместился на 2 страницы А4.
8. Подвал: Тезис о согласии в конце сделай мелким шрифтом (используй тег <small> или просто выдели текстом в конце).
9. Ссылки: Указывай ссылки на проверенные международные источники (UpToDate, PubMed, Cochrane, NCCN, ESC, WHO и др.) для ключевых шагов терапии (предпочтительно ≤5 лет).
${requiredClinicalBlockDirective}
${strictTemplateDirective}
${tableDirective}
${diagnosisDirective}
${refreshFromCurrentCaseDirective}
${clinicalDefaultsDirective}
${clinicalReasoningDirective}
${evidencePriorityDirective}

Стиль: строго профессиональный, клинически и технически точный. Язык: русский.`;

    const MODEL = model === 'opus' ? MODELS.OPUS : 
                 model === 'gpt52' ? MODELS.GPT_5_2 : 
                 (model === 'gemini' ? MODELS.GEMINI_3_FLASH : MODELS.SONNET);
    
    if (useStreaming) {
      const stream = await sendTextRequestStreaming(prompt, [], MODEL);
      const sanitizedStream = sanitizeProtocolSse(stream);
      return new Response(sanitizedStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    let result = await sendTextRequest(prompt, []);
    if (!isEcgFunctionalConclusion && isStrictTemplateMode) {
      const correctionPrompt = buildProtocolCorrectionPrompt({
        rawText,
        template: safeTemplate,
        draft: result,
      });
      result = await sendTextRequest(correctionPrompt, []);
    }
    result = anonymizeText(result);
    return NextResponse.json({ success: true, protocol: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Ошибка генерации протокола' }, { status: 500 });
  }
}
