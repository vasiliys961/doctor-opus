import { NextRequest, NextResponse } from 'next/server';
import { analyzeVideoTwoStage } from '@/lib/video';
import { calculateCost } from '@/lib/cost-calculator';
import { anonymizeText } from '@/lib/anonymization';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { checkAndDeductBalance } from '@/lib/server-billing';
import { getLlmApiKey } from '@/lib/llm-provider';
import { appendLanguageInstruction, getForcedLanguageInstructionForRequest } from '@/lib/i18n/llm-response-language';

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
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Необходима авторизация' },
        { status: 401 }
      );
    }

    try {
      getLlmApiKey();
    } catch {
      console.error('LLM API key is not configured');
      return NextResponse.json(
        {
          success: false,
          error: 'LLM_API_KEY (or OPENROUTER_API_KEY) is not configured. Проверьте .env.local.',
        },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const responseLanguageInstruction = await getForcedLanguageInstructionForRequest();
    const file = formData.get('file') as File | null;
    const rawPrompt = (formData.get('prompt') as string | null) || undefined;
    const rawAdditionalContext = formData.get('additionalContext') as string | null;
    
    // Анонимизация текстовых данных
    const prompt = rawPrompt ? anonymizeText(rawPrompt) : undefined;
    const languageAwarePrompt = appendLanguageInstruction(
      prompt || 'Analyze this medical video study and produce a clinically actionable conclusion.',
      responseLanguageInstruction
    );
    const additionalContext = rawAdditionalContext ? anonymizeText(rawAdditionalContext) : null;
    
    const imageType = (formData.get('imageType') as any) || 'universal';
    const patientAge = formData.get('patientAge') as string | null;
    const specialty = formData.get('specialty') as string | null;
    const urgency = formData.get('urgency') as string | null;

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

    // Обязательная серверная проверка баланса перед запуском тяжелого анализа видео.
    const estimatedCost = Number(
      Math.min(20, Math.max(4, 4 + (file.size / (20 * 1024 * 1024)) * 2)).toFixed(2)
    );
    const billing = await checkAndDeductBalance(
      session.user.email,
      estimatedCost,
      'Video analysis',
      { mode: 'video', fileSize: file.size, mimeType: file.type || null }
    );
    if (!billing.allowed) {
      return NextResponse.json(
        { success: false, error: billing.error || 'Insufficient balance' },
        { status: 402 }
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
    
    if (rawPrompt && rawPrompt !== prompt) {
      console.log('🛡️ [VIDEO API] Текст анонимизирован (промпт)');
    }
    if (rawAdditionalContext && rawAdditionalContext !== additionalContext) {
      console.log('🛡️ [VIDEO API] Текст анонимизирован (доп. контекст)');
    }

    const { description, analysis, usage } = await analyzeVideoTwoStage({
      prompt: languageAwarePrompt,
      videoBase64,
      mimeType,
      imageType,
      metadata: Object.keys(metadata).length ? metadata : undefined,
    });

    // Рассчитываем стоимость
    let cost = 0;
    const model = 'google/gemini-3.8-flash';
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

    if (message.includes('OPENROUTER_API_KEY') || message.includes('LLM_API_KEY')) {
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




