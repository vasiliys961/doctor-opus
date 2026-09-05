import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getRateLimitKey } from '@/lib/rate-limiter'
import { checkAndDeductBalance, checkAndDeductGuestBalance, getAnalysisCost } from '@/lib/server-billing'
import { getRequestLocale } from '@/lib/i18n/server'
import { getSpirometryMessages } from '@/lib/i18n/spirometry'
import { postLlmChatCompletionsWithFallback } from '@/lib/llm-provider'
import { appendLanguageInstruction, getForcedLanguageInstructionForRequest } from '@/lib/i18n/llm-response-language'

const PRIMARY_MODEL = 'openai/gpt-5.6-terra'
const FALLBACK_MODEL = 'anthropic/claude-sonnet-5'

function shouldFallbackFromPrimaryModel(status: number, errorText: string): boolean {
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
    const locale = await getRequestLocale()
    const t = getSpirometryMessages(locale)
    const responseLanguageInstruction = await getForcedLanguageInstructionForRequest()
    const session = await getServerSession(authOptions)
    const userEmail = session?.user?.email || null
    const guestKey = userEmail ? null : getRateLimitKey(request)

    const formData = await request.formData()
    const rawPrompt = formData.get('prompt') as string
    const prompt = appendLanguageInstruction(String(rawPrompt || ''), responseLanguageInstruction)
    const file = formData.get('file') as File | null
    const isTextOnly = formData.get('isTextOnly') === 'true'

    if (!rawPrompt) {
      return NextResponse.json({ success: false, error: t.noPrompt }, { status: 400 })
    }

    // Биллинг
    const estimatedCost = getAnalysisCost('optimized', file ? 1 : 0)
    const billing = userEmail
      ? await checkAndDeductBalance(userEmail, estimatedCost, 'Spirometry analysis', { mode: 'optimized' })
      : await checkAndDeductGuestBalance(guestKey!, estimatedCost, 'Guest: Spirometry analysis', { mode: 'optimized' })

    if (!billing.allowed) {
      return NextResponse.json({ success: false, error: billing.error || t.insufficientBalance }, { status: 402 })
    }

    console.log('🫁 [SPIROMETRY] Starting analysis, model:', PRIMARY_MODEL)

    // Формируем сообщение
    const messages: any[] = []

    if (file && !isTextOnly) {
      // С изображением кривой
      const arrayBuffer = await file.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      const mimeType = file.type || 'image/png'

      messages.push({
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
          { type: 'text', text: prompt },
        ],
      })
    } else {
      // Только текст с показателями
      messages.push({ role: 'user', content: prompt })
    }

    const runRequest = async (model: string) => {
      return postLlmChatCompletionsWithFallback(
        {
          model,
          messages,
          max_tokens: 2000,
          temperature: 0.2,
        },
        {
          headers: {
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXTAUTH_URL || 'https://doctor-opus.ru',
          'X-Title': 'Doctor Opus — Spirometry',
          },
        }
      )
    }

    let modelUsed = PRIMARY_MODEL
    let response = await runRequest(modelUsed)

    if (!response.ok) {
      const err = await response.text()
      if (modelUsed === PRIMARY_MODEL && shouldFallbackFromPrimaryModel(response.status, err)) {
        console.warn(`⚠️ [SPIROMETRY] ${PRIMARY_MODEL} unavailable, switching to ${FALLBACK_MODEL}`)
        modelUsed = FALLBACK_MODEL
        response = await runRequest(modelUsed)
      } else {
        console.error('❌ [SPIROMETRY] OpenRouter error:', err)
        return NextResponse.json({ success: false, error: t.aiError }, { status: 500 })
      }
    }

    if (!response.ok) {
      const err = await response.text()
      console.error('❌ [SPIROMETRY] OpenRouter fallback error:', err)
      return NextResponse.json({ success: false, error: t.aiError }, { status: 500 })
    }

    const data = await response.json()
    const result = data.choices?.[0]?.message?.content || ''

    console.log('✅ [SPIROMETRY] Analysis complete, chars:', result.length)

    return NextResponse.json({ success: true, result, model: modelUsed })
  } catch (error: any) {
    const locale = await getRequestLocale()
    const t = getSpirometryMessages(locale)
    console.error('❌ [SPIROMETRY] Error:', error)
    return NextResponse.json({ success: false, error: t.serverError }, { status: 500 })
  }
}
