import { NextRequest, NextResponse } from 'next/server';
import { MODELS } from '@/lib/openrouter';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { checkAndDeductBalance, checkAndDeductGuestBalance } from '@/lib/server-billing';
import { getRateLimitKey } from '@/lib/rate-limiter';
import { postLlmChatCompletionsWithFallback } from '@/lib/llm-provider';
import { appendLanguageInstruction, getForcedLanguageInstructionForRequest } from '@/lib/i18n/llm-response-language';

export const maxDuration = 300;

function estimatePatientSummaryCost(historyLength: number): number {
  const estimated = 1.1 + Math.min(2.5, historyLength * 0.2);
  return Number(Math.min(6, Math.max(0.9, estimated)).toFixed(2));
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email || null;
    const guestKey = userEmail ? null : getRateLimitKey(request);

    const { history, patientName } = await request.json();
    const responseLanguageInstruction = await getForcedLanguageInstructionForRequest();

    if (!history || !Array.isArray(history) || history.length === 0) {
      return NextResponse.json({ success: false, error: 'История пуста' }, { status: 400 });
    }

    const estimatedCost = estimatePatientSummaryCost(history.length);
    const billing = userEmail
      ? await checkAndDeductBalance(userEmail, estimatedCost, 'Patient summary', {
          historyLength: history.length,
          hasPatientName: Boolean(patientName),
          source: 'patient_summary',
        })
      : await checkAndDeductGuestBalance(guestKey!, estimatedCost, 'Guest trial: patient summary', {
          historyLength: history.length,
          hasPatientName: Boolean(patientName),
          source: 'patient_summary',
        });
    if (!billing.allowed) {
      return NextResponse.json(
        { success: false, error: billing.error || 'Недостаточно единиц для формирования сводки' },
        { status: 402 }
      );
    }

    const prompt = appendLanguageInstruction(`You are an expert medical assistant with professor-level clinical reasoning.
Analyze the patient's longitudinal examination history ${patientName || ''} and produce a concise professional Case Summary.

### TIMELINE DATA:
${history.map((h: any) => `[${h.date}] ${h.type.toUpperCase()}: ${h.conclusion.substring(0, 500)}...`).join('\n\n')}

### REQUIREMENTS:
1. Focus on dynamics (what changed over time).
2. Highlight key risks and positive shifts.
3. Add concise tactical advice for the next visit.
4. Tone: academic and concise.
5. Length: 2-3 short paragraphs.`, responseLanguageInstruction);

    const response = await postLlmChatCompletionsWithFallback(
      {
        model: MODELS.GEMINI_3_FLASH, // Используем Flash для быстроты и дешевизны
        messages: [
          { role: 'system', content: `${responseLanguageInstruction}\nYou synthesize clinical longitudinal data into a concise physician-facing summary.` },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      },
      {
        headers: {
          'HTTP-Referer': 'https://doctor-opus.ru',
          'X-Title': 'Doctor Opus'
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { success: false, error: `AI request failed: ${response.status} ${errorText.substring(0, 200)}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || 'Не удалось сформировать резюме.';

    return NextResponse.json({ success: true, summary });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Ошибка формирования сводки' }, { status: 500 });
  }
}
