import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage, analyzeImageFast, extractImageJSON, analyzeImageOpusTwoStage, analyzeMultipleImages, analyzeMultipleImagesTwoStage, MODELS } from '@/lib/openrouter';
import { 
  analyzeImageStreaming, 
  analyzeImageFastStreaming,
  analyzeImageWithJSONStreaming, 
  analyzeImageOpusTwoStageStreaming, 
  analyzeMultipleImagesStreaming,
  analyzeMultipleImagesOpusTwoStageStreaming,
  analyzeMultipleImagesWithJSONStreaming
} from '@/lib/openrouter-streaming';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { anonymizeText } from "@/lib/anonymization";
import { anonymizeImageBuffer, compressImageBuffer, ensureVisionSupportedImage, enhanceMedicalImageBuffer } from "@/lib/server-image-processing";
import { extractDicomMetadata, formatDicomMetadataForAI } from '@/lib/dicom-service';
import { processDicomJs } from "@/lib/dicom-processor";
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { checkRateLimit, RATE_LIMIT_ANALYSIS, getRateLimitKey } from '@/lib/rate-limiter';
import { checkAndDeductBalance, checkAndDeductGuestBalance, getAnalysisCost, refundChargedBalanceOnFailure } from '@/lib/server-billing';

const execPromise = promisify(exec);

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Лимит размера файла: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const COMPLEX_MODALITIES = new Set(['ct', 'mri', 'xray', 'ultrasound']);
const FABLE_MODEL = (process.env.VALIDATED_FABLE_MODEL || '').trim();
const ENABLE_VALIDATED_FABLE = process.env.ENABLE_VALIDATED_FABLE === 'true' && Boolean(FABLE_MODEL);
const FABLE_COST_MULTIPLIER = Math.max(1, Number(process.env.VALIDATED_FABLE_COST_MULTIPLIER || '2'));
const MIN_COMPLEX_IMAGES = Math.max(2, Number(process.env.VALIDATED_COMPLEX_MIN_IMAGES || '3'));
const MIN_COMPLEX_CONTEXT_CHARS = Math.max(200, Number(process.env.VALIDATED_COMPLEX_MIN_CONTEXT_CHARS || '500'));

function shouldSuggestFableForValidatedCase(
  imageType: string,
  imageCount: number,
  clinicalContext: string,
  isComparative: boolean
): boolean {
  const normalizedType = String(imageType || '').toLowerCase();
  const contextLength = String(clinicalContext || '').trim().length;

  return (
    isComparative ||
    imageCount >= MIN_COMPLEX_IMAGES ||
    contextLength >= MIN_COMPLEX_CONTEXT_CHARS ||
    COMPLEX_MODALITIES.has(normalizedType)
  );
}

function getEstimatedCostByModel(mode: string, imageCount: number, targetModel: string): number {
  const base = getAnalysisCost(mode, imageCount);
  if (mode === 'validated' && ENABLE_VALIDATED_FABLE && targetModel === FABLE_MODEL) {
    return Number((base * FABLE_COST_MULTIPLIER).toFixed(2));
  }
  return base;
}

