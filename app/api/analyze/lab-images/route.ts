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
    const { images, prompt, clinicalContext, mode, useStreaming, model } = body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No images provided' },
        { status: 400 }
      );
    }

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

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'OPENROUTER_API_KEY is not configured' },
        { status: 500 }
      );
    }

    // Определение модели на основе режима или прямого указания
    let modelToUse = model || MODELS.GEMINI_3_FLASH;
    if (!model) {
      if (mode === 'optimized') modelToUse = MODELS.SONNET;
      else if (mode === 'validated') modelToUse = MODELS.OPUS;
    }

    console.log(`🔬 [LAB IMAGES] Получено ${images.length} изображений для анализа, режим: ${mode}, модель: ${modelToUse}, streaming: ${useStreaming}`);

    // Если запрошен стриминг
    if (useStreaming) {
      console.log(`📡 [LAB IMAGES] Запуск стриминга (${images.length} изображений)...`);
      let stream: ReadableStream;
      
      if (images.length > 1) {
        if (mode === 'optimized') {
          stream = await analyzeMultipleImagesOpusTwoStageStreaming(prompt, images, 'lab', clinicalContext, images.map(() => 'image/png'), modelToUse);
        } else if (mode === 'validated') {
          stream = await analyzeMultipleImagesWithJSONStreaming(prompt, images, 'lab', clinicalContext, images.map(() => 'image/png'), undefined, modelToUse);
        } else {
          stream = await analyzeMultipleImagesStreaming(prompt, images, images.map(() => 'image/png'), modelToUse, clinicalContext);
        }
      } else {
        // Одиночное изображение
        if (mode === 'optimized' || mode === 'validated') {
          stream = await analyzeImageOpusTwoStageStreaming(
            prompt,
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
          stream = await analyzeImageStreaming(prompt, images[0], modelToUse, 'image/png', clinicalContext);
        }
      }
      
      return handleStreamingResponse(stream);
    }

    const results: string[] = [];

    // Анализируем каждое изображение (страницу PDF)
    for (let i = 0; i < images.length; i++) {
      const imageBase64 = images[i];
      const pagePrompt = i === 0 
        ? `${prompt}\n\nЭто страница ${i + 1} из ${images.length} лабораторного отчета. Проанализируйте изображение и извлеките все лабораторные показатели, их значения, единицы измерения и референсные диапазоны.`
        : `Продолжение анализа лабораторного отчета. Страница ${i + 1} из ${images.length}. Извлеките все лабораторные показатели, их значения, единицы измерения и референсные диапазоны.`;
      
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
      let structuredPrompt = `Объедини и структурируй данные из всех страниц лабораторного отчета:\n\n${finalResult}\n\nСоздай единый структурированный отчет со всеми показателями, их значениями, единицами измерения и референсными диапазонами.`;
      
      if (clinicalContext) {
        structuredPrompt = `${structuredPrompt}\n\n=== КЛИНИЧЕСКИЙ КОНТЕКСТ ПАЦИЕНТА ===\n${clinicalContext}`;
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

