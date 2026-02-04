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
import { anonymizeImageBuffer } from "@/lib/image-compression";
import { extractDicomMetadata, formatDicomMetadataForAI } from '@/lib/dicom-service';
import { processDicomJs } from "@/lib/dicom-processor";
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

const execPromise = promisify(exec);

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

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
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ success: false, error: 'OPENROUTER_API_KEY not set' }, { status: 500 });

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const prompt = anonymizeText(formData.get('prompt') as string || 'Проанализируйте медицинское изображение.');
    const clinicalContext = anonymizeText(formData.get('clinicalContext') as string || '');
    const mode = (formData.get('mode') as string) || 'optimized';
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
          console.log(`🛡️ [DICOM] Анонимизация буфера для: ${img.name}`);
          const { anonymizeDicomBuffer } = await import('@/lib/dicom-processor');
          buffer = anonymizeDicomBuffer(buffer);
        }

        const nativeMeta = extractDicomMetadata(buffer);
        if (nativeMeta.modality) dicomContext += formatDicomMetadataForAI(nativeMeta);
        
        const jsResult = await processDicomJs(buffer);
        if (jsResult.success && jsResult.image) {
          imagesBase64.push(jsResult.image);
          mimeTypes.push('image/png');
        } else {
          // Если не смогли отрендерить, отправляем буфер (который уже анонимизирован, если флаг стоял)
          imagesBase64.push(buffer.toString('base64'));
          mimeTypes.push(img.type || 'application/dicom');
        }
      } else {
        // ОБЫЧНОЕ ИЗОБРАЖЕНИЕ: АВТОМАТИЧЕСКАЯ АНОНИМИЗАЦИЯ НА СЕРВЕРЕ
        const arrayBuffer = await img.arrayBuffer();
        let buffer = Buffer.from(arrayBuffer);
        
        // Применяем анонимизацию для всех изображений (JPG, PNG и т.д.)
        if (img.type.startsWith('image/')) {
          console.log(`🛡️ [Anonymization] Автоматическая анонимизация: ${img.name}`);
          // @ts-expect-error - Несовместимость типов Buffer между canvas и Node.js, но код работает корректно
          buffer = await anonymizeImageBuffer(buffer, img.type);
        }
        
        imagesBase64.push(buffer.toString('base64'));
        mimeTypes.push(img.type);
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
