import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage, sendTextRequest } from '@/lib/openrouter';

/**
 * API endpoint для анализа лабораторных данных
 * Использует OpenRouter API напрямую
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const prompt = formData.get('prompt') as string || 'Проанализируйте лабораторные данные. Извлеките все показатели, их значения и референсные диапазоны.';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Если это изображение - используем vision API
    if (file.type.startsWith('image/')) {
      const base64Image = buffer.toString('base64');
      const result = await analyzeImage({
        prompt,
        imageBase64: base64Image,
      });
      
      return NextResponse.json({
        success: true,
        result: result,
      });
    } else {
      // Для текстовых файлов (PDF, CSV и т.д.) - используем text API
      const textContent = buffer.toString('utf-8', 0, Math.min(buffer.length, 100000)); // Ограничение размера
      const result = await sendTextRequest(`${prompt}\n\nДанные:\n${textContent}`);
      
      return NextResponse.json({
        success: true,
        result: result,
      });
    }
  } catch (error: any) {
    console.error('Error analyzing lab data:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

