import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getLlmApiKey, getLlmBaseUrl } from '@/lib/llm-provider';

export const runtime = 'nodejs';

const DEFAULT_TTS_MODEL = 'openai/gpt-4o-mini-tts';
const DEFAULT_TTS_VOICE = 'alloy';
const DEFAULT_TTS_SPEED = 0.95;
const MAX_TTS_TEXT_CHARS = 2500;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Необходима авторизация' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const inputRaw = String(body?.text || body?.input || '').trim();
    if (!inputRaw) {
      return NextResponse.json({ success: false, error: 'Пустой текст для озвучивания' }, { status: 400 });
    }

    const input = inputRaw.slice(0, MAX_TTS_TEXT_CHARS);
    const model = String(body?.model || process.env.TTS_MODEL || DEFAULT_TTS_MODEL);
    const voice = String(body?.voice || process.env.TTS_VOICE || DEFAULT_TTS_VOICE);
    const speed = Number(body?.speed || process.env.TTS_SPEED || DEFAULT_TTS_SPEED);

    const baseUrl = getLlmBaseUrl();
    const apiKey = getLlmApiKey();

    const response = await fetch(`${baseUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        voice,
        input,
        speed: Number.isFinite(speed) ? speed : DEFAULT_TTS_SPEED,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { success: false, error: `TTS provider error: ${response.status} - ${errorText.slice(0, 300)}` },
        { status: 502 }
      );
    }

    const contentType = response.headers.get('content-type') || '';

    // OpenAI-compatible провайдеры обычно отдают бинарный mp3.
    // Polza для части моделей возвращает JSON с base64 в поле "audio".
    if (contentType.includes('application/json')) {
      const payload = await response.json().catch(() => null);
      const audioField = payload?.audio;
      if (typeof audioField !== 'string' || !audioField.trim()) {
        return NextResponse.json(
          { success: false, error: 'TTS provider returned JSON without audio payload' },
          { status: 502 }
        );
      }

      const base64 = audioField.includes(',')
        ? audioField.split(',').pop() || ''
        : audioField;
      const audioBuffer = Buffer.from(base64, 'base64');
      if (!audioBuffer.length) {
        return NextResponse.json(
          { success: false, error: 'TTS provider returned invalid base64 audio' },
          { status: 502 }
        );
      }

      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'no-store',
        },
      });
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': contentType || 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Ошибка TTS' },
      { status: 500 }
    );
  }
}

