import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { anonymizeText } from '@/lib/anonymization';
import { checkRateLimit, getRateLimitKey, type RateLimitConfig } from '@/lib/rate-limiter';
import { classifyChatComplexity } from '@/lib/chat-triage';

export const dynamic = 'force-dynamic';

// Отдельный, более щедрый лимит: это дешёвый вспомогательный вызов (Gemini 3 Flash,
// доли цента), который может срабатывать чаще, чем основной чат (по мере набора текста).
const RATE_LIMIT_TRIAGE: RateLimitConfig = { limit: 30, windowSec: 60 };

/**
 * Лёгкий triage-классификатор сложности кейса (без биллинга — стоимость
 * пренебрежимо мала, а решение остаётся полностью за врачом: это только совет).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Необходима авторизация' }, { status: 401 });
    }

    const rlKey = getRateLimitKey(request, session.user.email);
    const rl = checkRateLimit(`triage:${rlKey}`, RATE_LIMIT_TRIAGE);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Превышен лимит запросов триажа' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const text = anonymizeText(String(body?.text || ''));
    if (!text.trim()) {
      return NextResponse.json({ success: false, error: 'Пустой текст для триажа' }, { status: 400 });
    }

    const result = await classifyChatComplexity(text);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Ошибка триажа сложности' },
      { status: 500 }
    );
  }
}
