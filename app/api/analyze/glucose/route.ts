import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getRateLimitKey } from '@/lib/rate-limiter'
import { checkAndDeductBalance, checkAndDeductGuestBalance, getAnalysisCost } from '@/lib/server-billing'
import { postLlmChatCompletionsWithFallback } from '@/lib/llm-provider'
import { appendLanguageInstruction, getForcedLanguageInstructionForRequest } from '@/lib/i18n/llm-response-language'

const PRIMARY_MODEL = 'openai/gpt-5.6-terra'
const FALLBACK_MODEL = 'anthropic/claude-sonnet-5'

function shouldFallbackFromGpt54(status: number, errorText: string): boolean {
  const normalized = (errorText || '').toLowerCase()
  return (
    status === 401 ||
    status === 403 ||
    normalized.includes('permission_denied') ||
    normalized.includes('provider returned error') ||
    normalized.includes('azure')
  )
}

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
    const responseLanguageInstruction = await getForcedLanguageInstructionForRequest()

    // Биллинг
    const estimatedCost = getAnalysisCost('optimized', file ? 1 : 0)
    const billing = userEmail
      ? await checkAndDeductBalance(userEmail, estimatedCost, 'Glucose profile analysis', { mode: 'optimized' })
      : await checkAndDeductGuestBalance(guestKey!, estimatedCost, 'Guest: Glucose profile', { mode: 'optimized' })

    if (!billing.allowed) {
      return NextResponse.json({ success: false, error: billing.error || 'Insufficient balance' }, { status: 402 })
    }

    console.log('🩸 [GLUCOSE] Анализ гликемического профиля, модель:', PRIMARY_MODEL)

    // Суточный профиль по часам (топ проблемные периоды)
    const problematicHours = hourlyStats
      .filter((h: any) => h.avg > 10 || h.avg < 3.9)
      .map((h: any) => `${String(h.hour).padStart(2,'0')}:00 — average ${h.avg} mmol/L (${h.min}–${h.max})`)
      .join('\n') || 'None detected'

    const patientText = [
      patientInfo.age       && `Age: ${patientInfo.age} years`,
      patientInfo.sex       && `Sex: ${patientInfo.sex}`,
      patientInfo.diabetesType && `Diabetes type: ${patientInfo.diabetesType}`,
      patientInfo.hba1c     && `Last HbA1c: ${patientInfo.hba1c}%`,
    ].filter(Boolean).join(', ')

    const prompt = appendLanguageInstruction(`You are an endocrinologist. Analyze continuous glucose monitoring (CGM) data for ${daysCount} days (${pointsCount} measurements).

${patientText ? `Patient: ${patientText}\n` : ''}
GLYCEMIC CONTROL METRICS:
• Mean glucose: ${stats.avg} mmol/L
• GMI (estimated HbA1c): ${stats.gmi}%
• Variability (CV): ${stats.cv}% ${stats.cv > 36 ? '⚠️ HIGH' : '✓ acceptable'}
• Min/Max: ${stats.min} / ${stats.max} mmol/L

TIME IN RANGE (TIR):
• In target range 3.9–10 mmol/L: ${stats.tir}% ${stats.tir >= 70 ? '✓' : '⚠️ BELOW 70% TARGET'}
• Above 10 mmol/L (hyperglycemia): ${stats.tar}%
• Below 3.9 mmol/L (hypoglycemia): ${stats.tbr}% (${stats.hypoCount} episodes)

DAILY PROFILE:
• Night (00–06): ${stats.nightAvg} mmol/L
• Day (06–24): ${stats.dayAvg} mmol/L

PROBLEMATIC PERIODS:
${problematicHours}
${file ? '\nAGP chart attached (see image).' : ''}

Provide a clinical conclusion in this structure:
1. Glycemic control status (compensated/subcompensated/decompensated)
2. TIR analysis: target achievement and major issues
3. Hypoglycemia: risk, patterns, recommendations
4. Hyperglycemia: patterns and likely causes (dawn phenomenon, postprandial peaks, etc.)
5. Glycemic variability and clinical significance
6. Recommendations: therapy, nutrition, and monitoring adjustments
7. Brief summary (2-3 sentences)`, responseLanguageInstruction)

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

    const runRequest = async (model: string) => {
      return postLlmChatCompletionsWithFallback(
        { model, messages, max_tokens: 2500, temperature: 0.2 },
        {
          headers: {
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXTAUTH_URL || 'https://doctor-opus.ru',
          'X-Title': 'Doctor Opus — Glucose Profile',
          },
        }
      )
    }

    let modelUsed = PRIMARY_MODEL
    let response = await runRequest(modelUsed)

    if (!response.ok) {
      const err = await response.text()
      if (modelUsed === PRIMARY_MODEL && shouldFallbackFromGpt54(response.status, err)) {
        console.warn(`⚠️ [GLUCOSE] ${PRIMARY_MODEL} недоступна, переключаемся на ${FALLBACK_MODEL}`)
        modelUsed = FALLBACK_MODEL
        response = await runRequest(modelUsed)
      } else {
        console.error('❌ [GLUCOSE] OpenRouter error:', err)
        return NextResponse.json({ success: false, error: 'AI error' }, { status: 500 })
      }
    }

    if (!response.ok) {
      const err = await response.text()
      console.error('❌ [GLUCOSE] OpenRouter fallback error:', err)
      return NextResponse.json({ success: false, error: 'AI error' }, { status: 500 })
    }

    const data = await response.json()
    const result = data.choices?.[0]?.message?.content || ''
    console.log('✅ [GLUCOSE] Анализ завершён, символов:', result.length)

    return NextResponse.json({ success: true, result, model: modelUsed })
  } catch (error: any) {
    console.error('❌ [GLUCOSE] Ошибка:', error)
    return NextResponse.json({ success: false, error: 'Glucose analysis error' }, { status: 500 })
  }
}
