import { NextRequest, NextResponse } from 'next/server';
import { analyzeTwoVideosTwoStage } from '@/lib/video';
import { calculateCost } from '@/lib/cost-calculator';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'OPENROUTER_API_KEY не настроен' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const video1 = formData.get('video1') as File | null;
    const video2 = formData.get('video2') as File | null;
    const prompt = (formData.get('prompt') as string | null) || undefined;

    if (!video1 || !video2) {
      return NextResponse.json(
        { success: false, error: 'Необходимо два видео-файла для сравнения' },
        { status: 400 }
      );
    }

    // Ограничение размера для каждого видео (50MB, чтобы не перегружать контекст)
    const maxSizeBytes = 50 * 1024 * 1024;
    if (video1.size > maxSizeBytes || video2.size > maxSizeBytes) {
      return NextResponse.json(
        { success: false, error: 'Каждое видео не должно превышать 50MB' },
        { status: 400 }
      );
    }

    const buffer1 = Buffer.from(await video1.arrayBuffer());
    const buffer2 = Buffer.from(await video2.arrayBuffer());

    const { description, analysis, usage } = await analyzeTwoVideosTwoStage({
      prompt,
      video1Base64: buffer1.toString('base64'),
      video2Base64: buffer2.toString('base64'),
      mimeType1: video1.type,
      mimeType2: video2.type,
    });

    const model = 'google/gemini-3-flash-preview';
    let cost = 0;
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
    console.error('❌ [VIDEO COMPARISON API] Ошибка:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка сравнительного анализа видео' },
      { status: 500 }
    );
  }
}
