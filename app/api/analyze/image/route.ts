import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage, analyzeImageFast } from '@/lib/openrouter';

/**
 * API endpoint для анализа медицинских изображений
 * Использует OpenRouter API напрямую (как Python модули)
 */
export async function POST(request: NextRequest) {
  try {
    // Проверяем переменные окружения
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('OPENROUTER_API_KEY не найден в переменных окружения');
      return NextResponse.json(
        { success: false, error: 'OPENROUTER_API_KEY не настроен. Проверьте настройки Vercel.' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const prompt = formData.get('prompt') as string || 'Проанализируйте медицинское изображение.';
    const mode = (formData.get('mode') as string) || 'precise'; // fast, precise, validated

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log('Processing image:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      promptLength: prompt.length
    });

    // Конвертация файла в base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');

    console.log('Image converted to base64, size:', base64Image.length);
    console.log('Analysis mode:', mode);
    console.log('Prompt:', prompt.substring(0, 200) + '...');

    // Выбор функции анализа в зависимости от режима
    let result: string;
    let modelUsed: string;
    
    if (mode === 'fast') {
      // Быстрый анализ через Gemini Flash
      console.log('🚀 [ANALYSIS] Запуск БЫСТРОГО анализа через Gemini Flash');
      modelUsed = 'google/gemini-3-flash-preview';
      result = await analyzeImageFast({
        prompt,
        imageBase64: base64Image,
      });
      console.log('✅ [ANALYSIS] Gemini Flash анализ завершён');
    } else {
      // Точный анализ через Opus
      console.log('🎯 [ANALYSIS] Запуск ТОЧНОГО анализа через Opus 4.5');
      modelUsed = 'anthropic/claude-opus-4.5';
      result = await analyzeImage({
        prompt,
        imageBase64: base64Image,
        mode: 'precise',
      });
      console.log('✅ [ANALYSIS] Opus анализ завершён');
    }

    console.log('📊 [ANALYSIS] Результат получен:');
    console.log('  - Модель:', modelUsed);
    console.log('  - Длина ответа:', result.length, 'символов');
    console.log('  - Первые 200 символов:', result.substring(0, 200));

    return NextResponse.json({
      success: true,
      result: result,
      model: modelUsed,
      mode: mode,
    });
  } catch (error: any) {
    console.error('Error analyzing image:', error);
    
    // Более детальная обработка ошибок
    let errorMessage = error.message || 'Internal server error';
    let statusCode = 500;
    
    if (error.message.includes('не настроен') || error.message.includes('не найден')) {
      statusCode = 500;
      errorMessage = 'Ошибка конфигурации: ' + errorMessage;
    } else if (error.message.includes('fetch failed') || error.message.includes('network')) {
      statusCode = 503;
      errorMessage = 'Ошибка сети. Проверьте подключение к интернету.';
    } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      statusCode = 504;
      errorMessage = 'Превышено время ожидания. Попробуйте позже.';
    }
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: statusCode }
    );
  }
}

