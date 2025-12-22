import { NextRequest, NextResponse } from 'next/server';
import { sendTextRequest } from '@/lib/openrouter';
import { sendTextRequestStreaming } from '@/lib/openrouter-streaming';

/**
 * API endpoint для ИИ-консультанта
 * Поддерживает обычный режим и streaming
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history = [], useStreaming = false, model } = body;

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

    // Если запрошен streaming, возвращаем поток
    if (useStreaming) {
      const stream = await sendTextRequestStreaming(message, formattedHistory, model);
      
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Обычный режим - полный ответ
    const result = await sendTextRequest(message, formattedHistory, model);

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

