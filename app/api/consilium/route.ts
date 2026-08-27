import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { checkRateLimit, RATE_LIMIT_CONSILIUM, getRateLimitKey } from '@/lib/rate-limiter';
import { checkAndDeductBalance, isVipEmail } from '@/lib/server-billing';
import { anonymizeText } from '@/lib/anonymization';
import { ensureVisionSupportedImage, compressImageBuffer } from '@/lib/server-image-processing';
import { safeErrorMessage } from '@/lib/safe-error';
import { safeError } from '@/lib/logger';
import { BeforeDebateEscalationHook, describeImagesAsFindings, runConsilium } from '@/lib/diagnostics/orchestrator';
import { saveConsiliumAuditTrail } from '@/lib/diagnostics/audit';
import { CaseInput, ConsiliumProgressEvent } from '@/lib/diagnostics/types';
import { getRequestLocale } from '@/lib/i18n/server';
import { getDiagnosticsMessages, type DiagnosticsMessages } from '@/lib/i18n/diagnostics';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const MAX_CONSILIUM_FILES = 6;
const MAX_CONSILIUM_TOTAL_BYTES = 24 * 1024 * 1024;

/**
 * Двухэтапный биллинг гибридной архитектуры (AMSC-раунд 0 + селективная эскалация
 * в MAI-DxO дебаты):
 *   1) Сразу списывается только стоимость дешёвого раунда 0 (роутинг специальностей +
 *      их параллельные мнения + лёгкий синтез при совпадении мнений) — это и есть
 *      типичная стоимость простого кейса, где эскалация не требуется.
 *   2) Непосредственно перед запуском дорогого цикла дебатов (только если специальности
 *      разошлись или скептик поймал red flag) отдельно проверяется и резервируется
 *      баланс на сам цикл. Если баланса не хватает — консилиум не падает с ошибкой,
 *      а отдаёт результат раунда 0 с пометкой на ручной разбор врачом.
 * Оба значения — оценки с запасом; после завершения реальная стоимость (result.totalCostUsd)
 * сверяется со списанным через reconcileConsiliumCost (либо доплата, либо возврат разницы).
 */
function estimateAmscRound0Cost(params: { hasImages: boolean; imageCount: number; textLength: number }): number {
  const routingAndOpinionsCost = 16; // роутер + до 4 мнений специальностей на Sonnet
  const synthesisReserve = 3; // лёгкий синтез консенсуса, если мнения совпали
  const imagePreprocessCost = params.hasImages ? 1.5 + Math.max(0, params.imageCount - 1) * 0.5 : 0;
  const textFactor = Math.min(2.0, params.textLength / 2000);
  return Number((routingAndOpinionsCost + synthesisReserve + imagePreprocessCost + textFactor).toFixed(2));
}

function estimateDebateEscalationReserve(): number {
  // Калибровано по реальному прогону (2 полных раунда дебатов, Dr. Hypothesis/Challenger/
  // Checklist на Fable 5): фактическая стоимость полного цикла ~114-116 у.е. сверх раунда 0.
  // Запас на вариативность кейсов.
  return 135;
}

const UNITS_PER_USD = 100; // Тот же множитель, что и в lib/cost-calculator.ts (PRICE_MULTIPLIER)

/**
 * Сверка предоплаты с фактической стоимостью после завершения консилиума:
 * если реальная стоимость выше уже списанного — доплата, если ниже (типичный
 * случай для простых кейсов без эскалации) — возврат разницы врачу.
 * checkAndDeductBalance поддерживает отрицательные суммы как возврат, поэтому
 * оба случая обрабатываются одним вызовом. Не блокируем выдачу результата
 * врачу, если операция не проходит — работа уже выполнена.
 */
async function reconcileConsiliumCost(email: string, alreadyChargedUnits: number, actualCostUsd: number): Promise<void> {
  if (isVipEmail(email)) return;
  const actualUnits = actualCostUsd * UNITS_PER_USD;
  const differenceUnits = Number((actualUnits - alreadyChargedUnits).toFixed(2));
  if (Math.abs(differenceUnits) < 0.01) return;

  try {
    const operation = differenceUnits > 0 ? 'Consilium (post-usage top-up)' : 'Consilium (unused prepaid units refund)';
    await checkAndDeductBalance(email, differenceUnits, operation, { alreadyChargedUnits, actualUnits });
  } catch (error) {
    safeError('[CONSILIUM API] Failed to reconcile actual cost:', error);
  }
}

async function ensureFileGlobalForFormData(): Promise<void> {
  if (typeof File !== 'undefined') return;
  try {
    const { File: BufferFile } = await import('buffer');
    if (typeof BufferFile !== 'undefined') {
      (globalThis as any).File = BufferFile;
    }
  } catch {
    // Если полифилл недоступен — оставляем поведение по умолчанию.
  }
}

