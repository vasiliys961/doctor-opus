import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage, sendTextRequest, MODELS } from '@/lib/openrouter';
import { 
  analyzeImageStreaming, 
  sendTextRequestStreaming, 
  analyzeMultipleImagesStreaming,
  analyzeMultipleImagesOpusTwoStageStreaming,
  analyzeMultipleImagesWithJSONStreaming,
  analyzeImageOpusTwoStageStreaming
} from '@/lib/openrouter-streaming';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { checkAndDeductBalance, checkAndDeductGuestBalance, getAnalysisCost } from '@/lib/server-billing';
import { getRateLimitKey } from '@/lib/rate-limiter';
import { anonymizeImageBuffer } from '@/lib/server-image-processing';
import { getLlmApiKey } from '@/lib/llm-provider';
import { appendLanguageInstruction, getForcedLanguageInstructionForRequest } from '@/lib/i18n/llm-response-language';

// Максимальное время выполнения (5 минут)
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * API endpoint для анализа лабораторных данных из массива изображений (PDF страницы)
 * Принимает изображения в base64 и анализирует их через Vision API
 */
export async function POST(request: NextRequest) {
  const analysisId = `lab_images_${Date.now()}`;
  
  // Вспомогательная функция для стриминга
  const handleStreamingResponse = (stream: ReadableStream) => {
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'X-Analysis-Id': analysisId,
      },
    });
  };

  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email || null;
    const guestKey = userEmail ? null : getRateLimitKey(request);

    const body = await request.json();
    const { images: rawImages, prompt, clinicalContext, mode, useStreaming, model, maskImage: maskImageInput } = body;
    const responseLanguageInstruction = await getForcedLanguageInstructionForRequest();
    const normalizedPrompt = String(prompt || 'Analyze laboratory report images and extract all markers, values, units, and reference ranges.');
    const languageAwarePrompt = appendLanguageInstruction(normalizedPrompt, responseLanguageInstruction);

    if (!rawImages || !Array.isArray(rawImages) || rawImages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No images provided' },
        { status: 400 }
      );
    }

    // Закрашивание краёв каждой страницы — по умолчанию (если поле не прислано)
    // включено. Врач мог уже отредактировать страницы вручную через ImageEditor,
    // повторное наложение чёрных плашек на уже закрашенные зоны безвредно.
    const maskImage = maskImageInput === undefined ? true : Boolean(maskImageInput);
    const images = maskImage
      ? await Promise.all(
          rawImages.map(async (img: string) => {
            try {
              const buffer = await anonymizeImageBuffer(Buffer.from(img, 'base64'), 'image/png');
              return buffer.toString('base64');
            } catch {
              return img;
            }
          })
        )
      : rawImages;

    const estimatedCost = getAnalysisCost(mode || 'optimized', images.length);
    const billing = userEmail
      ? await checkAndDeductBalance(userEmail, estimatedCost, 'Lab images analysis', { mode: mode || 'optimized', imageCount: images.length })
      : await checkAndDeductGuestBalance(guestKey!, estimatedCost, 'Guest trial: lab images analysis', { mode: mode || 'optimized', imageCount: images.length });
    if (!billing.allowed) {
      return NextResponse.json(
        { success: false, error: billing.error || 'Insufficient balance' },
        { status: 402 }
      );
    }

    try {
      getLlmApiKey();
    } catch {
      return NextResponse.json(
        { success: false, error: 'LLM API key is not configured' },
        { status: 500 }
      );
    }

    // Определение модели на основе режима или прямого указания.
    // Для validated-режима legacy-модель Opus 4.6 принудительно маппим на validated-модель.
    let modelToUse = model || MODELS.GEMINI_3_FLASH;
    if (!model) {
      if (mode === 'optimized') modelToUse = MODELS.SONNET;
      else if (mode === 'validated') modelToUse = MODELS.OPUS_VALIDATED;
    } else if (mode === 'validated' && (model === MODELS.OPUS || model === 'opus')) {
      modelToUse = MODELS.OPUS_VALIDATED;
    }

    console.log(`🔬 [LAB IMAGES] Получено ${images.length} изображений для анализа, режим: ${mode}, модель: ${modelToUse}, streaming: ${useStreaming}`);

    // Если запрошен стриминг
    if (useStreaming) {
      console.log(`📡 [LAB IMAGES] Запуск стриминга (${images.length} изображений)...`);
      let stream: ReadableStream;
      
      if (images.length > 1) {
        if (mode === 'optimized') {
          stream = await analyzeMultipleImagesOpusTwoStageStreaming(languageAwarePrompt, images, 'lab', clinicalContext, images.map(() => 'image/png'), modelToUse);
        } else if (mode === 'validated') {
          stream = await analyzeMultipleImagesWithJSONStreaming(languageAwarePrompt, images, 'lab', clinicalContext, images.map(() => 'image/png'), undefined, modelToUse);
        } else {
          stream = await analyzeMultipleImagesStreaming(languageAwarePrompt, images, images.map(() => 'image/png'), modelToUse, clinicalContext);
        }
      } else {
        // Одиночное изображение
        if (mode === 'optimized' || mode === 'validated') {
          stream = await analyzeImageOpusTwoStageStreaming(
            languageAwarePrompt,
            images[0],
            'universal',
            clinicalContext,
            undefined,
            modelToUse,
            [],
            false,
            'image/png'
          );
        } else {
          stream = await analyzeImageStreaming(languageAwarePrompt, images[0], modelToUse, 'image/png', clinicalContext);
        }
      }
      
      return handleStreamingResponse(stream);
    }

    const results: string[] = [];

    // Анализируем каждое изображение (страницу PDF)
    for (let i = 0; i < images.length; i++) {
      const imageBase64 = images[i];
      const pagePrompt = i === 0 
        ? appendLanguageInstruction(
            `${normalizedPrompt}\n\nThis is page ${i + 1} of ${images.length} from a laboratory report. Analyze the image and extract all laboratory markers, values, units, and reference ranges.`,
            responseLanguageInstruction
          )
        : appendLanguageInstruction(
            `Continuation of laboratory report analysis. Page ${i + 1} of ${images.length}. Extract all laboratory markers, values, units, and reference ranges.`,
            responseLanguageInstruction
          );
      
      try {
        console.log(`🖼️ [LAB IMAGES] Анализ страницы ${i + 1}/${images.length} в режиме ${mode} (${modelToUse})...`);
        
        const pageResult = await analyzeImage({
          prompt: pagePrompt,
          imageBase64: imageBase64,
          model: modelToUse, // Передаем модель явно
          clinicalContext: i === 0 ? clinicalContext : undefined
        });
        
        results.push(`\n\n=== Страница ${i + 1} ===\n${pageResult}`);
        console.log(`✅ [LAB IMAGES] Страница ${i + 1} проанализирована`);
      } catch (pageError: any) {
        console.error(`❌ [LAB IMAGES] Ошибка анализа страницы ${i + 1}:`, pageError);
        results.push(`\n\n=== Страница ${i + 1} ===\nОшибка анализа: ${pageError.message}`);
      }
    }

    // Если страниц несколько, объединяем результаты
    let finalResult = results.join('\n');
    
    if (images.length > 1 || results.length > 0) {
      console.log(`📊 [LAB IMAGES] Финальное структурирование через ${modelToUse}...`);
      // Запрашиваем финальную структуризацию всех страниц
      let structuredPrompt = appendLanguageInstruction(
        `Merge and structure data from all pages of the laboratory report:\n\n${finalResult}\n\nCreate one structured report with all markers, values, units, and reference ranges.`,
        responseLanguageInstruction
      );
      
      if (clinicalContext) {
        structuredPrompt = `${structuredPrompt}\n\n=== PATIENT CLINICAL CONTEXT ===\n${clinicalContext}`;
      }
      
      if (useStreaming) {
        const stream = await sendTextRequestStreaming(structuredPrompt, [], modelToUse);
        return handleStreamingResponse(stream);
      }

      finalResult = await sendTextRequest(structuredPrompt, [], modelToUse);
    }

    console.log('✅ [LAB IMAGES] Анализ завершен успешно');

    return NextResponse.json({
      success: true,
      result: finalResult,
      cost: images.length * (mode === 'fast' ? 0.3 : (mode === 'optimized' ? 0.6 : 1.2))
    });
  } catch (error: any) {
    console.error('❌ [LAB IMAGES] Общая ошибка:', error);
    return NextResponse.json(
      { success: false, error: 'Lab image analysis error' },
      { status: 500 }
    );
  }
}

