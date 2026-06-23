import { NextRequest, NextResponse } from 'next/server';

/**
 * Secure Protocol Mode — прокси к локальному STT-сервису на Whisper (faster-whisper).
 *
 * Зачем прокси: браузер не может обращаться к Whisper-сервису напрямую (другой порт → CORS).
 * Здесь запрос идёт сервер-серверно, поэтому в браузере всё остаётся same-origin.
 *
 * Параллельный модуль: НЕ затрагивает основной /api/transcribe (AssemblyAI остаётся для ручного потока).
 * Адрес Whisper-сервиса берётся из server-env STT_SERVICE_URL (дефолт http://localhost:8000).
 *
 * Включается флагом SECURE_HYBRID_MODE (по умолчанию включён; отключить = "false").
 */
export const runtime = 'nodejs';
// Whisper в batch-режиме на CPU может обрабатывать длинную запись долго.
export const maxDuration = 300;

const STT_SERVICE_URL = process.env.STT_SERVICE_URL || 'http://localhost:8000';
const STT_TIMEOUT_MS = Number(process.env.STT_TIMEOUT_MS || 280_000);

export async function POST(request: NextRequest) {
  if (process.env.SECURE_HYBRID_MODE === 'false') {
    return NextResponse.json(
      { success: false, error: 'Secure Hybrid Mode отключён' },
      { status: 403 }
    );
  }

  let file: File | null = null;
  try {
    const incoming = await request.formData();
    const candidate = incoming.get('file');
    if (candidate instanceof File) file = candidate;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Не удалось прочитать аудиоданные' },
      { status: 400 }
    );
  }

  if (!file) {
    return NextResponse.json(
      { success: false, error: 'Аудиофайл не предоставлен' },
      { status: 400 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STT_TIMEOUT_MS);

  try {
    const forward = new FormData();
    forward.append('file', file, file.name || 'recording.webm');

    const res = await fetch(`${STT_SERVICE_URL}/transcribe`, {
      method: 'POST',
      body: forward,
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.success) {
      return NextResponse.json(
        { success: false, error: data?.detail || data?.error || 'Ошибка распознавания Whisper' },
        { status: res.status || 502 }
      );
    }

    // Нормализуем поле: STT-сервис возвращает text, приложение ожидает transcript.
    return NextResponse.json({
      success: true,
      transcript: data.text || '',
      segments: data.segments || [],
      language: data.language,
      duration: data.duration,
      realtimeFactor: data.realtime_factor,
      model: data.model,
    });
  } catch (error: any) {
    const aborted = error?.name === 'AbortError';
    return NextResponse.json(
      {
        success: false,
        error: aborted
          ? 'STT-сервис не ответил вовремя (слишком длинная запись или сервис недоступен)'
          : `STT-сервис недоступен по адресу ${STT_SERVICE_URL}`,
      },
      { status: aborted ? 504 : 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
