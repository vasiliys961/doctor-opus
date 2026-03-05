import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage } from '@/lib/openrouter';
import { analyzeImageStreaming } from '@/lib/openrouter-streaming';
import { formatCostLog } from '@/lib/cost-calculator';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { checkAndDeductBalance, checkAndDeductGuestBalance, getAnalysisCost } from '@/lib/server-billing';
import { getRateLimitKey } from '@/lib/rate-limiter';

/**
 * API endpoint для анализа ЭКГ
 * Использует OpenRouter API напрямую
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email || null;
    const guestKey = userEmail ? null : getRateLimitKey(request);

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const prompt = formData.get('prompt') as string || 'Проанализируйте ЭКГ. Опишите ритм, интервалы, сегменты, признаки ишемии, аритмии, блокады.';
    const useStreaming = formData.get('useStreaming') === 'true';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Серверная проверка и резервирование стоимости до выполнения анализа
    const estimatedCost = getAnalysisCost('optimized', 1);
    const billing = userEmail
      ? await checkAndDeductBalance(userEmail, estimatedCost, 'ECG analysis', { mode: 'optimized', imageCount: 1 })
      : await checkAndDeductGuestBalance(guestKey!, estimatedCost, 'Guest trial: ECG analysis', { mode: 'optimized', imageCount: 1 });
    if (!billing.allowed) {
      return NextResponse.json(
        { success: false, error: billing.error || 'Insufficient balance' },
        { status: 402 }
      );
    }

    console.log('📈 [ECG ANALYSIS] Начало анализа ЭКГ');
    console.log('  - Файл:', file.name, file.size, 'байт');
    console.log('  - Промпт:', prompt.substring(0, 150) + '...');
    console.log('  - Streaming:', useStreaming);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');

    console.log('  - Изображение конвертировано в base64, размер:', base64Image.length);
    console.log('🎯 [ECG ANALYSIS] Используется модель: Opus 4.6 (точный анализ)');

    // ЭКГ всегда анализируется через Opus для максимальной точности
    const modelUsed = 'anthropic/claude-opus-4.6';

    if (useStreaming) {
      console.log('📡 [ECG STREAMING] Запуск streaming анализа');
      const stream = await analyzeImageStreaming(prompt, base64Image, modelUsed);
      
      const decoder = new TextDecoder();
      const transformStream = new TransformStream({
        transform(chunk, controller) {
          const text = decoder.decode(chunk, { stream: true });
          
          if (text.includes('"usage":')) {
            const lines = text.split('\n');
            for (const line of lines) {
              if (line.includes('"usage":')) {
                try {
                  const jsonStr = line.startsWith('data: ') ? line.slice(6).trim() : line.trim();
                  const data = JSON.parse(jsonStr);
                  if (data.usage) {
                    console.log(formatCostLog(
                      modelUsed,
                      data.usage.prompt_tokens,
                      data.usage.completion_tokens,
                      data.usage.total_tokens
                    ));
                  }
                } catch (e) {}
              }
            }
          }
          controller.enqueue(chunk);
        }
      });

      return new Response(stream.pipeThrough(transformStream), {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    const result = await analyzeImage({
      prompt,
      imageBase64: base64Image,
      mode: 'optimized',
    });

    console.log('✅ [ECG ANALYSIS] Анализ завершён:');
    console.log('  - Модель:', modelUsed);
    console.log('  - Длина ответа:', result.length, 'символов');

    return NextResponse.json({
      success: true,
      result: result,
      model: modelUsed,
    });
  } catch (error: any) {
    console.error('❌ [ECG ANALYSIS] Ошибка:', error);
    return NextResponse.json(
      { success: false, error: 'ECG analysis error' },
      { status: 500 }
    );
  }
}

