import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { anonymizeText } from "@/lib/anonymization";
import { checkAndDeductBalance, checkAndDeductGuestBalance, refundChargedBalanceOnFailure } from '@/lib/server-billing';
import { getRateLimitKey } from '@/lib/rate-limiter';
import { postLlmChatCompletionsWithFallback } from '@/lib/llm-provider';
import { getForcedLanguageInstructionForRequest } from '@/lib/i18n/llm-response-language';

// Максимальное время выполнения запроса (5 минут)
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Примерные тарифы OpenRouter за 1000 токенов в условных единицах (для отображения)
const PRICE_UNITS_PER_1K_TOKENS_SONNET = 2.0; // 2 единицы за 1000 токенов Claude Sonnet 5
const PRICE_UNITS_PER_1K_TOKENS_GEMINI = 0.4; // 0.4 единицы за 1000 токенов Gemini Flash
const MIN_CONSULT_COST = 2;
const MAX_CONSULT_COST = 20;
const GPT_54_MODEL = 'openai/gpt-5.6-sol';
const OPUS_FALLBACK_MODEL = 'anthropic/claude-opus-5.5';

function shouldFallbackFromGpt54(status: number, errorText: string): boolean {
  const normalized = errorText.toLowerCase();
  return (
    status === 401 ||
    status === 403 ||
    normalized.includes('permission_denied') ||
    normalized.includes('provider returned error') ||
    normalized.includes('azure')
  );
}

function normalizeOpenRouterError(status: number, errorText: string): string {
  const text = (errorText || '').trim();
  try {
    const parsed = JSON.parse(text);
    const nestedMessage = parsed?.error?.metadata?.raw?.error?.message;
    const directMessage = parsed?.error?.message;
    const message = nestedMessage || directMessage;
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  } catch {
    // keep raw text fallback
  }

  if (status === 401 || status === 403) {
    return 'Выбранная модель временно недоступна у провайдера. Попробуйте повторить запрос или выбрать Opus.';
  }
  return text.substring(0, 400) || `HTTP ${status}`;
}

function estimateConsultCost(params: {
  mode: string;
  model: string;
  analysisLength: number;
  hasHistory: boolean;
  filesCount: number;
}): number {
  const baseByMode = params.mode === 'fast' ? 2.0 : 4.0;
  const modelFactor = params.model === 'gpt52' ? 1.15 : 1;
  const historyFactor = params.hasHistory ? 1.25 : 1;
  const filesExtra = Math.min(3, params.filesCount * 0.6);
  const sizeExtra = Math.min(2.5, params.analysisLength / 15000);
  const estimated = (baseByMode * modelFactor * historyFactor) + filesExtra + sizeExtra;
  return Number(Math.min(MAX_CONSULT_COST, Math.max(MIN_CONSULT_COST, estimated)).toFixed(2));
}

/**
 * ЭТАП 2. Дополнительное заключение врача-генетика
 * На основе уже выполненного извлечения, клинического контекста и вопроса пользователя.
 * Поддерживается два режима:
 *  - fast      → Gemini (дешевле, короче)
 *  - professor → Claude Sonnet 5 (подробное экспертное заключение)
 */
