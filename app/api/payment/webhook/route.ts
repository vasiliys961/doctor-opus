import { NextRequest, NextResponse } from 'next/server';
import { paymentService } from '@/lib/payment/payment-service';
import { confirmPayment, initDatabase, sql } from '@/lib/database';

/**
 * NOWPayments IPN (Instant Payment Notification) Webhook Handler
 *
 * NOWPayments sends IPN notifications when payment status changes.
 * Relevant payment_status values:
 *   - 'waiting'    — invoice created, awaiting payment
 *   - 'confirming' — payment detected on blockchain, awaiting confirmations
 *   - 'confirmed'  — payment confirmed
 *   - 'sending'    — funds being sent to merchant wallet
 *   - 'partially_paid' — underpaid (needs handling)
 *   - 'finished'   — payment complete ✅ → credit the user
 *   - 'failed'     — payment failed
 *   - 'refunded'   — payment refunded
 *   - 'expired'    — invoice expired
 *
 * IPN Signature verification:
 *   1. Read x-nowpayments-sig header
 *   2. Sort all IPN payload fields alphabetically by key
 *   3. JSON-serialize the sorted object
 *   4. Compute HMAC-SHA512(serialized, NOWPAYMENTS_IPN_SECRET_KEY)
 *   5. Compare hex digests (constant-time comparison)
 *
 * Environment variables required:
 *   NOWPAYMENTS_IPN_SECRET_KEY — from NOWPayments dashboard → Store Settings → IPN Secret
 */
export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-nowpayments-sig') || '';
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    const body = await request.json();

    const provider = paymentService.getProvider();
    const validationResult = await provider.validateNotification({ ...body, _signature: signature });

    if (!validationResult.isValid) {
      console.warn('⚠️ [WEBHOOK] Invalid NOWPayments signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const { orderId, amount } = validationResult;
    const paymentStatus = body.payment_status as string;

    console.log(`📦 [WEBHOOK] NOWPayments IPN: order=${orderId}, status=${paymentStatus}, amount=${amount} USD`);

    const paymentId = Number.parseInt(String(orderId), 10);
    if (!Number.isFinite(paymentId) || paymentId <= 0) {
      return NextResponse.json({ error: 'Invalid order_id' }, { status: 400 });
    }

    if (paymentStatus === 'finished') {
      await initDatabase();
      const txId = String(body.payment_id || body.purchase_id || orderId);
      const result = await confirmPayment(paymentId, txId);
      if (!result.success) {
        return NextResponse.json({ error: 'Failed to confirm payment' }, { status: 500 });
      }
      if ((result as any).alreadyProcessed) {
        console.log(`ℹ️ [WEBHOOK] Already processed: order=${orderId}`);
      } else {
        console.log(`✅ [WEBHOOK] Payment confirmed and credits added: order=${orderId}`);
      }
    }

    if (paymentStatus === 'failed' || paymentStatus === 'expired') {
      await sql`UPDATE payments SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ${paymentId} AND status = 'pending'`;
      console.log(`❌ [WEBHOOK] Payment ${paymentStatus}: order=${orderId}`);
    }

    if (paymentStatus === 'refunded') {
      await sql`UPDATE payments SET status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE id = ${paymentId}`;
      console.log(`↩️ [WEBHOOK] Refunded: order=${orderId}`);
    }

    return NextResponse.json({ ok: true });

  } catch (error: any) {
    console.error('❌ [WEBHOOK] Error processing NOWPayments IPN:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
