import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage, analyzeImageFast, extractImageJSON, analyzeImageOpusTwoStage, analyzeMultipleImages, analyzeMultipleImagesTwoStage, MODELS } from '@/lib/openrouter';
import { 
  analyzeImageStreaming, 
  analyzeImageFastStreaming,
  analyzeImageWithJSONStreaming, 
  analyzeImageOpusTwoStageStreaming, 
  analyzeMultipleImagesStreaming,
  analyzeMultipleImagesOpusTwoStageStreaming,
  analyzeMultipleImagesWithJSONStreaming,
  analyzeMultipleImagesDescriptionStreaming,
  analyzeMultipleImagesDirectiveStreaming
} from '@/lib/openrouter-streaming';
import { formatCostLog } from '@/lib/cost-calculator';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { anonymizeText } from "@/lib/anonymization";
import { extractDicomMetadata, formatDicomMetadataForAI } from '@/lib/dicom-service';
import { processDicomJs } from "@/lib/dicom-processor";
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

const execPromise = promisify(exec);

// Максимальное время выполнения запроса (5 минут) для сложных анализов
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * API endpoint для анализа медицинских изображений
 */
export async function POST(request: NextRequest) {
  const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  // Проверка авторизации ПОЛНОСТЬЮ ОТКЛЮЧЕНА
  /*
  if (process.env.NEXT_PUBLIC_AUTH_DISABLED !== 'true') {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Необходима авторизация' },
        { status: 401 }
      );
    }
  }
  */

  // Вспомогательная функция для стриминга (должна быть объявлена ДО использования)
  const handleStreamingResponse = async (stream: ReadableStream, modelName: string) => {
    const decoder = new TextDecoder();
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk);
        const text = decoder.decode(chunk, { stream: true });
        if (text.includes('"usage":')) {
          const lines = text.split('\n');
          for (const line of lines) {
            if (line.includes('"usage":')) {
              try {
                const jsonStr = line.startsWith('data: ') ? line.slice(6).trim() : line.trim();
                if (jsonStr === '[DONE]') continue;
                const data = JSON.parse(jsonStr);
                if (data.usage) {
                  console.log(formatCostLog(
                    modelName,
                    data.usage.prompt_tokens,
                    data.usage.completion_tokens,
                    data.usage.total_tokens
                  ));
                }
              } catch (e) {}
            }
          }
        }
      }
    });

    return new Response(stream.pipeThrough(transformStream), {
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
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'OPENROUTER_API_KEY не настроен' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const prompt = anonymizeText(formData.get('prompt') as string || 'Проанализируйте медицинское изображение.');
    const clinicalContext = anonymizeText(formData.get('clinicalContext') as string || '');
    const mode = (formData.get('mode') as string) || 'optimized';
    const stage = (formData.get('stage') as string) || 'all';
    const imageType = (formData.get('imageType') as string) || 'universal';
    const customModel = formData.get('model') as string | null;
    const useStreaming = formData.get('useStreaming') === 'true';
    
    // Сбор всех изображений
    const additionalImages: File[] = [];
    let fileIndex = 0;
    while (true) {
      const additionalFile = formData.get(`additionalImage_${fileIndex}`) as File;
      if (!additionalFile) break;
      additionalImages.push(additionalFile);
      fileIndex++;
    }

    const allImages = file ? [file, ...additionalImages] : additionalImages;
    if (allImages.length === 0) {
      return NextResponse.json({ success: false, error: 'Изображения не получены' }, { status: 400 });
    }

    const imagesBase64: string[] = [];
    const mimeTypes: string[] = [];
    let dicomContext = '';

    for (const img of allImages) {
      const isDicom = img.name.toLowerCase().endsWith('.dcm') || 
                      img.name.toLowerCase().endsWith('.dicom') || 
                      img.type === 'application/dicom' ||
                      img.type === ''; // Некоторые браузеры не определяют тип для .dcm

      if (isDicom) {
        console.log(`📦 [DICOM] Обнаружен DICOM файл: ${img.name}`);
        const arrayBuffer = await img.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 1. Нативное извлечение метаданных через JS (Безопасно и быстро)
        const nativeMeta = extractDicomMetadata(buffer);
        if (nativeMeta.modality) {
          console.log(`✅ [DICOM JS] Метаданные извлечены нативно: ${nativeMeta.modality}`);
          dicomContext += formatDicomMetadataForAI(nativeMeta);
        }

        // 2. Нативная конвертация изображения через JS (БЫСТРО)
        const jsProcessResult = await processDicomJs(buffer);
        
        if (jsProcessResult.success && jsProcessResult.image) {
          console.log(`✅ [DICOM JS] Изображение успешно обработано нативно`);
          imagesBase64.push(jsProcessResult.image);
          mimeTypes.push('image/png');
        } else {
          // 3. Fallback: Конвертация изображения через Python (если JS не справился)
          console.log(`⚠️ [DICOM JS] Нативная обработка не удалась, переход на Python...`);
          const tempDir = os.tmpdir();
          const tempPath = path.join(tempDir, `dicom_${Date.now()}_${img.name.replace(/\s+/g, '_')}`);
          await fs.writeFile(tempPath, buffer);
          
          try {
            const scriptPath = path.join(process.cwd(), 'scripts/process_dicom.py');
            // Используем python3 или python в зависимости от окружения
            const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
            const { stdout } = await execPromise(`${pythonCmd} "${scriptPath}" "${tempPath}"`);
            const result = JSON.parse(stdout);
            
            if (result.success) {
              imagesBase64.push(result.image);
              mimeTypes.push('image/png');
              
              // Если Python нашел дополнительные метаданные, которых нет в JS, добавляем их
              if (!nativeMeta.modality && result.metadata) {
                const m = result.metadata;
                dicomContext += `\n[Данные из Python]: ${m.modality} ${m.body_part}\n`;
              }
              
              console.log(`✅ [DICOM Python] Изображение успешно конвертировано`);
            } else {
              console.error(`❌ [DICOM ERROR]: ${result.error}`);
              // Резервный вариант: отправляем как есть (некоторые ИИ могут пробовать читать raw)
              imagesBase64.push(buffer.toString('base64'));
              mimeTypes.push(img.type || 'application/dicom');
            }
          } catch (e: any) {
            console.error(`❌ [DICOM EXEC ERROR]:`, e);
            imagesBase64.push(buffer.toString('base64'));
            mimeTypes.push(img.type || 'application/dicom');
          } finally {
            await fs.unlink(tempPath).catch(() => {});
          }
        }
      } else {
        const arrayBuffer = await img.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        imagesBase64.push(buffer.toString('base64'));
        mimeTypes.push(img.type);
      }
    }

    // Добавляем данные DICOM к клиническому контексту
    const finalClinicalContext = dicomContext ? `${clinicalContext}\n\n${dicomContext}` : clinicalContext;

    // Определяем модель в зависимости от режима
    let modelToUse = customModel;
    if (!modelToUse) {
      if (mode === 'fast') {
        modelToUse = MODELS.GEMINI_3_FLASH;
      } else {
        // По умолчанию для всех серьезных анализов используем SONNET 4.5.
        // Это в 5 раз дешевле OPUS при сопоставимом качестве.
        modelToUse = MODELS.SONNET;
      }
    }

    // --- БЫСТРЫЙ РЕЖИМ (Fast) ---
    if (mode === 'fast') {
      if (useStreaming) {
        // Для быстрого стриминга используем Gemini (JSON) -> Gemini (Описание)
        const stream = await analyzeImageFastStreaming(prompt, imagesBase64[0], imageType, finalClinicalContext);
        return handleStreamingResponse(stream, MODELS.GEMINI_3_FLASH);
      } else {
        const result = await analyzeImageFast({
          prompt,
          imageBase64: imagesBase64[0],
          imageType: imageType as any,
          clinicalContext: finalClinicalContext
        });
        return NextResponse.json({ success: true, result, model: modelToUse, mode, analysis_id: analysisId });
      }
    }

    // --- ПОСЛЕДОВАТЕЛЬНЫЕ ЭТАПЫ (Шаг 1 / Шаг 2) ---
    if (useStreaming && (stage === 'description' || stage === 'directive')) {
      let stream: ReadableStream;
      if (stage === 'description') {
        stream = await analyzeMultipleImagesDescriptionStreaming(prompt, imagesBase64, imageType, finalClinicalContext, mimeTypes);
      } else {
        const description = formData.get('description') as string || '';
        stream = await analyzeMultipleImagesDirectiveStreaming(prompt, description, imagesBase64, finalClinicalContext, mimeTypes);
      }
      return handleStreamingResponse(stream, stage === 'description' ? MODELS.SONNET : MODELS.OPUS);
    }

    // --- СТАНДАРТНЫЙ РЕЖИМ ---
    if (allImages.length > 1) {
      if (useStreaming) {
        let stream: ReadableStream;
        if (mode === 'optimized') stream = await analyzeMultipleImagesOpusTwoStageStreaming(prompt, imagesBase64, imageType as any, finalClinicalContext, mimeTypes);
        else if (mode === 'validated') stream = await analyzeMultipleImagesWithJSONStreaming(prompt, imagesBase64, imageType as any, finalClinicalContext, mimeTypes);
        else stream = await analyzeMultipleImagesStreaming(prompt, imagesBase64, mimeTypes, modelToUse, finalClinicalContext);
        return handleStreamingResponse(stream, modelToUse);
      } else {
        // Двухэтапный анализ для нескольких изображений
        if (mode === 'optimized' || mode === 'validated') {
          const result = await analyzeMultipleImagesTwoStage({
            prompt,
            imagesBase64,
            imageType: imageType as any,
            clinicalContext: finalClinicalContext,
            targetModel: modelToUse
          });
          return NextResponse.json({ success: true, result, model: modelToUse, mode, analysis_id: analysisId });
        }
        const result = await analyzeMultipleImages({ prompt, imagesBase64, mimeTypes, model: modelToUse, clinicalContext: finalClinicalContext, imageType: imageType as any });
        return NextResponse.json({ success: true, result, model: modelToUse, mode, analysis_id: analysisId });
      }
    } else {
      const base64Image = imagesBase64[0];
      if (mode === 'optimized' && useStreaming) {
        const stream = await analyzeImageOpusTwoStageStreaming(prompt, base64Image, imageType as any, finalClinicalContext);
        return handleStreamingResponse(stream, MODELS.SONNET);
      }
      if (mode === 'validated' && useStreaming) {
        const jsonExtraction = await extractImageJSON({ imageBase64: base64Image, modality: imageType });
        const stream = await analyzeImageWithJSONStreaming(jsonExtraction, base64Image, prompt, mimeTypes[0], imageType as any, finalClinicalContext);
        return handleStreamingResponse(stream, MODELS.OPUS);
      }
      if (useStreaming) {
        const stream = await analyzeImageStreaming(prompt, base64Image, modelToUse, mimeTypes[0], finalClinicalContext);
        return handleStreamingResponse(stream, modelToUse);
      }
      
      // Двухэтапный анализ для optimized и validated режимов (не стриминг)
      if (mode === 'optimized' || mode === 'validated') {
        const result = await analyzeImageOpusTwoStage({
          prompt,
          imageBase64: base64Image,
          imageType: imageType as any,
          clinicalContext: finalClinicalContext,
          targetModel: modelToUse
        });
        return NextResponse.json({ success: true, result, model: modelToUse, mode, analysis_id: analysisId });
      }

      const result = await analyzeImage({ prompt, imageBase64: base64Image, mimeType: mimeTypes[0], model: modelToUse, clinicalContext: finalClinicalContext, imageType: imageType as any });
      return NextResponse.json({ success: true, result, model: modelToUse, mode, analysis_id: analysisId });
    }

  } catch (error: any) {
    console.error('❌ [API ERROR]:', error);
    return NextResponse.json({ success: false, error: error.message || 'Ошибка сервера' }, { status: 500 });
  }
}
