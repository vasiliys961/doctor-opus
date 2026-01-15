import { NextRequest, NextResponse } from 'next/server';
import { analyzeVideoTwoStage } from '@/lib/video';
import { calculateCost } from '@/lib/cost-calculator';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Максимальное время выполнения для тяжелых видео (5 минут)
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * API endpoint для анализа медицинских видео
 * Использует OpenRouter (Gemini 3.0 + Gemini 3.0) для двухэтапного анализа:
 * 1) Описание видео (структурированное, без диагноза)
 * 2) Клиническое заключение по этому описанию
 */
export async function POST(request: NextRequest) {
  try {
    // ... (код проверки API ключа и файла остается прежним)
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('OPENROUTER_API_KEY не найден в переменных окружения');
      return NextResponse.json(
        {
          success: false,
          error: 'OPENROUTER_API_KEY не настроен. Проверьте .env.local.',
        },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const prompt = (formData.get('prompt') as string | null) || undefined;
    const imageType = (formData.get('imageType') as any) || 'universal';
    const patientAge = formData.get('patientAge') as string | null;
    const specialty = formData.get('specialty') as string | null;
    const urgency = formData.get('urgency') as string | null;
    const additionalContext = formData.get('additionalContext') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Видео-файл не передан' },
        { status: 400 },
      );
    }

    // Ограничение размера (100MB, как в Python-клиенте)
    const maxSizeBytes = 100 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        {
          success: false,
          error: `Размер видео превышает 100MB (${(file.size / 1024 / 1024).toFixed(
            1,
          )}MB)`,
        },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const videoBase64 = buffer.toString('base64');

    // Определяем MIME‑тип
    let mimeType = file.type || 'video/mp4';
    if (!file.type && file.name) {
      const name = file.name.toLowerCase();
      if (name.endsWith('.mov')) mimeType = 'video/quicktime';
      else if (name.endsWith('.avi')) mimeType = 'video/x-msvideo';
      else if (name.endsWith('.webm')) mimeType = 'video/webm';
      else if (name.endsWith('.mkv')) mimeType = 'video/x-matroska';
    }

    const metadata: Record<string, any> = {};
    if (patientAge) metadata.patient_age = patientAge;
    if (specialty) metadata.specialty = specialty;
    if (urgency) metadata.urgency = urgency;
    if (additionalContext) metadata.additional_context = additionalContext;

    console.log('📡 [VIDEO API] Получен запрос на анализ видео:', {
      fileName: file.name,
      fileSize: file.size,
      mimeType,
      hasPrompt: !!prompt,
      imageType,
    });

    const { description, analysis, usage } = await analyzeVideoTwoStage({
      prompt: prompt || undefined,
      videoBase64,
      mimeType,
      imageType,
      metadata: Object.keys(metadata).length ? metadata : undefined,
    });

    // Рассчитываем стоимость
    let cost = 0;
    const model = 'google/gemini-3-flash-preview';
    if (usage) {
      const costInfo = calculateCost(usage.prompt_tokens, usage.completion_tokens, model);
      cost = costInfo.totalCostUnits;
    }

    return NextResponse.json({
      success: true,
      description,
      analysis,
      cost,
      usage,
      model,
    });
  } catch (error: any) {
    console.error('❌ [VIDEO API] Ошибка анализа видео:', error);

    const message = error?.message || 'Internal server error';
    let status = 500;

    if (message.includes('OPENROUTER_API_KEY')) {
      status = 500;
    } else if (message.includes('network') || message.includes('fetch failed')) {
      status = 503;
    } else if (message.includes('timeout') || message.includes('Timeout')) {
      status = 504;
    }

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status },
    );
  }
}




