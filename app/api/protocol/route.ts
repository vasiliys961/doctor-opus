import { NextRequest, NextResponse } from 'next/server';
import { sendTextRequest, sendTextRequestWithUsage, MODELS, type TextRequestUsage } from '@/lib/openrouter';
import { sendTextRequestStreaming } from '@/lib/openrouter-streaming';
import { formatCostLog } from '@/lib/cost-calculator';
import { anonymizeText } from '@/lib/anonymization';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { checkAndDeductBalance, checkAndDeductGuestBalance } from '@/lib/server-billing';
import { getRateLimitKey } from '@/lib/rate-limiter';

function estimateProtocolCost(rawTextLength: number, strictTemplateMode: boolean): number {
  const base = strictTemplateMode ? 3.2 : 2.4;
  const sizeFactor = Math.min(2.5, rawTextLength / 4000);
  return Number(Math.min(10, Math.max(1.5, base + sizeFactor)).toFixed(2));
}

const STRICT_FAST_RAWTEXT_THRESHOLD = 12000;
const STRICT_FAST_TEMPLATE_THRESHOLD = 6000;
const STRICT_CORRECTION_TIMEOUT_MS = Number(process.env.PROTOCOL_STRICT_CORRECTION_TIMEOUT_MS || 55000);

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

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
6) Запрещено добавлять новые разделы, преамбулы и заголовки вне шаблона.
7) Запрещены служебные блоки типа "0. ОФИЦИАЛЬНЫЙ ЗАГОЛОВОК", "Official Header", "Conclusion", "Verification Block".
8) Не пиши пояснений. Верни только итоговый исправленный документ.

ФОРМАТ И СТИЛЬ (ОБЯЗАТЕЛЬНО):
- Начни строго с первой строки шаблона и закончи последней строкой шаблона.
- Сохрани названия разделов и порядок разделов шаблона БЕЗ изменений.
- Для разделов "Жалобы", "Анамнез заболевания", "Анамнез жизни", "Объективный осмотр" пиши единым полотном (одним абзацем без пустых строк внутри раздела).
- Для блока "Рекомендованные обследования" используй строгую нумерацию "1.", "2.", ...
- Для блока "Терапия" блок фармакотерапии оформляй только нумерованным списком "1.", "2.", "3.", ...
- Запрещены Markdown-артефакты: "**", "__", "#", тройные обратные кавычки, а также HTML-теги "<small>" и "</small>".
- В разделах "Рекомендованные обследования" и "Фармакотерапия" запрещены маркеры "-", "*", "•" вместо нумерации.
- В разделе "Фармакотерапия/Рецепты" не оставляй пустые бланки: для каждого пункта укажи МНН + 2 торговых наименования (бренд и генерик) и схему приёма.
- Если есть блок рецептов (Rp.), оформляй его на латинском по фарм-справочнику: "Rp.: [форма] [наименование] [доза]" + "S.: ...".
- Для МНН в рецептурной строке используй латинское наименование (предпочтительно в родительном падеже), без кириллических МНН внутри "Rp.".
- Убери англоязычные дубли и двуязычные заголовки, если они попали в черновик.
- Не используй формулировку "не проводилась"; при отсутствии отклонений указывай норму.

ТЕКУЩИЙ СЛУЧАЙ:
${rawText}

ШАБЛОН (КАРКАС):
${template}

ЧЕРНОВИК ДЛЯ ИСПРАВЛЕНИЯ:
${draft}`;
}

function sanitizeProtocolChunkText(text: string): string {
  return text
    .replace(/<\/?small>/gi, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`{1,3}/g, '');
}

