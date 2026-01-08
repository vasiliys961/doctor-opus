import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint для отправки обратной связи от врачей
 * Проксирует запрос к Python-бэкенду для сохранения в БД
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // URL Python API. В разработке обычно http://localhost:3000/api/python/...
    // В продакшене Vercel сам разруливает пути.
    const pythonApiUrl = process.env.PYTHON_API_URL || 
                         (process.env.NODE_ENV === 'development' 
                           ? 'http://localhost:3000' 
                           : '');

    const response = await fetch(`${pythonApiUrl}/api/python/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Python API Error:', errorText);
      throw new Error(`Python API responded with status: ${response.status}`);
    }

    const result = await response.json();

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in feedback API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}






