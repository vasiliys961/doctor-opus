import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint для анализа ЭКГ
 * Вызывает Python serverless function с существующей логикой
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const prompt = formData.get('prompt') as string || 'Проанализируйте ЭКГ.';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');

    // Вызов Python serverless function
    const pythonResponse = await fetch(`${process.env.PYTHON_API_URL || 'http://localhost:3000'}/api/python/analyze/ecg`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: base64Image,
        prompt: prompt,
        filename: file.name,
      }),
    });

    if (!pythonResponse.ok) {
      throw new Error('Python API error');
    }

    const result = await pythonResponse.json();

    return NextResponse.json({
      success: true,
      result: result.result,
    });
  } catch (error: any) {
    console.error('Error analyzing ECG:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

