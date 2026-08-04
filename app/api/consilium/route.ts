import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { anonymizeText } from '@/lib/anonymization';
import { checkRateLimit, getRateLimitKey, RATE_LIMIT_CHAT } from '@/lib/rate-limiter';
import { runConsilium } from '@/lib/consilium/orchestrator';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Authorization required' }, { status: 401 });
    }

    const rlKey = getRateLimitKey(request, session.user.email);
    const rl = checkRateLimit(rlKey, RATE_LIMIT_CHAT);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Please wait.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }

    const body = await request.json();
    const caseText = anonymizeText(String(body?.caseText || '').trim());
    const modality = typeof body?.modality === 'string' ? body.modality : undefined;
    const useRagGate = typeof body?.useRagGate === 'boolean' ? body.useRagGate : undefined;
    const maxPubmedSources = Number(body?.maxPubmedSources || 5);

    if (!caseText) {
      return NextResponse.json({ success: false, error: 'caseText is required' }, { status: 400 });
    }

    const result = await runConsilium({
      caseText,
      modality,
      useRagGate,
      maxPubmedSources,
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Consilium request failed' },
      { status: 500 }
    );
  }
}
