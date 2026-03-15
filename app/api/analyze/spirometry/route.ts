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
    const prompt = formData.get('prompt') as string
    const file = formData.get('file') as File | null
    const isTextOnly = formData.get('isTextOnly') === 'true'

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'No prompt provided' }, { status: 400 })
    }

    // Биллинг
    const estimatedCost = getAnalysisCost('optimized', file ? 1 : 0)
    const billing = userEmail
      ? await checkAndDeductBalance(userEmail, estimatedCost, 'Spirometry analysis', { mode: 'optimized' })
      : await checkAndDeductGuestBalance(guestKey!, estimatedCost, 'Guest: Spirometry analysis', { mode: 'optimized' })

    if (!billing.allowed) {
      return NextResponse.json({ success: false, error: billing.error || 'Insufficient balance' }, { status: 402 })
    }

    console.log('🫁 [SPIROMETRY] Анализ спирометрии, модель:', MODEL)

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

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXTAUTH_URL || 'https://doctor-opus.ru',
        'X-Title': 'Doctor Opus — Spirometry',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: 2000,
        temperature: 0.2,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('❌ [SPIROMETRY] OpenRouter error:', err)
      return NextResponse.json({ success: false, error: 'AI error' }, { status: 500 })
    }

    const data = await response.json()
    const result = data.choices?.[0]?.message?.content || ''

    console.log('✅ [SPIROMETRY] Анализ завершён, символов:', result.length)

    return NextResponse.json({ success: true, result, model: MODEL })
  } catch (error: any) {
    console.error('❌ [SPIROMETRY] Ошибка:', error)
    return NextResponse.json({ success: false, error: 'Spirometry analysis error' }, { status: 500 })
  }
}
