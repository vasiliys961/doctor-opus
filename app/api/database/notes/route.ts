import { NextRequest, NextResponse } from 'next/server';

/**
 * API endpoint для работы с медицинскими записями
 * Использует Python для работы с БД (SQLite или PostgreSQL)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Вызов Python serverless function для работы с БД
    const pythonResponse = await fetch(`${process.env.PYTHON_API_URL || 'http://localhost:3000'}/api/python/database/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!pythonResponse.ok) {
      throw new Error('Database API error');
    }

    const result = await pythonResponse.json();

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error saving note:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patient_id');

    // Вызов Python serverless function
    const pythonResponse = await fetch(`${process.env.PYTHON_API_URL || 'http://localhost:3000'}/api/python/database/notes?patient_id=${patientId || ''}`, {
      method: 'GET',
    });

    if (!pythonResponse.ok) {
      throw new Error('Database API error');
    }

    const result = await pythonResponse.json();

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error fetching notes:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

