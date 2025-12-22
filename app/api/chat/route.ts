import { NextRequest, NextResponse } from 'next/server';
import { sendTextRequest } from '@/lib/openrouter';

/**
 * API endpoint для ИИ-консультанта
 * Использует OpenRouter API напрямую
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

    // Формируем историю для контекста
    const formattedHistory = history.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    // Вызов OpenRouter API напрямую
    const result = await sendTextRequest(message, formattedHistory);

    return NextResponse.json({
      success: true,
      result: result,
    });
  } catch (error: any) {
    console.error('Error in chat:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

