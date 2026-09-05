import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import {
  initDatabase,
  getPromptSuggestions,
  savePromptSuggestion,
  updateSuggestionStatus,
  getRejectedFeedback,
} from '@/lib/database';
import { postLlmChatCompletionsWithFallback } from '@/lib/llm-provider';

const SPECIALTIES = ['ЭКГ', 'Дерматоскопия', 'УЗИ', 'Рентген', 'КТ', 'МРТ', 'Лаборатория'];

/**
 * GET — список предложений (все или только pending)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const isAdmin = (session?.user as any)?.isAdmin;
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await initDatabase();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const result = await getPromptSuggestions(status);

    return NextResponse.json({ success: true, suggestions: result.suggestions });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST — запустить анализ паттернов ошибок для specialty
 * или обновить статус предложения (approve/reject)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const isAdmin = (session?.user as any)?.isAdmin;
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await initDatabase();

    const body = await request.json();

    // Обновление статуса предложения
    if (body.action === 'update_status') {
      const result = await updateSuggestionStatus(body.id, body.status);
      return NextResponse.json(result);
    }

    // Анализ паттернов ошибок
    if (body.action === 'analyze') {
      const specialty = body.specialty;
      if (!specialty) {
        return NextResponse.json({ success: false, error: 'specialty required' }, { status: 400 });
      }

      const feedbackResult = await getRejectedFeedback(specialty, 30);
      const cases = feedbackResult.cases;

      if (cases.length < 3) {
        return NextResponse.json({
          success: false,
          error: `Недостаточно rejected кейсов для анализа (нужно минимум 3, есть ${cases.length})`,
        });
      }

      const casesText = cases
        .map((c: any, i: number) => {
          return `--- Кейс ${i + 1} ---
AI ответ: ${c.ai_response?.substring(0, 500) || 'нет'}
Правильный диагноз врача: ${c.correct_diagnosis || 'нет'}
Комментарий врача: ${c.doctor_comment || 'нет'}`;
        })
        .join('\n\n');

      const prompt = `Ты эксперт по качеству медицинских AI систем.

Проанализируй ${cases.length} кейсов из специальности "${specialty}", где AI ошибся (врач не подтвердил ответ).

${casesText}

Твоя задача:
1. Найди ПАТТЕРН ошибок — что именно AI делает неправильно в этой специальности
2. Предложи конкретное улучшение промпта для исправления

Ответь строго в формате JSON:
{
  "pattern_found": "краткое описание найденного паттерна ошибок (2-4 предложения)",
  "suggested_change": "конкретное предложение что добавить или изменить в промпте (3-6 предложений)"
}

Отвечай только JSON, без лишнего текста.`;

      const response = await postLlmChatCompletionsWithFallback(
        {
          model: 'anthropic/claude-sonnet-5',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1000,
          temperature: 0.2,
        },
        {
          headers: {
            'HTTP-Referer': 'https://doctor-opus.ru',
            'X-Title': 'Doctor Opus',
          },
        }
      );

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`LLM error: ${response.status} ${err.substring(0, 200)}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      let parsed: any;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
      } catch {
        throw new Error('LLM вернул некорректный JSON: ' + content.substring(0, 300));
      }

      const saveResult = await savePromptSuggestion({
        specialty,
        pattern_found: parsed.pattern_found || '',
        suggested_change: parsed.suggested_change || '',
        based_on_cases: cases.length,
      });

      return NextResponse.json({
        success: true,
        suggestion: {
          specialty,
          pattern_found: parsed.pattern_found,
          suggested_change: parsed.suggested_change,
          based_on_cases: cases.length,
          id: saveResult.id,
        },
      });
    }

    return NextResponse.json({ success: false, error: 'unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('❌ [PROMPT SUGGESTIONS]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