export async function POST(request: NextRequest) {
  const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  let billingContext: { email: string | null; guestKey: string | null; estimatedCost: number } | null = null;
  let billedAmount = 0;
  let billingEmail: string | null = null;
  let billingGuestKey: string | null = null;
  
  const handleStreamingResponse = async (stream: ReadableStream, modelName: string) => {
    const wrapStreamWithBillingReconcile = (
      source: ReadableStream,
      context: { email: string | null; guestKey: string | null; estimatedCost: number }
    ) => {
      const reader = source.getReader();
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      let sseBuffer = '';
      let finalUsageCost: number | null = null;
      let reconciled = false;

      const reconcile = async () => {
        if (reconciled) return;
        reconciled = true;

        try {
          const estimated = context.estimatedCost;
          const actual = finalUsageCost;
          if (typeof actual !== 'number' || !Number.isFinite(actual) || actual < 0) {
            return;
          }

          const delta = Number((actual - estimated).toFixed(2));
          if (Math.abs(delta) > 0.01) {
            const operation =
              delta > 0 ? 'Analysis cost adjustment (extra charge)' : 'Analysis cost adjustment (refund)';
            const metadata = {
              analysisId,
              estimatedCost: estimated,
              actualCost: actual,
              adjustment: delta,
            };

            if (context.email) {
              await checkAndDeductBalance(context.email, delta, operation, metadata);
            } else if (context.guestKey) {
              await checkAndDeductGuestBalance(context.guestKey, delta, operation, metadata);
            }

            const refundEvent = {
              billing: {
                estimated_cost: estimated,
                actual_cost: actual,
                adjustment: delta,
                charged_cost: actual,
              },
            };
            // Отправляем прозрачную информацию в поток для UI (игнорируется, если клиент не обрабатывает).
            // Это помогает в дебаге и будущей визуализации.
            // Формат совместим с SSE data.
            // Не блокируем ответ при ошибках сериализации.
            try {
              return encoder.encode(`data: ${JSON.stringify(refundEvent)}\n\n`);
            } catch {
              return undefined;
            }
          }
        } catch (e) {
          console.error('[BILLING RECONCILE] Adjustment error:', e);
        }
        return undefined;
      };

      return new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              // Пробуем извлечь usage.total_cost из SSE, не нарушая исходный поток.
              const chunkText = decoder.decode(value, { stream: true });
              sseBuffer += chunkText;
              let lineEnd = sseBuffer.indexOf('\n');
              while (lineEnd !== -1) {
                const line = sseBuffer.slice(0, lineEnd).trim();
                sseBuffer = sseBuffer.slice(lineEnd + 1);
                if (line.startsWith('data: ')) {
                  const payload = line.slice(6).trim();
                  if (payload && payload !== '[DONE]') {
                    try {
                      const parsed = JSON.parse(payload);
                      const candidate = parsed?.usage?.total_cost;
                      if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0) {
                        finalUsageCost = candidate;
                      }
                    } catch {}
                  }
                }
                lineEnd = sseBuffer.indexOf('\n');
              }

              controller.enqueue(value);
            }

            const billingChunk = await reconcile();
            if (billingChunk) {
              controller.enqueue(billingChunk);
            }
            controller.close();
          } catch (error) {
            await reconcile();
            controller.error(error);
          } finally {
            reader.releaseLock();
          }
        },
      });
    };

    const responseStream = billingContext
      ? wrapStreamWithBillingReconcile(stream, billingContext)
      : stream;

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Content-Encoding': 'none',
        'X-Analysis-Id': analysisId,
      },
    });
  };

  try {
    const session = await getServerSession(authOptions);

    // Rate limiting
    const rlKey = getRateLimitKey(request, session?.user?.email);
    const rl = checkRateLimit(rlKey, RATE_LIMIT_ANALYSIS);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Please wait.' },
        { status: 429 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ success: false, error: 'OPENROUTER_API_KEY not set' }, { status: 500 });

    const formData = await request.formData();
    const mode = (formData.get('mode') as string) || 'optimized';
    const imageType = (formData.get('imageType') as string) || 'universal';
    const clinicalContext = anonymizeText(formData.get('clinicalContext') as string || '');
    const isComparative = formData.get('isComparative') === 'true';
    const validatedModelChoice = ((formData.get('validatedModelChoice') as string) || '').toLowerCase();
    const allowValidatedOffer = formData.get('allowValidatedOffer') === 'true';
    const customModel = formData.get('model') as string | null;

    // Серверное списание юнитов (до выполнения анализа)
    const userEmail = session?.user?.email || null;
    const guestKey = userEmail ? null : rlKey;
    billingEmail = userEmail;
    billingGuestKey = guestKey;
    // Считаем файлы для оценки стоимости
    let imgCount = formData.get('file') ? 1 : 0;
    let fi = 0;
    while (formData.get(`additionalImage_${fi}`)) { imgCount++; fi++; }
    
    const suggestFable = mode === 'validated'
      && ENABLE_VALIDATED_FABLE
      && shouldSuggestFableForValidatedCase(imageType, imgCount, clinicalContext, isComparative);

    if (
      mode === 'validated' &&
      allowValidatedOffer &&
      suggestFable &&
      validatedModelChoice !== 'fable' &&
      validatedModelChoice !== 'opus'
    ) {
      const opusEstimate = getEstimatedCostByModel(mode, imgCount, MODELS.OPUS_VALIDATED);
      const fableEstimate = getEstimatedCostByModel(mode, imgCount, FABLE_MODEL);
      return NextResponse.json(
        {
          success: false,
          requiresModelSelection: true,
          modelOffer: {
            recommendedModel: 'fable',
            defaultModel: 'opus',
            opusModel: MODELS.OPUS_VALIDATED,
            fableModel: FABLE_MODEL,
            estimatedCostOpus: opusEstimate,
            estimatedCostFable: fableEstimate,
            estimatedDifference: Number((fableEstimate - opusEstimate).toFixed(2)),
            reason: 'complex_case',
          },
        },
        { status: 409 }
      );
    }

    const selectedValidatedModel =
      mode === 'validated' && ENABLE_VALIDATED_FABLE && validatedModelChoice === 'fable'
        ? FABLE_MODEL
        : MODELS.OPUS_VALIDATED;

    const estimatedCost = getEstimatedCostByModel(mode, imgCount, selectedValidatedModel);
    const billing = userEmail
      ? await checkAndDeductBalance(userEmail, estimatedCost, 'Анализ изображения', { mode, imageCount: imgCount })
      : await checkAndDeductGuestBalance(guestKey!, estimatedCost, 'Guest trial: image analysis', { mode, imageCount: imgCount });
    billingContext = { email: userEmail, guestKey, estimatedCost };
    billedAmount = estimatedCost;
    
    if (!billing.allowed) {
      return NextResponse.json(
        { success: false, error: billing.error || 'Insufficient balance' },
        { status: 402 }
      );
    }

    const file = formData.get('file') as File;

    // Проверка размера файлов
    if (file && file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Максимум: 50MB.` },
        { status: 400 }
      );
    }
    const prompt = anonymizeText(formData.get('prompt') as string || 'Analyze the medical image.');
    const stage = ((formData.get('stage') as string) || 'all').toLowerCase();
    const descriptionFromStep1 = anonymizeText(formData.get('description') as string || '');
    const useStreaming = formData.get('useStreaming') === 'true';
    const isTwoStage = formData.get('isTwoStage') === 'true';
    // Закрашивание краёв снимка / DICOM-тегов — отдельный флаг от "не сохранять
    // в базу пациентов" (последнее решается только на клиенте). По умолчанию
    // (если клиент не прислал поле) считаем маскирование ВКЛЮЧЁННЫМ — это
    // безопасный дефолт для защиты ПДн, а не наоборот.
    const maskImageRaw = formData.get('maskImage');
    const maskImage = maskImageRaw === null ? true : maskImageRaw === 'true';
    
    // Специальности удалены для стабильности
    const specialty = undefined;
    
    const additionalImages: File[] = [];
    let fileIndex = 0;
    while (true) {
      const additionalFile = formData.get(`additionalImage_${fileIndex}`) as File;
      if (!additionalFile) break;
      additionalImages.push(additionalFile);
      fileIndex++;
    }

    const allImages = file ? [file, ...additionalImages] : additionalImages;
    if (allImages.length === 0) return NextResponse.json({ success: false, error: 'No images' }, { status: 400 });

    const imagesBase64: string[] = [];
    const mimeTypes: string[] = [];
    let dicomContext = '';

    for (const img of allImages) {
      const isDicom = img.name.toLowerCase().endsWith('.dcm') || img.type === 'application/dicom';
      if (isDicom) {
        // DICOM: используем processDicomJs (уже включает анонимизацию)
        const arrayBuffer = await img.arrayBuffer();
        let buffer: Buffer<ArrayBufferLike> = Buffer.from(arrayBuffer);
        
        // 1. Если маскирование включено — затираем теги в буфере ПЕРЕД обработкой
        if (maskImage) {
          // Логируем без имени файла (может содержать ПДн)
          // safeLog('🛡️ [DICOM] Анонимизация буфера');
          const { anonymizeDicomBuffer } = await import('@/lib/dicom-processor');
          buffer = anonymizeDicomBuffer(buffer);
        }

        const nativeMeta = extractDicomMetadata(buffer);
        if (nativeMeta.modality) dicomContext += formatDicomMetadataForAI(nativeMeta);
        
        const jsResult = await processDicomJs(buffer, maskImage);
        if (jsResult.success && jsResult.image) {
          imagesBase64.push(jsResult.image);
          mimeTypes.push('image/png');
        } else {
          // Если JS-рендеринг не удался → пробуем серверный Python fallback
          console.warn('[DICOM] JS render failed, trying Python fallback...');
          const tempDir = os.tmpdir();
          const tempDcm = path.join(tempDir, `${Date.now()}.dcm`);
          const tempJpg = path.join(tempDir, `${Date.now()}.jpg`);
          
          try {
            await fs.writeFile(tempDcm, buffer);
            await execPromise(`python3 -m pip show pydicom > /dev/null 2>&1 || python3 -m pip install --user pydicom pillow`);
            await execPromise(`python3 -c "import pydicom; import PIL.Image; ds=pydicom.dcmread('${tempDcm}'); arr=ds.pixel_array; PIL.Image.fromarray(arr).convert('RGB').save('${tempJpg}')"`);
            
            const jpgBuffer = await fs.readFile(tempJpg);
            imagesBase64.push(jpgBuffer.toString('base64'));
            mimeTypes.push('image/jpeg');
            console.log('[DICOM] Python fallback succeeded');
          } catch (pyError) {
            console.error('[DICOM] Python fallback failed:', pyError);
            // Последний fallback: отправляем как есть (Azure скорее всего отклонит)
            imagesBase64.push(buffer.toString('base64'));
            mimeTypes.push('application/dicom');
          } finally {
            try { await fs.unlink(tempDcm); } catch {}
            try { await fs.unlink(tempJpg); } catch {}
          }
        }
      } else {
        // ОБЫЧНОЕ ИЗОБРАЖЕНИЕ: АНОНИМИЗАЦИЯ НА СЕРВЕРЕ (ТОЛЬКО ЕСЛИ ВКЛЮЧЕНО)
        const arrayBuffer = await img.arrayBuffer();
        let buffer: Buffer<ArrayBufferLike> = Buffer.from(arrayBuffer);
        let currentMimeType = img.type;
        
        // 1) Гарантируем формат, который примут vision-провайдеры.
        // Важно для iPhone HEIC и случаев, когда браузер присылает пустой mimeType.
        try {
          const ensured = await ensureVisionSupportedImage(buffer, currentMimeType);
          buffer = ensured.buffer;
          currentMimeType = ensured.mimeType;
          const enhanced = await enhanceMedicalImageBuffer(buffer, currentMimeType);
          buffer = enhanced.buffer;
          currentMimeType = enhanced.mimeType;
        } catch (e: any) {
          return NextResponse.json(
            { success: false, error: e?.message || 'Failed to process image' },
            { status: 400 }
          );
        }
        
        // 2) Применяем анонимизацию для всех изображений (JPG/PNG и т.д.), если включено маскирование
        if (maskImage && currentMimeType.startsWith('image/')) {
          // Не логируем имя файла — может содержать ПДн
          buffer = await anonymizeImageBuffer(buffer, currentMimeType);
        }
        
        // 3) КОМПРЕССИЯ: Если изображение > 4 МБ, сжимаем до ~4 МБ для соблюдения лимитов API
        const compressed = await compressImageBuffer(buffer, currentMimeType, 4.0);
        buffer = compressed.buffer;
        currentMimeType = compressed.mimeType;
        
        imagesBase64.push(buffer.toString('base64'));
        mimeTypes.push(currentMimeType);
      }
    }

    const finalClinicalContext = [clinicalContext, dicomContext].filter(Boolean).join('\n\n');
    const allowGpt52Analyze = process.env.ALLOW_GPT52_ANALYZE !== 'false';
    const normalizedCustomModel = (() => {
      if (!customModel) return null;
      const isValidatedMode = mode === 'validated';
      if (customModel === 'gpt52' || customModel === MODELS.GPT_5_2) {
        return allowGpt52Analyze ? MODELS.GPT_5_2 : MODELS.SONNET;
      }
      if (customModel === 'sonnet' || customModel === MODELS.SONNET) return MODELS.SONNET;
      if (customModel === 'opus' || customModel === MODELS.OPUS) {
        // Legacy UI может присылать Opus 4.6 даже для validated-режима.
        // В таком случае принудительно маршрутизируем на validated-модель.
        return isValidatedMode ? MODELS.OPUS_VALIDATED : MODELS.OPUS;
      }
      if (customModel === 'gemini' || customModel === MODELS.GEMINI_3_FLASH) return MODELS.GEMINI_3_FLASH;
      if (customModel === MODELS.OPUS_VALIDATED) return MODELS.OPUS_VALIDATED;
      if (ENABLE_VALIDATED_FABLE && customModel === FABLE_MODEL) return FABLE_MODEL;
      return customModel;
    })();
    const defaultModelByMode =
      mode === 'fast'
        ? MODELS.GEMINI_3_FLASH
        : mode === 'validated'
          ? selectedValidatedModel
          : (allowGpt52Analyze ? MODELS.GPT_5_2 : MODELS.SONNET);
    let modelToUse = normalizedCustomModel || defaultModelByMode;
    const allowedModels = new Set([
      MODELS.GEMINI_3_FLASH,
      MODELS.GPT_5_2,
      MODELS.SONNET,
      MODELS.OPUS,
      MODELS.OPUS_VALIDATED,
    ]);
    if (ENABLE_VALIDATED_FABLE) {
      allowedModels.add(FABLE_MODEL);
    }
    if (!allowedModels.has(modelToUse)) {
      modelToUse = defaultModelByMode;
    }
    console.log(`[MODEL-SELECT] mode=${mode} custom=${customModel || 'none'} resolved=${modelToUse}`);
    const displayedCost = billingContext?.estimatedCost ?? getAnalysisCost(mode, allImages.length);

    // Сравнительный промпт включаем ТОЛЬКО по явному флагу.
    // Множественные кадры/срезы одного исследования не считаем динамикой "было/стало".
    let finalPrompt = prompt;
    if (stage === 'directive') {
      if (!descriptionFromStep1.trim()) {
        return NextResponse.json(
          { success: false, error: 'Для шага "Клиническая директива" требуется описание из шага 1.' },
          { status: 400 }
        );
      }

      finalPrompt = `КЛИНИЧЕСКАЯ ДИРЕКТИВА (ШАГ 2)

Используй:
1) описание изображения из шага 1,
2) клинический контекст пациента,
3) технические данные и приложенные изображения.

