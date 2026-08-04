import { NextRequest, NextResponse } from 'next/server';
import { MODELS, sendTextRequest } from '@/lib/openrouter';

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
  if (normalized === 'urgent') return 'urgent';
  if (normalized === 'attention') return 'attention';
  return 'normal';
}

function normalizePayload(payload: any): TriageResponse {
  const summary = String(payload?.summary || '').trim() || 'No clinically significant deviations detected.';
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
    const body = await request.json();
    const comparisonText = String(body?.comparisonText || '').trim();
    const comparisonMode = String(body?.comparisonMode || 'general');

    if (!comparisonText) {
      return NextResponse.json({ success: false, error: 'comparisonText is required' }, { status: 400 });
    }

    const systemPrompt = `You are a clinical assistant for first-pass triage.
Classify the comparative findings into:
- normal
- attention
- urgent

Criteria:
- normal: no clinically significant deterioration.
- attention: some worsening/deviation requiring follow-up and treatment adjustment.
- urgent: potentially dangerous deterioration requiring urgent physician review.

Return STRICT JSON:
{
  "level": "normal|attention|urgent",
  "summary": "short rationale, 1-2 sentences",
  "deviations": ["specific deviation 1", "specific deviation 2"]
}

No markdown, JSON only.`;

    const prompt = `Comparison mode: ${comparisonMode}

Comparative analysis text:
${comparisonText}

Provide triage classification and concise rationale.`;

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
