import { NextRequest, NextResponse } from 'next/server';
import { sendTextRequest, MODELS } from '@/lib/openrouter';
import { sendTextRequestStreaming, sendAcademicSearchStreaming } from '@/lib/openrouter-streaming';
import { sendTextRequestWithFiles, sendTextRequestStreamingWithFiles } from '@/lib/openrouter-files';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { anonymizeText, anonymizeObject } from '@/lib/anonymization';

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
    let specialty: string | undefined;
    let systemPrompt: string | undefined;

    // Проверяем, является ли запрос FormData (с файлами) или JSON
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      message = anonymizeText((formData.get('message') as string) || '');
      specialty = formData.get('specialty') as string | undefined;
      systemPrompt = formData.get('systemPrompt') as string | undefined;
      const historyStr = formData.get('history') as string;
      if (historyStr) {
        try {
          history = anonymizeObject(JSON.parse(historyStr));
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
      message = anonymizeText(body.message || body.prompt || '');
      history = anonymizeObject(body.history || []);
      useStreaming = body.useStreaming !== undefined ? body.useStreaming : true; // Default to true for chat
      model = body.model;
      specialty = body.specialty;
      systemPrompt = body.systemPrompt;
    }

    const selectedModel = (model === 'gpt52' || model === MODELS.GPT_5_2)
      ? MODELS.GPT_5_2
      : (model === 'sonnet' || model === MODELS.SONNET) 
        ? MODELS.SONNET 
        : (model && (model === 'gemini' || model.includes('gemini')))
          ? MODELS.GEMINI_3_FLASH
          : MODELS.OPUS;

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
      const { formatCostLog } = await import('@/lib/cost-calculator');
      
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
        const stream = await sendTextRequestStreamingWithFiles(message, formattedHistory, files, selectedModel, specialty as any);
        return handleStreaming(stream);
      } else {
        const result = await sendTextRequestWithFiles(message, formattedHistory, files, selectedModel, specialty as any);
        const { calculateCost } = await import('@/lib/cost-calculator');
        const costInfo = calculateCost(2000, 1500, selectedModel); // Оценочно для non-streaming
        
        return NextResponse.json({
          success: true,
          result: result,
          cost: costInfo.totalCostUnits,
          model: selectedModel
        });
      }
    }

    // Если запрошен streaming без файлов, возвращаем поток
    if (useStreaming) {
      const stream = await sendTextRequestStreaming(message, formattedHistory, selectedModel, specialty as any, systemPrompt);
      return handleStreaming(stream);
    }

    // Обычный режим - полный ответ
    console.log('🚀 [CHAT API] Начало запроса к OpenRouter...');
    const result = await sendTextRequest(message, formattedHistory, selectedModel, specialty as any);
    console.log('✅ [CHAT API] Ответ от OpenRouter получен успешно.');
    
    const { calculateCost } = await import('@/lib/cost-calculator');
    const costInfo = calculateCost(1000, 1000, selectedModel);

    return NextResponse.json({
      success: true,
      result: result,
      cost: costInfo.totalCostUnits,
      model: selectedModel
    });
  } catch (error: any) {
    console.error('🔴 [CHAT API ERROR]:', error);
    // Выводим стек ошибки для точного понимания места падения
    console.error('🔴 [STACK]:', error.stack);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