Важно:
- НЕ повторяй заново полный блок визуального описания;
- дай клиническую интерпретацию, дифференциальный ряд и приоритеты;
- выдели следующие клинические шаги и риски.

=== ОПИСАНИЕ ИЗ ШАГА 1 ===
${descriptionFromStep1}`;
    }

    if (stage !== 'directive' && isComparative && allImages.length > 1 && !prompt.includes('СРАВНИТЕЛЬНЫЙ')) {
      const { getImageComparisonPrompt } = await import('@/lib/prompts');
      finalPrompt = getImageComparisonPrompt(prompt);
    }

    if (mode === 'fast') {
      if (useStreaming) {
        const stream = await analyzeImageFastStreaming(finalPrompt, imagesBase64, imageType, finalClinicalContext, undefined, [], isTwoStage, isComparative);
        return handleStreamingResponse(stream, MODELS.GEMINI_3_FLASH);
      }
      const result = await analyzeImageFast({ prompt: finalPrompt, imagesBase64, imageType: imageType as any, clinicalContext: finalClinicalContext, isComparative });
      return NextResponse.json({ success: true, result, model: modelToUse, mode, cost: displayedCost });
    }

    if (allImages.length > 1) {
      if (useStreaming) {
        const stream = await analyzeMultipleImagesOpusTwoStageStreaming(
          finalPrompt, 
          imagesBase64, 
          imageType as any, 
          finalClinicalContext, 
          mimeTypes, 
          modelToUse, 
          undefined,  // specialty
          [],         // history
          isTwoStage,
          isComparative
        );
        return handleStreamingResponse(stream, modelToUse);
      }
      const result = await analyzeMultipleImagesTwoStage({ 
        prompt: finalPrompt, 
        imagesBase64, 
        imageType: imageType as any, 
        clinicalContext: finalClinicalContext, 
        targetModel: modelToUse, 
        isRadiologyOnly: isTwoStage,
        isComparative
      });
      return NextResponse.json({ success: true, result, model: modelToUse, mode, cost: displayedCost });
    } else {
      if (useStreaming) {
        const stream = await analyzeImageOpusTwoStageStreaming(
          finalPrompt, 
          imagesBase64[0], 
          imageType as any, 
          finalClinicalContext, 
          undefined,  // specialty
          modelToUse, 
          [],         // history
          isTwoStage,
          mimeTypes[0] || 'image/png'
        );
        return handleStreamingResponse(stream, modelToUse);
      }
      const result = await analyzeImageOpusTwoStage({ 
        prompt: finalPrompt, 
        imageBase64: imagesBase64[0], 
        imageType: imageType as any, 
        clinicalContext: finalClinicalContext, 
        targetModel: modelToUse, 
        isRadiologyOnly: isTwoStage 
      });
      return NextResponse.json({ success: true, result, model: modelToUse, mode, cost: displayedCost });
    }
  } catch (error: any) {
    if (billedAmount > 0) {
      const refundResult = await refundChargedBalanceOnFailure({
        email: billingEmail,
        guestKey: billingGuestKey,
        amount: billedAmount,
        operation: 'Image analysis (auto refund on failure)',
        metadata: { analysisId, billedAmount },
      });
      if (!refundResult.success) {
        console.error('❌ [ANALYZE IMAGE] Не удалось выполнить авто-возврат:', refundResult.error);
      }
    }
    const { safeErrorMessage } = await import('@/lib/safe-error');
    return NextResponse.json({ success: false, error: safeErrorMessage(error, 'Image analysis error') }, { status: 500 });
  }
}
