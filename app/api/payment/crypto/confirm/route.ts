import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { confirmPayment, initDatabase, sql } from '@/lib/database'
import { verifyUsdtTrc20Transfer } from '@/lib/payment/tron-verifier'
import { SUBSCRIPTION_PACKAGES } from '@/lib/subscription-manager'

const TRUST_WALLET_TRC20_ADDRESS =
  process.env.TRUST_WALLET_TRC20_ADDRESS?.trim() ||
  'TMvGdELxrB8vgREjGPcwg8JDStMM7LT9Zs'

const TX_HASH_RE = /^[a-fA-F0-9]{64}$/

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const invoiceId = Number.parseInt(String(body?.invoiceId || ''), 10)
    const txHash = String(body?.txHash || '').trim()

    if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid invoice ID' }, { status: 400 })
    }
    if (!TX_HASH_RE.test(txHash)) {
      return NextResponse.json({ success: false, error: 'Invalid transaction hash format' }, { status: 400 })
    }

    await initDatabase()
    const paymentRes = await sql`
      SELECT id, email, amount, units, status, package_id, transaction_id
      FROM payments
      WHERE id = ${invoiceId}
      LIMIT 1
    `
    const payment = paymentRes.rows[0]
    if (!payment) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 })
    }

    if (String(payment.email).toLowerCase() !== String(session.user.email).toLowerCase()) {
      return NextResponse.json({ success: false, error: 'You cannot confirm this invoice' }, { status: 403 })
    }

    if (payment.status === 'completed') {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        invoiceId,
        packageId: payment.package_id,
        units: Number(payment.units),
      })
    }

    if (payment.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Invoice has invalid status: ${payment.status}` },
        { status: 409 }
      )
    }

    const expectedAmount = Number.parseFloat(String(payment.amount || '0')) || 0
    const verify = await verifyUsdtTrc20Transfer({
      txHash,
      toAddress: TRUST_WALLET_TRC20_ADDRESS,
      expectedAmountUsdt: expectedAmount,
    })

    if (!verify.ok) {
      return NextResponse.json(
        {
          success: false,
          error: verify.reason || 'Transaction validation failed',
          confirmed: verify.confirmed || false,
          amountUsdt: verify.amountUsdt ?? null,
        },
        { status: 422 }
      )
    }

    const confirm = await confirmPayment(invoiceId, txHash)
    if (!confirm.success) {
      return NextResponse.json({ success: false, error: 'Failed to apply payment in database' }, { status: 500 })
    }

    const packageId = String(payment.package_id || '')
    const packageMeta = SUBSCRIPTION_PACKAGES[packageId as keyof typeof SUBSCRIPTION_PACKAGES]
    const units = Number(payment.units || packageMeta?.credits || 0)

    return NextResponse.json({
      success: true,
      alreadyProcessed: Boolean((confirm as any).alreadyProcessed),
      invoiceId,
      txHash,
      amountUsdt: verify.amountUsdt ?? expectedAmount,
      packageId,
      units,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to confirm crypto payment' },
      { status: 500 }
    )
  }
}