export async function POST(request: NextRequest) {
  let billedAmount = 0;
  let billingEmail: string | null = null;
  let billingGuestKey: string | null = null;
  try {
    const responseLanguageInstruction = await getForcedLanguageInstructionForRequest();

    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email || null;
    const guestKey = userEmail ? null : getRateLimitKey(request);
    billingEmail = userEmail;
    billingGuestKey = guestKey;

    const body = await request.json();
    const {
      analysis: rawAnalysis = '',
      clinicalContext: rawClinicalContext = '',
      question: rawQuestion = '',
      mode = 'professor',
      model = 'sonnet', // Добавляем поддержку выбора модели
      useStreaming = true,
      history = [],
      isFollowUp = false,
      files = [],
    } = body || {};

    const estimatedCost = estimateConsultCost({
      mode: String(mode || 'professor'),
      model: String(model || 'sonnet'),
      analysisLength: typeof rawAnalysis === 'string' ? rawAnalysis.length : 0,
      hasHistory: Array.isArray(history) && history.length > 0,
      filesCount: Array.isArray(files) ? files.length : 0,
    });
    const billing = userEmail
      ? await checkAndDeductBalance(userEmail, estimatedCost, 'Genetic consult', {
          mode,
          model,
          isFollowUp,
          historyLength: Array.isArray(history) ? history.length : 0,
          filesCount: Array.isArray(files) ? files.length : 0,
          source: 'genetic_consult',
        })
      : await checkAndDeductGuestBalance(guestKey!, estimatedCost, 'Guest trial: genetic consult', {
          mode,
          model,
          isFollowUp,
          historyLength: Array.isArray(history) ? history.length : 0,
          filesCount: Array.isArray(files) ? files.length : 0,
          source: 'genetic_consult',
        });
    if (!billing.allowed) {
      return NextResponse.json(
        { success: false, error: billing.error || 'Недостаточно единиц для генетической консультации' },
        { status: 402 }
      );
    }
    billedAmount = estimatedCost;

    // Текстовая анонимизация применяется всегда (как во всех остальных модулях),
    // а не только при включённом чекбоксе "Разовый анонимный анализ".
    const analysis = anonymizeText(rawAnalysis);
    const clinicalContext = anonymizeText(rawClinicalContext);
    const question = anonymizeText(rawQuestion);

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
          ? `PATIENT CLINICAL CONTEXT:\n${clinicalContext.trim()}\n\n`
          : '';
      
      const systemPrompt = `${responseLanguageInstruction}

${contextBlock}SOURCE GENETIC ANALYSIS DATA:

${analysis}

You are a senior clinical geneticist. You already produced an expert report and now continue a physician-to-physician dialogue.

RULES:
1. Do not regenerate the full report structure (overview, plan, etc.) unless explicitly requested.
2. Answer the latest question directly, with concise and clinically actionable points.
3. Use the prior analysis and the full dialogue history as context.
4. Avoid filler intros. Start with substance immediately.`;

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
          const filesInfo = files.map((f: any) => `File: ${f.name} (${f.type})`).join('\n');
          userContent.push({
            type: 'text',
            text: `\n\nATTACHED FILES:\n${filesInfo}\n\nAnalyze these files in the context of the genetic case and answer the question above.`,
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
          ? `PATIENT CLINICAL CONTEXT:\n${clinicalContext.trim()}\n\n`
          : '';

      const questionBlock =
        question && question.trim().length > 0
          ? `ADDITIONAL PHYSICIAN QUESTION:\n${question.trim()}\n\n`
          : 'Prepare a final clinical genetics report for the medical record and management plan.\n\n';

      // Добавляем информацию о файлах если есть
      const filesBlock = files.length > 0
        ? `ATTACHED ADDITIONAL FILES:\n${files.map((f: any) => `- ${f.name} (${f.type})`).join('\n')}\n\nAnalyze these files in the context of this genetic case.\n\n`
        : '';

      const userPrompt = `${contextBlock}${questionBlock}${filesBlock}SOURCE GENETIC ANALYSIS DATA / PREVIOUS CONCLUSION:

${analysis}

TASK:
- Do not copy the source verbatim. Produce a clear, structured clinical genetics conclusion for physician use.
- Focus on likely pathogenic/pathogenic variants, pharmacogenetics, nutrigenomics, disease-risk signals, and preventive strategy.

OUTPUT STRUCTURE:
1. Brief clinical overview of the genetic profile (2-3 sentences).
2. Key pathogenic/likely pathogenic variants (ACMG class, gene, rsID, clinical significance).
3. Pharmacogenetics (specific drugs, dosing constraints, CPIC/PharmGKB references when relevant).
4. Nutrigenomics and metabolism (vitamins, macronutrients, inflammation, antioxidant systems).
5. Personalized management recommendations (step-by-step plan).
6. Screening and family counseling recommendations (if relevant).

Write physician-to-physician: professional, precise, clinically actionable, no fluff.`;

      messages.push({
        role: 'system',
        content:
          mode === 'fast'
            ? `${responseLanguageInstruction}\nYou are a clinical geneticist. Provide a concise but clinically useful physician-facing conclusion based on SNP data and context.`
            : `${responseLanguageInstruction}\nYou are a senior clinical geneticist. Build a clinically actionable expert conclusion for a physician colleague using genetic data and clinical context.`,
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
      model === 'gpt52' ? GPT_54_MODEL :
      mode === 'fast' ? 'google/gemini-3.8-flash' : 'anthropic/claude-opus-5.5';

    const runOpenRouter = async (targetModel: string) => {
      const payload: any = {
        model: targetModel,
        messages: messages,
        max_tokens: 12000, // Оптимизировано: генетическая консультация
        temperature: 0.25,
        stream: useStreaming,
        stream_options: useStreaming ? { include_usage: true } : undefined,
      };

      return postLlmChatCompletionsWithFallback(payload, {
        headers: {
          'HTTP-Referer': 'https://doctor-opus.ru',
          'X-Title': 'Doctor Opus',
        },
      });
    };

    let modelUsed = consultModel;
    let response = await runOpenRouter(modelUsed);

    if (!response.ok && modelUsed === GPT_54_MODEL) {
      const gptErrorText = await response.text();
      if (shouldFallbackFromGpt54(response.status, gptErrorText)) {
        console.warn(`⚠️ [GENETIC CONSULT] ${GPT_54_MODEL} недоступна, переключаемся на ${OPUS_FALLBACK_MODEL}`);
        modelUsed = OPUS_FALLBACK_MODEL;
        response = await runOpenRouter(modelUsed);
      } else {
        return NextResponse.json(
          {
            success: false,
            error: `Ошибка OpenRouter: ${normalizeOpenRouterError(response.status, gptErrorText)}`,
          },
          { status: response.status }
        );
      }
    }

    // Режим streaming: проксируем поток OpenRouter как SSE
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          success: false,
          error: `Ошибка OpenRouter: ${normalizeOpenRouterError(response.status, errorText)}`,
        },
        { status: response.status }
      );
    }

    if (useStreaming && response.body) {
      const readableStream = new ReadableStream({
        async start(controller) {
          const reader = response.body!.getReader();
          const encoder = new TextEncoder();
          let heartbeat: any;

          try {
            // 1. Padding
            const padding = ': ' + ' '.repeat(2048) + '\n\n';
            controller.enqueue(encoder.encode(padding));

            // 2. Heartbeat СРАЗУ
            heartbeat = setInterval(() => {
              try {
                controller.enqueue(encoder.encode(': keep-alive heartbeat\n\n'));
              } catch (e) {
                if (heartbeat) clearInterval(heartbeat);
              }
            }, 5000);

            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                break;
              }
              controller.enqueue(value);
            }
          } catch (err) {
            controller.error(err);
          } finally {
            if (heartbeat) clearInterval(heartbeat);
            reader.releaseLock();
            controller.close();
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

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || '';

    const tokensUsed: number = data.usage?.total_tokens || 0;
    const inputTokens: number = data.usage?.prompt_tokens || 0;
    const outputTokens: number = data.usage?.completion_tokens || 0;

    const pricePer1k =
      modelUsed.startsWith('google/gemini')
        ? PRICE_UNITS_PER_1K_TOKENS_GEMINI
        : PRICE_UNITS_PER_1K_TOKENS_SONNET;

    const approxCostUnits = Number(((tokensUsed / 1000) * pricePer1k).toFixed(2));

    console.log(
      `✅ [GENETIC CONSULT] Заключение готово (${modelUsed}). Токенов: ${tokensUsed} (in=${inputTokens}, out=${outputTokens}), ~${approxCostUnits} ед.`
    );

    return NextResponse.json({
      success: true,
      result,
      tokensUsed,
      inputTokens,
      outputTokens,
      approxCostUnits,
      model: modelUsed,
      mode,
    });
  } catch (error: any) {
    console.error('❌ [GENETIC CONSULT] Ошибка:', error);
    if (billedAmount > 0) {
      const refundResult = await refundChargedBalanceOnFailure({
        email: billingEmail,
        guestKey: billingGuestKey,
        amount: billedAmount,
        operation: 'Genetic consult (auto refund on failure)',
        metadata: { source: 'genetic_consult', billedAmount },
      });
      if (!refundResult.success) {
        console.error('❌ [GENETIC CONSULT] Не удалось выполнить авто-возврат:', refundResult.error);
      }
    }
    return NextResponse.json(
      {
        success: false,
        error: 'Ошибка генетической консультации',
      },
      { status: 500 }
    );
  }
}


