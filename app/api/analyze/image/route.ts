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
import { anonymizeImageBuffer, compressImageBuffer, ensureVisionSupportedImage } from "@/lib/server-image-processing";
import { extractDicomMetadata, formatDicomMetadataForAI } from '@/lib/dicom-service';
import { processDicomJs } from "@/lib/dicom-processor";
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { checkRateLimit, RATE_LIMIT_ANALYSIS, getRateLimitKey } from '@/lib/rate-limiter';
import { checkAndDeductBalance, getAnalysisCost } from '@/lib/server-billing';

const execPromise = promisify(exec);

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Лимит размера файла: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  const handleStreamingResponse = async (stream: ReadableStream, modelName: string) => {
    return new Response(stream, {
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
    // Rate limiting
    const session = await getServerSession(authOptions);
    const rlKey = getRateLimitKey(request, session?.user?.email);
    const rl = checkRateLimit(rlKey, RATE_LIMIT_ANALYSIS);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Превышен лимит запросов. Подождите.' },
        { status: 429 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ success: false, error: 'OPENROUTER_API_KEY not set' }, { status: 500 });

    const formData = await request.formData();
    const mode = (formData.get('mode') as string) || 'optimized';

    // Серверное списание юнитов (до выполнения анализа)
    const userEmail = session?.user?.email;
    if (userEmail) {
      // Считаем файлы для оценки стоимости
      let imgCount = formData.get('file') ? 1 : 0;
      let fi = 0;
      while (formData.get(`additionalImage_${fi}`)) { imgCount++; fi++; }
      
      const estimatedCost = getAnalysisCost(mode, imgCount);
      const billing = await checkAndDeductBalance(userEmail, estimatedCost, 'Анализ изображения', { mode, imageCount: imgCount });
      
      if (!billing.allowed) {
        return NextResponse.json(
          { success: false, error: billing.error || 'Недостаточно средств' },
          { status: 402 }
        );
      }
    }

    const file = formData.get('file') as File;

    // Проверка размера файлов
    if (file && file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)}MB). Максимум: 50MB.` },
        { status: 400 }
      );
    }
    const prompt = anonymizeText(formData.get('prompt') as string || 'Проанализируйте медицинское изображение.');
    const clinicalContext = anonymizeText(formData.get('clinicalContext') as string || '');
    const stage = (formData.get('stage') as string) || 'all';
    const imageType = (formData.get('imageType') as string) || 'universal';
    const customModel = formData.get('model') as string | null;
    const useStreaming = formData.get('useStreaming') === 'true';
    const isTwoStage = formData.get('isTwoStage') === 'true';
    const isAnonymous = formData.get('isAnonymous') === 'true';
    
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
        let buffer = Buffer.from(arrayBuffer);
        
        // 1. Если анонимно — затираем теги в буфере ПЕРЕД обработкой
        if (isAnonymous) {
          // Логируем без имени файла (может содержать ПДн)
          // safeLog('🛡️ [DICOM] Анонимизация буфера');
          const { anonymizeDicomBuffer } = await import('@/lib/dicom-processor');
          buffer = anonymizeDicomBuffer(buffer);
        }

        const nativeMeta = extractDicomMetadata(buffer);
        if (nativeMeta.modality) dicomContext += formatDicomMetadataForAI(nativeMeta);
        
        const jsResult = await processDicomJs(buffer, isAnonymous);
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
        let buffer = Buffer.from(arrayBuffer);
        let currentMimeType = img.type;
        
        // 1) Гарантируем формат, который примут vision-провайдеры.
        // Важно для iPhone HEIC и случаев, когда браузер присылает пустой mimeType.
        try {
          const ensured = await ensureVisionSupportedImage(buffer, currentMimeType);
          buffer = ensured.buffer;
          currentMimeType = ensured.mimeType;
        } catch (e: any) {
          return NextResponse.json(
            { success: false, error: e?.message || 'Не удалось обработать изображение' },
            { status: 400 }
          );
        }
        
        // 2) Применяем анонимизацию для всех изображений (JPG/PNG и т.д.), если включен режим анонимности
        if (isAnonymous && currentMimeType.startsWith('image/')) {
          // Не логируем имя файла — может содержать ПДн
          // @ts-expect-error - Несовместимость типов Buffer между canvas и Node.js, но код работает корректно
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
    let modelToUse = customModel || (mode === 'fast' ? MODELS.GEMINI_3_FLASH : MODELS.SONNET);

    // Если изображений несколько, используем специальный промпт для сравнения, если он еще не задан явно
    let finalPrompt = prompt;
    if (allImages.length > 1 && !prompt.includes('СРАВНИТЕЛЬНЫЙ')) {
      const { getImageComparisonPrompt } = await import('@/lib/prompts');
      finalPrompt = getImageComparisonPrompt(prompt);
    }

    if (mode === 'fast') {
      if (useStreaming) {
        const stream = await analyzeImageFastStreaming(finalPrompt, imagesBase64, imageType, finalClinicalContext, undefined, [], isTwoStage);
        return handleStreamingResponse(stream, MODELS.GEMINI_3_FLASH);
      }
      const result = await analyzeImageFast({ prompt: finalPrompt, imagesBase64, imageType: imageType as any, clinicalContext: finalClinicalContext });
      return NextResponse.json({ success: true, result, model: modelToUse, mode, cost: 0.5 });
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
          isTwoStage
        );
        return handleStreamingResponse(stream, modelToUse);
      }
      const result = await analyzeMultipleImagesTwoStage({ 
        prompt: finalPrompt, 
        imagesBase64, 
        imageType: imageType as any, 
        clinicalContext: finalClinicalContext, 
        targetModel: modelToUse, 
        isRadiologyOnly: isTwoStage 
      });
      return NextResponse.json({ success: true, result, model: modelToUse, mode, cost: 2.0 });
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
          isTwoStage
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
      return NextResponse.json({ success: true, result, model: modelToUse, mode, cost: 1.5 });
    }
  } catch (error: any) {
    const { safeErrorMessage } = await import('@/lib/safe-error');
    return NextResponse.json({ success: false, error: safeErrorMessage(error, 'Ошибка анализа изображения') }, { status: 500 });
  }
}
