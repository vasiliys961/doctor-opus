import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint для анализа лабораторных данных
 * Вызывает Python serverless function с существующей логикой
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const prompt = formData.get('prompt') as string || 'Проанализируйте лабораторные данные.';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString('base64');

    // Вызов Python serverless function
    const pythonResponse = await fetch(`${process.env.PYTHON_API_URL || 'http://localhost:3000'}/api/python/analyze/lab`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: base64Data,
        prompt: prompt,
        filename: file.name,
        fileType: file.type,
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
    console.error('Error analyzing lab data:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