function normalizeNumberedSection(text: string, sectionHeaderRegex: RegExp): string {
  const lines = text.split('\n');
  let inSection = false;
  let number = 1;
  const sectionBoundaryRegex = /^[А-ЯA-ZЁ][^:\n]{0,120}:\s*$/;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (sectionHeaderRegex.test(trimmed)) {
      inSection = true;
      number = 1;
      continue;
    }

    if (!inSection) continue;

    if (sectionBoundaryRegex.test(trimmed) && !sectionHeaderRegex.test(trimmed)) {
      inSection = false;
      continue;
    }

    if (!trimmed) continue;

    const numbered = trimmed.match(/^(\d+)\.\s+/);
    if (numbered) {
      const current = Number(numbered[1]);
      number = Number.isFinite(current) ? current + 1 : number + 1;
      continue;
    }

    if (/^[-*•]\s+/.test(trimmed) || /^\(?\d+\)\s+/.test(trimmed) || /^[^\d].+/.test(trimmed)) {
      lines[i] = raw.replace(/^(\s*)(?:[-*•]\s+|\(?\d+\)\s+)?/, `$1${number}. `);
      number += 1;
    }
  }

  return lines.join('\n');
}

function postProcessProtocolOutput(text: string): string {
  let normalized = sanitizeProtocolChunkText(text);
  normalized = normalizeNumberedSection(normalized, /^Рекомендованные обследования\s*:/i);
  normalized = normalizeNumberedSection(normalized, /^Фармакотерапия\s*:/i);
  return normalized.trim();
}

function sanitizeProtocolSse(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  let streamCompleted = false;

  const sanitizeEventBlock = (block: string): { text: string; hasDone: boolean } => {
    const lines = block.split('\n');
    let hasDone = false;
    const sanitizedLines = lines.map((line) => {
      if (!line.startsWith('data: ')) return line;

      const payload = line.slice(6).trim();
      if (payload === '[DONE]') {
        hasDone = true;
        return '';
      }

      try {
        const parsed = JSON.parse(payload);
        const content = parsed?.choices?.[0]?.delta?.content;
        if (typeof content === 'string' && content.length > 0) {
          parsed.choices[0].delta.content = sanitizeProtocolChunkText(anonymizeText(content));
        }
        return `data: ${JSON.stringify(parsed)}`;
      } catch {
        return line;
      }
    });
    return {
      text: sanitizedLines.filter(Boolean).join('\n'),
      hasDone,
    };
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
            if (sanitized.text) {
              controller.enqueue(encoder.encode(`${sanitized.text}\n\n`));
            }
            if (sanitized.hasDone && !streamCompleted) {
              streamCompleted = true;
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            }
            delimiterIndex = buffer.indexOf('\n\n');
          }
        }

        if (buffer.length > 0) {
          const sanitized = sanitizeEventBlock(buffer);
          if (sanitized.text) {
            controller.enqueue(encoder.encode(sanitized.text));
          }
          if (sanitized.hasDone && !streamCompleted) {
            streamCompleted = true;
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          }
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

function buildSingleShotSse(text: string, model: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);
  const chunk = {
    id: 'protocol-strict-final',
    object: 'chat.completion.chunk',
    created: now,
    model,
    choices: [
      {
        index: 0,
        delta: { content: text },
        finish_reason: null,
      },
    ],
  };
  const doneChunk = {
    id: 'protocol-strict-final',
    object: 'chat.completion.chunk',
    created: now,
    model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: 'stop',
      },
    ],
  };

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneChunk)}\n\n`));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
}

function buildDeferredStrictProtocolSse(params: {
  initialModel: string;
  generate: () => Promise<{ text: string; model: string }>;
}): ReadableStream<Uint8Array> {
  const { initialModel, generate } = params;
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const safeEnqueue = (payload: string) => {
        if (closed) return;
        controller.enqueue(encoder.encode(payload));
      };
      const closeStream = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      // Keep-alive снижает риск 504 на прокси/браузерном ожидании при длинной генерации.
      const keepAliveInterval = setInterval(() => {
        safeEnqueue(': keep-alive\n\n');
      }, 10000);

      void (async () => {
        try {
          safeEnqueue(': strict-protocol-processing\n\n');
          const result = await generate();
          const now = Math.floor(Date.now() / 1000);
          const chunk = {
            id: 'protocol-strict-final',
            object: 'chat.completion.chunk',
            created: now,
            model: result.model || initialModel,
            choices: [
              {
                index: 0,
                delta: { content: result.text },
                finish_reason: null,
              },
            ],
          };
          const doneChunk = {
            id: 'protocol-strict-final',
            object: 'chat.completion.chunk',
            created: now,
            model: result.model || initialModel,
            choices: [
              {
                index: 0,
                delta: {},
                finish_reason: 'stop',
              },
            ],
          };

          safeEnqueue(`data: ${JSON.stringify(chunk)}\n\n`);
          safeEnqueue(`data: ${JSON.stringify(doneChunk)}\n\n`);
          safeEnqueue('data: [DONE]\n\n');
        } catch (error: any) {
          const message = typeof error?.message === 'string' && error.message.trim()
            ? error.message
            : 'Ошибка генерации протокола';
          safeEnqueue(`data: ${JSON.stringify({ error: { message } })}\n\n`);
          safeEnqueue('data: [DONE]\n\n');
        } finally {
          clearInterval(keepAliveInterval);
          closeStream();
        }
      })();
    },
  });
}

const STRICT_PROTOCOL_BANNED_PATTERNS: RegExp[] = [
  /официальный заголовок/i,
  /official header/i,
  /медицинский консультативный отчет/i,
  /verification block/i,
  /верифицировано врачом/i,
  /clinical hypotheses/i,
  /differential diagnosis/i,
  /заключение\s*\/\s*conclusion/i,
  /🚨/,
];

const PROTOCOL_GPT52_MODEL = 'openai/gpt-5.4';

function normalizeAnchorForSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[*`_#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTemplateAnchors(template: string): string[] {
  return template
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const normalized = normalizeAnchorForSearch(line);
      return normalized.includes(':') || normalized.includes('：');
    })
    .slice(0, 10);
}

