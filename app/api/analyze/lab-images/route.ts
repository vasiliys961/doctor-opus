import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage, sendTextRequest } from '@/lib/openrouter';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Максимальное время выполнения (5 минут)
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * API endpoint для анализа лабораторных данных из массива изображений (PDF страницы)
 * Принимает изображения в base64 и анализирует их через Vision API
 */
export async function POST(request: NextRequest) {
  try {
    // Проверка авторизации (ВРЕМЕННО ОТКЛЮЧЕНО)
    /*
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Необходима авторизация' },
        { status: 401 }
      );
    }
    */

    const body = await request.json();
    const { images, prompt, clinicalContext } = body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No images provided' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'OPENROUTER_API_KEY не настроен' },
        { status: 500 }
      );
    }

    console.log(`🔬 [LAB IMAGES] Получено ${images.length} изображений для анализа`);

    const results: string[] = [];

    // Анализируем каждое изображение (страницу PDF)
    for (let i = 0; i < images.length; i++) {
      const imageBase64 = images[i];
      const pagePrompt = i === 0 
        ? `${prompt}\n\nЭто страница ${i + 1} из ${images.length} лабораторного отчета. Проанализируйте изображение и извлеките все лабораторные показатели, их значения, единицы измерения и референсные диапазоны.`
        : `Продолжение анализа лабораторного отчета. Страница ${i + 1} из ${images.length}. Извлеките все лабораторные показатели, их значения, единицы измерения и референсные диапазоны.`;
      
      try {
        console.log(`🖼️ [LAB IMAGES] Анализ страницы ${i + 1}/${images.length} через Gemini Flash...`);
        
        const pageResult = await analyzeImage({
          prompt: pagePrompt,
          imageBase64: imageBase64,
          mode: 'fast', // Gemini Flash для быстрого анализа
          clinicalContext: i === 0 ? clinicalContext : undefined // Передаем контекст только для первой страницы
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
    
    if (images.length > 1) {
      console.log('📊 [LAB IMAGES] Структурирование данных со всех страниц...');
      // Запрашиваем финальную структуризацию всех страниц
      let structuredPrompt = `Объедини и структурируй данные из всех страниц лабораторного отчета:\n\n${finalResult}\n\nСоздай единый структурированный отчет со всеми показателями, их значениями, единицами измерения и референсными диапазонами.`;
      
      if (clinicalContext) {
        structuredPrompt = `${structuredPrompt}\n\n=== КЛИНИЧЕСКИЙ КОНТЕКСТ ПАЦИЕНТА ===\n${clinicalContext}`;
      }
      
      finalResult = await sendTextRequest(structuredPrompt);
    }

    console.log('✅ [LAB IMAGES] Анализ завершен успешно');

    return NextResponse.json({
      success: true,
      result: finalResult,
    });
  } catch (error: any) {
    console.error('❌ [LAB IMAGES] Общая ошибка:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

