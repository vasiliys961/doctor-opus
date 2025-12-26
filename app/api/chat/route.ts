import { NextRequest, NextResponse } from 'next/server';
import { sendTextRequest } from '@/lib/openrouter';
import { sendTextRequestStreaming } from '@/lib/openrouter-streaming';
import { sendTextRequestWithFiles, sendTextRequestStreamingWithFiles } from '@/lib/openrouter-files';

/**
 * API endpoint для ИИ-консультанта
 * Поддерживает обычный режим, streaming и загрузку файлов
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    let message: string;
    let history: any[] = [];
    let useStreaming = false;
    let model: string | undefined;
    let files: File[] = [];

    // Проверяем, является ли запрос FormData (с файлами) или JSON
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      message = (formData.get('message') as string) || '';
      const historyStr = formData.get('history') as string;
      if (historyStr) {
        try {
          history = JSON.parse(historyStr);
        } catch (e) {
          console.warn('Failed to parse history:', e);
        }
      }
      useStreaming = formData.get('useStreaming') === 'true';
      model = formData.get('model') as string | undefined;
      
      // Получаем файлы
      const fileEntries = formData.getAll('files') as File[];
      files = fileEntries.filter(f => f instanceof File && f.size > 0);
    } else {
      const body = await request.json();
      message = body.message || '';
      history = body.history || [];
      useStreaming = body.useStreaming || false;
      model = body.model;
    }

    if (!message && files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No message or files provided' },
        { status: 400 }
      );
    }

    // Формируем историю для контекста
    const formattedHistory = history.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    // Если есть файлы, используем функции с поддержкой файлов
    if (files.length > 0) {
      if (useStreaming) {
        const stream = await sendTextRequestStreamingWithFiles(message, formattedHistory, files, model);
        
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      } else {
        const result = await sendTextRequestWithFiles(message, formattedHistory, files, model);
        return NextResponse.json({
          success: true,
          result: result,
        });
      }
    }

    // Если запрошен streaming без файлов, возвращаем поток
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