function trimToTemplateStart(output: string, template: string): string {
  const anchors = extractTemplateAnchors(template);
  if (anchors.length === 0) return output.trim();

  const firstAnchor = normalizeAnchorForSearch(anchors[0]);
  const outputLower = output.toLowerCase();
  const rawAnchorPos = outputLower.indexOf(firstAnchor);
  if (rawAnchorPos > 0) {
    return output.slice(rawAnchorPos).trimStart();
  }
  return output.trim();
}

function isStructuredProtocolOutputValid(output: string, template: string): boolean {
  const normalizedOutput = normalizeAnchorForSearch(output);

  for (const pattern of STRICT_PROTOCOL_BANNED_PATTERNS) {
    if (pattern.test(output)) return false;
  }

  const anchors = extractTemplateAnchors(template).map(normalizeAnchorForSearch);
  if (anchors.length === 0) return true;

  if (!normalizedOutput.startsWith(anchors[0])) {
    return false;
  }

  let prevPos = -1;
  for (const anchor of anchors) {
    const pos = normalizedOutput.indexOf(anchor, prevPos + 1);
    if (pos === -1 || pos < prevPos) return false;
    prevPos = pos;
  }

  return true;
}

async function enforceStrictTemplateOutput(params: {
  rawText: string;
  template: string;
  draft: string;
  primaryModel: string;
  primaryPrompt: string;
  useFastStrict: boolean;
  onUsage?: (usage: TextRequestUsage) => void;
}): Promise<{ text: string; model: string }> {
  const { rawText, template, draft, primaryModel, primaryPrompt, useFastStrict, onUsage } = params;
  let bestEffortText = trimToTemplateStart(draft, template);

  const primaryCorrectionPrompt = buildProtocolCorrectionPrompt({
    rawText,
    template,
    draft,
  });
  try {
    let correctedResult = await withTimeout(
      sendTextRequestWithUsage(primaryCorrectionPrompt, [], primaryModel),
      STRICT_CORRECTION_TIMEOUT_MS,
      'Strict correction timeout'
    );
    onUsage?.(correctedResult.usage);
    let corrected = correctedResult.content;
    corrected = trimToTemplateStart(corrected, template);
    bestEffortText = corrected;
    if (isStructuredProtocolOutputValid(corrected, template)) {
      return { text: corrected, model: primaryModel };
    }

    // Fast strict: не запускаем дорогой повторный полный цикл, отдаем лучший валидный результат.
    if (useFastStrict) {
      return { text: corrected, model: primaryModel };
    }
  } catch (error: any) {
    if (useFastStrict) {
      console.warn(`[PROTOCOL] Fast strict correction timeout/error on ${primaryModel}: ${String(error?.message || error)}`);
      return { text: trimToTemplateStart(draft, template), model: primaryModel };
    }
  }

  const fallbackModel = MODELS.SONNET;
  console.warn(`[PROTOCOL] Strict template guard: output invalid on ${primaryModel}, retry on ${fallbackModel}`);
  try {
    const fallbackDraftResult = await withTimeout(
      sendTextRequestWithUsage(primaryPrompt, [], fallbackModel),
      STRICT_CORRECTION_TIMEOUT_MS,
      'Strict fallback draft timeout'
    );
    onUsage?.(fallbackDraftResult.usage);
    const fallbackCorrectionPrompt = buildProtocolCorrectionPrompt({
      rawText,
      template,
      draft: fallbackDraftResult.content,
    });
    let fallbackCorrectedResult = await withTimeout(
      sendTextRequestWithUsage(fallbackCorrectionPrompt, [], fallbackModel),
      STRICT_CORRECTION_TIMEOUT_MS,
      'Strict fallback correction timeout'
    );
    onUsage?.(fallbackCorrectedResult.usage);
    let fallbackCorrected = fallbackCorrectedResult.content;
    fallbackCorrected = trimToTemplateStart(fallbackCorrected, template);
    return { text: fallbackCorrected, model: fallbackModel };
  } catch (error: any) {
    console.warn(`[PROTOCOL] Strict fallback timeout/error on ${fallbackModel}: ${String(error?.message || error)}`);
    return { text: bestEffortText, model: primaryModel };
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email || null;
    const guestKey = userEmail ? null : getRateLimitKey(request);

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
      strictTemplateMode = true,
      speedProfile = 'standard'
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

    const estimatedCost = estimateProtocolCost(rawText.length, isStrictTemplateMode);
    const actualUsage: TextRequestUsage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      total_cost: 0,
    };
    const addUsage = (usage?: TextRequestUsage) => {
      if (!usage) return;
      actualUsage.prompt_tokens += Number(usage.prompt_tokens || 0);
      actualUsage.completion_tokens += Number(usage.completion_tokens || 0);
      actualUsage.total_tokens += Number(usage.total_tokens || 0);
      actualUsage.total_cost += Number(usage.total_cost || 0);
    };
    const billing = userEmail
      ? await checkAndDeductBalance(userEmail, estimatedCost, 'Protocol generation', {
          templateId: templateId || null,
          model,
          useStreaming,
          strictTemplateMode: isStrictTemplateMode,
          source: 'protocol_generation',
        })
      : await checkAndDeductGuestBalance(guestKey!, estimatedCost, 'Guest trial: protocol generation', {
          templateId: templateId || null,
          model,
          useStreaming,
          strictTemplateMode: isStrictTemplateMode,
          source: 'protocol_generation',
        });
    if (!billing.allowed) {
      return NextResponse.json(
        { success: false, error: billing.error || 'Недостаточно единиц для генерации протокола' },
        { status: 402 }
      );
    }

    // Добавляем специфическую инструкцию специалиста в промпт
    const specialistDirective = universalPrompt
      ? `СПЕЦИФИЧЕСКАЯ ИНСТРУКЦИЯ ДЛЯ ПРОФИЛЯ (${specialistName}): ${universalPrompt}\n\n`
      : '';
    const isEcgFunctionalConclusion = templateId === 'ecg-functional-conclusion';
    const forceFastProfile = speedProfile === 'fast';
    const useFastStrict =
      (isStrictTemplateMode || forceFastProfile) &&
      !isEcgFunctionalConclusion &&
      (
        forceFastProfile ||
        rawText.length >= STRICT_FAST_RAWTEXT_THRESHOLD ||
        safeTemplate.length >= STRICT_FAST_TEMPLATE_THRESHOLD
      );
    const safeRagExamples = Array.isArray(ragExamples)
      ? ragExamples
          .map((chunk: unknown) => anonymizeText(String(chunk ?? '')).trim())
          .filter(Boolean)
          .slice(0, useFastStrict ? 4 : 8)
      : [];
    const ragDirective = safeRagExamples.length > 0
      ? `ПРИМЕРЫ ИЗ ПЕРСОНАЛЬНОЙ RAG-БИБЛИОТЕКИ (это эталон ФОРМЫ и порядка заполнения; медицинские факты бери ТОЛЬКО из текущего случая):
${safeRagExamples.map((chunk: string, index: number) => `--- ОБРАЗЕЦ #${index + 1} ---\n${chunk}`).join('\n\n')}

`
      : '';
    const hasDiagnosisSection = /(диагноз|заключени|мкб|diagnosis|assessment)/i.test(safeTemplate);
    const hasTreatmentSection = /(лечени|терап|рекомендац|назначени|plan|treatment)/i.test(safeTemplate);
    const templateHasMarkdownTable = /\|.+\|\s*\n\|[\s:-]+\|/m.test(safeTemplate);
    const requiredClinicalBlockDirective =
      !isEcgFunctionalConclusion && (!hasDiagnosisSection || !hasTreatmentSection)
        ? `\n12. Если в шаблоне нет явных разделов для диагноза/лечения, добавь в КОНЦЕ два коротких раздела: "Диагностическое заключение" и "План лечения и рекомендации".`
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
- Обязательно заполни блок лечения/рекомендаций в рамках структуры шаблона (или добавь по правилу п.12).`
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
10. Запрещено добавлять технические/служебные секции вне шаблона: "0. ...", "Official Header", "Verification Block", "Conclusion", "Differential Diagnosis" (если они не предусмотрены самим шаблоном).
11. Запрещено дублировать секции на английском языке. Вывод только на русском.
12. Не используй Markdown/HTML-артефакты в тексте: "**", "__", "#", тройные обратные кавычки, "<small>", "</small>".
13. В "Рекомендованные обследования" и в "Фармакотерапия" используй только нумерацию "1.", "2.", ... (без "-", "*", "•").
14. В "Фармакотерапия/Рецепты" запрещены пустые бланки: каждый пункт должен содержать конкретный препарат (МНН + бренд + генерик) и схему дозирования.
15. Если в шаблоне есть рецептурные строки (Rp.), заполняй их на латинском по справочнику (уровень Vidal/РЛС); не оставляй кириллические МНН в строке "Rp.".
${requiredClinicalBlockDirective}
${strictTemplateDirective}
${tableDirective}
${diagnosisDirective}
${refreshFromCurrentCaseDirective}
${clinicalDefaultsDirective}
${clinicalReasoningDirective}
${evidencePriorityDirective}

Стиль: строго профессиональный, клинически и технически точный. Язык: русский.`;

    const allowGrok45Protocol = process.env.ALLOW_GROK45_PROTOCOL !== 'false';
    const effectiveModel = model === 'grok45' && !allowGrok45Protocol ? 'sonnet' : model;
    const MODEL = effectiveModel === 'opus'
      ? MODELS.OPUS_VALIDATED
      : effectiveModel === 'gpt52'
        ? PROTOCOL_GPT52_MODEL
        : effectiveModel === 'grok45'
          ? MODELS.GROK_4_5
          : effectiveModel === 'gemini'
            ? MODELS.GEMINI_3_FLASH
            : MODELS.SONNET;
    const protocolFallbackModel = effectiveModel === 'grok45' ? MODELS.SONNET : null;
    
    // В strict-режиме выполняем двухшаговую генерацию (черновик -> коррекция),
    // даже если клиент запросил streaming. Иначе модель может "уезжать" в свободный формат.
    if (useStreaming && isStrictTemplateMode && !isEcgFunctionalConclusion) {
      const deferredStrictStream = buildDeferredStrictProtocolSse({
        initialModel: MODEL,
        generate: async () => {
          let resolvedModel = MODEL;
          let draft: string;
          try {
            draft = await sendTextRequest(prompt, [], MODEL);
          } catch (primaryError) {
            if (!protocolFallbackModel) throw primaryError;
            console.warn(`[PROTOCOL] Primary model ${MODEL} failed, fallback to ${protocolFallbackModel}`);
            resolvedModel = protocolFallbackModel;
            draft = await sendTextRequest(prompt, [], resolvedModel);
          }

          const strictResult = await enforceStrictTemplateOutput({
            rawText,
            template: safeTemplate,
            draft,
            primaryModel: resolvedModel,
            primaryPrompt: prompt,
            useFastStrict,
          });
          return {
            text: postProcessProtocolOutput(anonymizeText(strictResult.text)),
            model: strictResult.model,
          };
        },
      });

      return new Response(deferredStrictStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Resolved-Model': MODEL,
        },
      });
    }

    if (useStreaming) {
      let resolvedModel = MODEL;
      let stream: ReadableStream<Uint8Array>;
      try {
        stream = await sendTextRequestStreaming(prompt, [], MODEL);
      } catch (primaryError) {
        if (!protocolFallbackModel) throw primaryError;
        console.warn(`[PROTOCOL] Primary model ${MODEL} failed, fallback to ${protocolFallbackModel}`);
        resolvedModel = protocolFallbackModel;
        stream = await sendTextRequestStreaming(prompt, [], resolvedModel);
      }
      const sanitizedStream = sanitizeProtocolSse(stream);
      return new Response(sanitizedStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Resolved-Model': resolvedModel,
        },
      });
    }

    let resolvedModel = MODEL;
    let result: string;
    try {
      const initialResult = await sendTextRequestWithUsage(prompt, [], MODEL);
      addUsage(initialResult.usage);
      result = initialResult.content;
      resolvedModel = initialResult.modelUsed || resolvedModel;
    } catch (primaryError) {
      if (!protocolFallbackModel) throw primaryError;
      console.warn(`[PROTOCOL] Primary model ${MODEL} failed, fallback to ${protocolFallbackModel}`);
      resolvedModel = protocolFallbackModel;
      const fallbackResult = await sendTextRequestWithUsage(prompt, [], resolvedModel);
      addUsage(fallbackResult.usage);
      result = fallbackResult.content;
      resolvedModel = fallbackResult.modelUsed || resolvedModel;
    }
    if (!isEcgFunctionalConclusion && isStrictTemplateMode) {
      const strictResult = await enforceStrictTemplateOutput({
        rawText,
        template: safeTemplate,
        draft: result,
        primaryModel: resolvedModel,
        primaryPrompt: prompt,
        useFastStrict,
        onUsage: addUsage,
      });
      result = strictResult.text;
      resolvedModel = strictResult.model;
    }

    result = postProcessProtocolOutput(anonymizeText(result));
    return NextResponse.json({
      success: true,
      protocol: result,
      resolvedModel,
      usage: actualUsage.total_tokens > 0 ? actualUsage : undefined,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Ошибка генерации протокола' }, { status: 500 });
  }
}
