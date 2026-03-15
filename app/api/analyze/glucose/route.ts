import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getRateLimitKey } from '@/lib/rate-limiter'
import { checkAndDeductBalance, checkAndDeductGuestBalance, getAnalysisCost } from '@/lib/server-billing'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const MODEL = 'openai/gpt-5.4'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userEmail = session?.user?.email || null
    const guestKey = userEmail ? null : getRateLimitKey(request)

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const statsRaw = formData.get('stats') as string
    const daysCount = formData.get('daysCount') as string
    const pointsCount = formData.get('pointsCount') as string
    const patientInfoRaw = formData.get('patientInfo') as string
    const hourlyStatsRaw = formData.get('hourlyStats') as string

    if (!statsRaw) {
      return NextResponse.json({ success: false, error: 'No stats provided' }, { status: 400 })
    }

    const stats = JSON.parse(statsRaw)
    const patientInfo = patientInfoRaw ? JSON.parse(patientInfoRaw) : {}
    const hourlyStats = hourlyStatsRaw ? JSON.parse(hourlyStatsRaw) : []

    // Биллинг
    const estimatedCost = getAnalysisCost('optimized', file ? 1 : 0)
    const billing = userEmail
      ? await checkAndDeductBalance(userEmail, estimatedCost, 'Glucose profile analysis', { mode: 'optimized' })
      : await checkAndDeductGuestBalance(guestKey!, estimatedCost, 'Guest: Glucose profile', { mode: 'optimized' })

    if (!billing.allowed) {
      return NextResponse.json({ success: false, error: billing.error || 'Insufficient balance' }, { status: 402 })
    }

    console.log('🩸 [GLUCOSE] Анализ гликемического профиля, модель:', MODEL)

    // Суточный профиль по часам (топ проблемные периоды)
    const problematicHours = hourlyStats
      .filter((h: any) => h.avg > 10 || h.avg < 3.9)
      .map((h: any) => `${String(h.hour).padStart(2,'0')}:00 — среднее ${h.avg} ммоль/л (${h.min}–${h.max})`)
      .join('\n') || 'Не выявлено'

    const patientText = [
      patientInfo.age       && `Возраст: ${patientInfo.age} лет`,
      patientInfo.sex       && `Пол: ${patientInfo.sex}`,
      patientInfo.diabetesType && `СД ${patientInfo.diabetesType} типа`,
      patientInfo.hba1c     && `HbA1c последний: ${patientInfo.hba1c}%`,
    ].filter(Boolean).join(', ')

    const prompt = `Вы эндокринолог. Проанализируйте данные непрерывного мониторинга глюкозы (CGM) за ${daysCount} дней (${pointsCount} измерений).

${patientText ? `Пациент: ${patientText}\n` : ''}
МЕТРИКИ ГЛИКЕМИЧЕСКОГО КОНТРОЛЯ:
• Среднее: ${stats.avg} ммоль/л
• GMI (расчётный HbA1c): ${stats.gmi}%
• Вариабельность (CV): ${stats.cv}% ${stats.cv > 36 ? '⚠️ ВЫСОКАЯ' : '✓ приемлемая'}
• Min/Max: ${stats.min} / ${stats.max} ммоль/л

ВРЕМЯ В ДИАПАЗОНЕ (TIR):
• В целевом диапазоне 3.9–10 ммоль/л: ${stats.tir}% ${stats.tir >= 70 ? '✓' : '⚠️ НИЖЕ ЦЕЛИ 70%'}
• Выше 10 ммоль/л (гипергликемия): ${stats.tar}%
• Ниже 3.9 ммоль/л (гипогликемия): ${stats.tbr}% (${stats.hypoCount} эпизодов)

СУТОЧНЫЙ ПРОФИЛЬ:
• Ночью (00–06): ${stats.nightAvg} ммоль/л
• Днём (06–24): ${stats.dayAvg} ммоль/л

ПРОБЛЕМНЫЕ ПЕРИОДЫ:
${problematicHours}
${file ? '\nПредоставлен AGP-график (см. изображение).' : ''}

Составьте клиническое заключение по следующей структуре:
1. **Оценка гликемического контроля** (компенсирован/субкомпенсирован/декомпенсирован)
2. **Анализ TIR** — достижение целей, основные проблемы
3. **Гипогликемии** — риск, паттерны, рекомендации
4. **Гипергликемии** — паттерны, возможные причины (утренняя зора, постпрандиальные пики и др.)
5. **Вариабельность гликемии** — клиническое значение
6. **Рекомендации** — коррекция терапии, питания, мониторинга
7. **Краткое заключение** (2-3 предложения)`

    // Формируем запрос к OpenRouter
    const messages: any[] = []

    if (file) {
      const arrayBuffer = await file.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      messages.push({
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` } },
          { type: 'text', text: prompt },
        ],
      })
    } else {
      messages.push({ role: 'user', content: prompt })
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXTAUTH_URL || 'https://doctor-opus.ru',
        'X-Title': 'Doctor Opus — Glucose Profile',
      },
      body: JSON.stringify({ model: MODEL, messages, max_tokens: 2500, temperature: 0.2 }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('❌ [GLUCOSE] OpenRouter error:', err)
      return NextResponse.json({ success: false, error: 'AI error' }, { status: 500 })
    }

    const data = await response.json()
    const result = data.choices?.[0]?.message?.content || ''
    console.log('✅ [GLUCOSE] Анализ завершён, символов:', result.length)

    return NextResponse.json({ success: true, result, model: MODEL })
  } catch (error: any) {
    console.error('❌ [GLUCOSE] Ошибка:', error)
    return NextResponse.json({ success: false, error: 'Glucose analysis error' }, { status: 500 })
  }
}
