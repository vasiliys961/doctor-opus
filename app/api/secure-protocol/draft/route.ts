import { NextRequest, NextResponse } from 'next/server';
import { buildLocalDraft } from '@/lib/secure-protocol/draft-builder';

const STT_SERVICE_URL = process.env.STT_SERVICE_URL || 'http://localhost:8000';
const STT_TIMEOUT_MS = Number(process.env.STT_TIMEOUT_MS || 90000);

/**
 * Secure Protocol Mode — построение локального черновика (жалобы/анамнез) из транскрипта.
 *
 * Параллельный модуль: не затрагивает существующие маршруты.
 * Транскрипт обезличивается до отправки в модель (Gemini Flash).
 * Диагноз/обследование/лечение здесь НЕ формируются.
 *
 * Включается флагом SECURE_HYBRID_MODE (по умолчанию включён; отключить = "false").
 */
export async function POST(request: NextRequest) {
  if (process.env.SECURE_HYBRID_MODE === 'false') {
    return NextResponse.json(
      { success: false, error: 'Secure Hybrid Mode отключён' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const transcript = String(body?.transcript ?? '');

    if (!transcript.trim()) {
      return NextResponse.json(
        { success: false, error: 'Транскрипт не предоставлен' },
        { status: 400 }
      );
    }

    try {
      const result = await buildLocalDraft(transcript);
      return NextResponse.json({
        success: true,
        draft: result.draft,
        redactedTranscript: result.redactedTranscript,
        model: result.model,
      });
    } catch {
      // Fallback: если Next.js среда не может сходить в OpenRouter,
      // используем уже рабочий stt-service /draft (как на localhost:8000).
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), STT_TIMEOUT_MS);
      try {
        const response = await fetch(`${STT_SERVICE_URL}/draft`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript }),
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.success) {
          throw new Error(data?.detail || data?.error || 'Ошибка fallback-черновика');
        }
        return NextResponse.json({
          success: true,
          draft: data.draft,
          redactedTranscript: data.redactedTranscript,
          model: data.model || 'stt-service-fallback',
        });
      } finally {
        clearTimeout(timeout);
      }
    }
  } catch (error: any) {
    const message =
      typeof error?.message === 'string' && error.message.trim()
        ? error.message
        : 'Ошибка формирования черновика';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
