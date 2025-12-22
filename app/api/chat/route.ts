import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint для ИИ-консультанта
 * Вызывает Python serverless function с существующей логикой
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history = [] } = body;

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'No message provided' },
        { status: 400 }
      );
    }

    // Вызов Python serverless function
    const pythonResponse = await fetch(`${process.env.PYTHON_API_URL || 'http://localhost:3000'}/api/python/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        history,
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
    console.error('Error in chat:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

