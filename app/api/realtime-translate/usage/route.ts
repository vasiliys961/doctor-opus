import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/database'
import { BILLING_CONFIG } from '@/lib/config'
import { realtimeTranslationCredits } from '@/lib/cost-calculator'
import { checkAndDeductBalance, isVipEmail } from '@/lib/server-billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_SECONDS_PER_CHARGE = 180

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email) {
    return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
  }

  let seconds = 0
  try {
    const body = await request.json()
    seconds = Number(body?.seconds)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!Number.isFinite(seconds) || seconds < 0 || seconds > MAX_SECONDS_PER_CHARGE) {
    return NextResponse.json({ error: 'Invalid duration' }, { status: 400 })
  }

  if (seconds === 0) {
    if (isVipEmail(email)) {
      return NextResponse.json({ allowed: true, charged: 0 })
    }
    const { rows } = await sql`
      SELECT balance FROM user_balances WHERE email = ${email}
    `
    const balance = rows.length > 0 ? parseFloat(rows[0].balance) : BILLING_CONFIG.initialBalance
    if (balance <= BILLING_CONFIG.softLimit) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
    }
    return NextResponse.json({ allowed: true, charged: 0 })
  }

  if (isVipEmail(email)) {
    return NextResponse.json({ allowed: true, charged: 0 })
  }

  const charged = realtimeTranslationCredits(seconds)
  if (charged < 0.01) {
    return NextResponse.json({ allowed: true, charged: 0 })
  }

  const result = await checkAndDeductBalance(email, charged, 'Realtime translation', { seconds })
  if (!result.allowed) {
    return NextResponse.json({ error: result.error || 'Insufficient credits' }, { status: 402 })
  }

  return NextResponse.json({
    allowed: true,
    charged,
    balanceAfter: result.balanceAfter,
  })
}
