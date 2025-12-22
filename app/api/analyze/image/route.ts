import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage } from '@/lib/openrouter';

/**
 * API endpoint для анализа медицинских изображений
 * Использует OpenRouter API напрямую (как Python модули)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const prompt = formData.get('prompt') as string || 'Проанализируйте медицинское изображение.';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Конвертация файла в base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');

    // Вызов OpenRouter API напрямую (используем ту же логику, что и Python)
    const result = await analyzeImage({
      prompt,
      imageBase64: base64Image,
    });

    return NextResponse.json({
      success: true,
      result: result,
    });
  } catch (error: any) {
    console.error('Error analyzing image:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

