import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage } from '@/lib/openrouter';

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

    // Вызов OpenRouter API напрямую (используем ту же логику, что и Python)
    const result = await analyzeImage({
      prompt,
      imageBase64: base64Image,
    });

    console.log('Analysis completed, result length:', result.length);

    return NextResponse.json({
      success: true,
      result: result,
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

