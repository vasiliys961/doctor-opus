import { NextRequest, NextResponse } from 'next/server';
import { MODELS, sendTextRequest } from '@/lib/openrouter';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { checkAndDeductBalance } from '@/lib/server-billing';

type TriageLevel = 'normal' | 'attention' | 'urgent';

type TriageResponse = {
  level: TriageLevel;
  summary: string;
  deviations: string[];
};

function safeParseJson(raw: string): any {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || raw;
  const objectMatch = candidate.match(/\{[\s\S]*\}/);
  return JSON.parse(objectMatch ? objectMatch[0] : candidate);
}

function normalizeLevel(value: unknown): TriageLevel {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'urgent' || normalized === 'срочно') return 'urgent';
  if (normalized === 'attention' || normalized === 'требует внимания') return 'attention';
  return 'normal';
}

function normalizePayload(payload: any): TriageResponse {
  const summary = String(payload?.summary || '').trim() || 'Auto-triage found no clinically significant deviations.';
  const deviations = Array.isArray(payload?.deviations)
    ? payload.deviations.map((item: unknown) => String(item || '').trim()).filter(Boolean).slice(0, 6)
    : [];

  return {
    level: normalizeLevel(payload?.level),
    summary,
    deviations,
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Authorization required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const comparisonText = String(body?.comparisonText || '').trim();
    const comparisonMode = String(body?.comparisonMode || 'general');

    if (!comparisonText) {
      return NextResponse.json({ success: false, error: 'comparisonText is required' }, { status: 400 });
    }

    const estimatedCost = Number(Math.min(3, Math.max(0.7, comparisonText.length / 2500)).toFixed(2));
    const billing = await checkAndDeductBalance(
      session.user.email,
      estimatedCost,
      'Comparative triage',
      { comparisonMode, textLength: comparisonText.length, model: MODELS.GEMINI_3_FLASH }
    );
    if (!billing.allowed) {
      return NextResponse.json(
        { success: false, error: billing.error || 'Insufficient balance' },
        { status: 402 }
      );
    }

    const systemPrompt = `You are a clinical assistant for initial triage.
Task: from "comparison with previous" text, return category:
- normal
- attention
- urgent

Criteria:
- normal: trend without clinically meaningful deterioration.
- attention: deviations/deterioration requiring monitoring and plan adjustment.
- urgent: signs of potentially dangerous deterioration requiring urgent physician assessment.

Reply STRICTLY in JSON:
{
  "level": "normal|attention|urgent",
  "summary": "brief, 1-2 sentences",
  "deviations": ["specific deviation 1", "specific deviation 2"]
}

Write in English, no markdown.`;

    const prompt = `Comparison mode: ${comparisonMode}

Comparison analysis text:
${comparisonText}

Return triage and a brief rationale.`;

    const raw = await sendTextRequest(prompt, [], MODELS.GEMINI_3_FLASH, undefined, systemPrompt);
    const parsed = safeParseJson(raw);
    const normalized = normalizePayload(parsed);

    return NextResponse.json({
      success: true,
      triage: normalized,
      model: MODELS.GEMINI_3_FLASH,
    });
  } catch (error: any) {
    console.error('❌ [COMPARATIVE TRIAGE]', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'comparative_triage_failed' },
      { status: 500 }
    );
  }
}

