import { NextRequest, NextResponse } from 'next/server';
import { MODELS } from '@/lib/openrouter';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { history, patientName } = await request.json();

    if (!history || !Array.isArray(history) || history.length === 0) {
      return NextResponse.json({ success: false, error: 'История пуста' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return NextResponse.json({ success: false, error: 'API key not set' }, { status: 500 });

    const prompt = `Ты — экспертный интеллектуальный ассистент с компетенциями профессора медицины. 
Твоя задача — проанализировать историю обследований пациента ${patientName || ''} и составить краткое, профессиональное «Клиническое резюме» (Case Summary).

### ДАННЫЕ ИЗ ТАЙМЛАЙНА (ИСТОРИЯ):
${history.map((h: any) => `[${h.date}] ${h.type.toUpperCase()}: ${h.conclusion.substring(0, 500)}...`).join('\n\n')}

### ТРЕБОВАНИЯ К РЕЗЮМЕ:
1. Сфокусируйся на динамике (что изменилось со временем).
2. Выдели ключевые риски или положительные сдвиги.
3. Дай краткую рекомендацию по тактике (на что обратить внимание при следующем осмотре).
4. Тон: строго академический, лаконичный.
5. Объем: не более 2-3 абзацев.

ОТВЕЧАЙ СТРОГО НА РУССКОМ ЯЗЫКЕ.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://doctor-opus.ru',
        'X-Title': 'Doctor Opus'
      },
      body: JSON.stringify({
        model: MODELS.GEMINI_3_FLASH, // Используем Flash для быстроты и дешевизны
        messages: [
          { role: 'system', content: 'Ты — экспертный ассистент профессора медицины. Твоя задача — синтезировать клинические данные.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      })
    });

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || 'Не удалось сформировать резюме.';

    return NextResponse.json({ success: true, summary });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Ошибка формирования сводки' }, { status: 500 });
  }
}
