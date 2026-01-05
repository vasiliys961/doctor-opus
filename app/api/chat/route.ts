import { NextRequest, NextResponse } from 'next/server';
import { sendTextRequest } from '@/lib/openrouter';
import { sendTextRequestStreaming } from '@/lib/openrouter-streaming';
import { sendTextRequestWithFiles, sendTextRequestStreamingWithFiles } from '@/lib/openrouter-files';
import { formatCostLog } from '@/lib/cost-calculator';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Максимальное время выполнения запроса (5 минут)
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * API endpoint для ИИ-консультанта
 */
export async function POST(request: NextRequest) {
  try {
    // Проверка авторизации (ВРЕМЕННО ОТКЛЮЧЕНО)
    /*
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Необходима авторизация' },
        { status: 401 }
      );
    }
    */

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

    const selectedModel = (model === 'sonnet' || model === 'anthropic/claude-sonnet-4.5') 
      ? 'anthropic/claude-sonnet-4.5' 
      : (model === 'gemini' || model.includes('gemini'))
        ? 'google/gemini-3-flash-preview'
        : 'anthropic/claude-opus-4.5';

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

    // Обработка стриминга с логированием
    const handleStreaming = async (stream: ReadableStream) => {
      const decoder = new TextDecoder();
      
      const transformStream = new TransformStream({
        transform(chunk, controller) {
          // Сразу пробрасываем для минимизации задержек
          controller.enqueue(chunk);
          
          const text = decoder.decode(chunk, { stream: true });
          
          // Ищем статистику использования
          if (text.includes('"usage":')) {
            const lines = text.split('\n');
            for (const line of lines) {
              if (line.includes('"usage":')) {
                try {
                  const jsonStr = line.startsWith('data: ') ? line.slice(6).trim() : line.trim();
                  if (jsonStr === '[DONE]') continue;
                  const data = JSON.parse(jsonStr);
                  if (data.usage) {
                    console.log(formatCostLog(
                      selectedModel,
                      data.usage.prompt_tokens,
                      data.usage.completion_tokens,
                      data.usage.total_tokens
                    ));
                  }
                } catch (e) {}
              }
            }
          }
        }
      });

      return new Response(stream.pipeThrough(transformStream), {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          'Content-Encoding': 'none',
        },
      });
    };

    // Если есть файлы, используем функции с поддержкой файлов
    if (files.length > 0) {
      if (useStreaming) {
        const stream = await sendTextRequestStreamingWithFiles(message, formattedHistory, files, selectedModel);
        return handleStreaming(stream);
      } else {
        const result = await sendTextRequestWithFiles(message, formattedHistory, files, selectedModel);
        return NextResponse.json({
          success: true,
          result: result,
        });
      }
    }

    // Если запрошен streaming без файлов, возвращаем поток
    if (useStreaming) {
      const stream = await sendTextRequestStreaming(message, formattedHistory, selectedModel);
      return handleStreaming(stream);
    }

    // Обычный режим - полный ответ
    const result = await sendTextRequest(message, formattedHistory, selectedModel);

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