function sseEvent(event: ConsiliumProgressEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function localizeConsiliumStageMessage(message: string, i18n: DiagnosticsMessages): string {
  if (message === 'Selecting specialties for this case...') return i18n.stageSelectingSpecialties;
  if (message === 'Specialty opinions converged, building consensus...') return i18n.stageBuildingConsensus;
  if (message === 'Processing attached images...') return i18n.stageProcessingImages;
  if (message === 'Image processing complete, starting Consilium...') return i18n.stageImageProcessingDone;
  return message;
}

export async function POST(request: NextRequest) {
  const locale = await getRequestLocale();
  const i18n = getDiagnosticsMessages(locale);
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: i18n.consiliumAuthRequired }, { status: 401 });
  }

  const rlKey = getRateLimitKey(request, session.user.email);
  const rl = checkRateLimit(rlKey, RATE_LIMIT_CONSILIUM);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: i18n.consiliumRateLimitExceeded },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  try {
    await ensureFileGlobalForFormData();
    const formData = await request.formData();

    const freeTextInputRaw = (formData.get('message') as string) || '';
    const freeTextInput = anonymizeText(freeTextInputRaw);
    const patientId = ((formData.get('patientId') as string) || '').trim() || 'not specified';

    const fileEntries = formData.getAll('files');
    const isFileLike = (value: unknown): value is File =>
      !!value &&
      typeof value === 'object' &&
      typeof (value as any).name === 'string' &&
      typeof (value as any).size === 'number' &&
      typeof (value as any).arrayBuffer === 'function';
    const files = fileEntries.filter(isFileLike).filter((f) => f.size > 0);

    if (!freeTextInput.trim() && files.length === 0) {
      return NextResponse.json({ success: false, error: i18n.consiliumCaseRequired }, { status: 400 });
    }

    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    if (files.length > MAX_CONSILIUM_FILES || totalBytes > MAX_CONSILIUM_TOTAL_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many files. Maximum: ${MAX_CONSILIUM_FILES} files and ${(MAX_CONSILIUM_TOTAL_BYTES / (1024 * 1024)).toFixed(0)} MB total.`,
        },
        { status: 413 }
      );
    }

    const imagesBase64: string[] = [];
    const mimeTypes: string[] = [];
    const attachedDocuments: string[] = [];

    for (const file of files) {
      const isImage = file.type.startsWith('image/');
      const isText = file.type.startsWith('text/') || /\.(txt|md)$/i.test(file.name);

      if (isImage) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const supported = await ensureVisionSupportedImage(buffer, file.type);
        const compressed = await compressImageBuffer(supported.buffer, supported.mimeType, 4.0);
        imagesBase64.push(compressed.buffer.toString('base64'));
        mimeTypes.push(compressed.mimeType);
      } else if (isText) {
        const text = anonymizeText(await file.text());
        attachedDocuments.push(`[${file.name}]\n${text}`);
      } else {
        attachedDocuments.push(
          `[${file.name}] - ${i18n.consiliumUnsupportedFormat}`
        );
      }
    }

    const round0Cost = estimateAmscRound0Cost({
      hasImages: imagesBase64.length > 0,
      imageCount: imagesBase64.length,
      textLength: freeTextInput.length,
    });
    const billing = await checkAndDeductBalance(session.user.email, round0Cost, 'Consilium (round 0: specialty opinions)', {
      filesCount: files.length,
      hasImages: imagesBase64.length > 0,
    });
    if (!billing.allowed) {
      return NextResponse.json({ success: false, error: billing.error || i18n.consiliumInsufficientBalanceStart }, { status: 402 });
    }

    const caseId = randomUUID();
    const doctorEmail = session.user.email;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        const emit = (event: ConsiliumProgressEvent) => {
          const localizedEvent =
            event.type === 'stage' && event.message
              ? { ...event, message: localizeConsiliumStageMessage(event.message, i18n) }
              : event;
          try {
            controller.enqueue(encoder.encode(sseEvent(localizedEvent)));
          } catch {
            // Поток уже мог закрыться на стороне клиента — игнорируем.
          }
        };

        try {
          let preprocessingUsage: { promptTokens: number; completionTokens: number; costUsd: number } | undefined;
          let imageFindingsText = '';

          if (imagesBase64.length > 0) {
            emit({ type: 'stage', message: 'Processing attached images...' });
            const preprocessed = await describeImagesAsFindings(imagesBase64, mimeTypes);
            imageFindingsText = preprocessed.text;
            preprocessingUsage = {
              promptTokens: preprocessed.promptTokens,
              completionTokens: preprocessed.completionTokens,
              costUsd: preprocessed.costUsd,
            };
            emit({ type: 'stage', message: 'Image processing complete, starting Consilium...' });
          }

          const caseInput: CaseInput = {
            patientId,
            freeTextInput: [freeTextInput, imageFindingsText ? `### FINDINGS FROM ATTACHED IMAGES\n${imageFindingsText}` : '']
              .filter(Boolean)
              .join('\n\n'),
            attachedDocuments,
          };

          const debateEscalationReserve = estimateDebateEscalationReserve();
          let debateBillingCharged = false;
          const onBeforeDebateEscalation: BeforeDebateEscalationHook = async () => {
            if (isVipEmail(doctorEmail)) return { allowed: true };
            const escalationBilling = await checkAndDeductBalance(
              doctorEmail,
              debateEscalationReserve,
              'Consilium (escalation to debate cycle)',
              { round0Cost }
            );
            if (!escalationBilling.allowed) {
              return {
                allowed: false,
                denialReason: i18n.consiliumInsufficientBalanceDebate,
              };
            }
            debateBillingCharged = true;
            return { allowed: true };
          };

          const result = await runConsilium(caseInput, emit, preprocessingUsage, onBeforeDebateEscalation);

          await saveConsiliumAuditTrail({ patientId, caseId, doctorEmail, result });
          const alreadyChargedUnits = round0Cost + (debateBillingCharged ? debateEscalationReserve : 0);
          await reconcileConsiliumCost(doctorEmail, alreadyChargedUnits, result.totalCostUsd);

          emit({ type: 'final', result });
        } catch (error: any) {
          safeError('[CONSILIUM API] Execution error:', error);
          emit({ type: 'error', message: safeErrorMessage(error, i18n.consiliumExecutionFailed) });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: any) {
    safeError('[CONSILIUM API] Request processing error:', error);
    return NextResponse.json({ success: false, error: safeErrorMessage(error, i18n.consiliumRequestFailed) }, { status: 500 });
  }
}
