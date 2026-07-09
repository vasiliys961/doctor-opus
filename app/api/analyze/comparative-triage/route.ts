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
  if (normalized === 'urgent' || normalized === 'срочно') return 'urgent';
  if (normalized === 'attention' || normalized === 'требует внимания') return 'attention';
  return 'normal';
}

function normalizePayload(payload: any): TriageResponse {
  const summary = String(payload?.summary || '').trim() || 'Автооценка не выявила значимых отклонений.';
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

    const systemPrompt = `Ты клинический ассистент для первичного triage.
Задача: по тексту "сравнение с предыдущим" вернуть категорию:
- normal
- attention
- urgent

Критерии:
- normal: динамика без клинически значимых ухудшений.
- attention: есть отклонения/ухудшения, требующие контроля и коррекции тактики.
- urgent: признаки потенциально опасного ухудшения, требующие срочной оценки врачом.

Ответь СТРОГО в JSON:
{
  "level": "normal|attention|urgent",
  "summary": "коротко, 1-2 предложения",
  "deviations": ["конкретное отклонение 1", "конкретное отклонение 2"]
}

Пиши по-русски, без markdown.`;

    const prompt = `Режим сравнения: ${comparisonMode}

Текст сравнительного анализа:
${comparisonText}

Выдай triage и краткое обоснование.`;

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

