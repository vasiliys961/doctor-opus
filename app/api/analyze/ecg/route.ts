import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage } from '@/lib/openrouter';
import { analyzeImageStreaming } from '@/lib/openrouter-streaming';

/**
 * API endpoint для анализа ЭКГ
 * Использует OpenRouter API напрямую
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const prompt = formData.get('prompt') as string || 'Проанализируйте ЭКГ. Опишите ритм, интервалы, сегменты, признаки ишемии, аритмии, блокады.';
    const useStreaming = formData.get('useStreaming') === 'true';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log('📈 [ECG ANALYSIS] Начало анализа ЭКГ');
    console.log('  - Файл:', file.name, file.size, 'байт');
    console.log('  - Промпт:', prompt.substring(0, 150) + '...');
    console.log('  - Streaming:', useStreaming);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');

    console.log('  - Изображение конвертировано в base64, размер:', base64Image.length);
    console.log('🎯 [ECG ANALYSIS] Используется модель: Opus 4.5 (точный анализ)');

    // ЭКГ всегда анализируется через Opus для максимальной точности
    const modelUsed = 'anthropic/claude-opus-4.5';

    if (useStreaming) {
      console.log('📡 [ECG STREAMING] Запуск streaming анализа');
      const stream = await analyzeImageStreaming(prompt, base64Image, modelUsed);
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    const result = await analyzeImage({
      prompt,
      imageBase64: base64Image,
      mode: 'precise',
    });

    console.log('✅ [ECG ANALYSIS] Анализ завершён:');
    console.log('  - Модель:', modelUsed);
    console.log('  - Длина ответа:', result.length, 'символов');

    return NextResponse.json({
      success: true,
      result: result,
      model: modelUsed,
    });
  } catch (error: any) {
    console.error('❌ [ECG ANALYSIS] Ошибка:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

