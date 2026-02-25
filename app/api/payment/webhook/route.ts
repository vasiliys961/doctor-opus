import { NextRequest, NextResponse } from 'next/server';
import { paymentService } from '@/lib/payment/payment-service';
import { initDatabase, getPaymentByOrderId, updatePaymentStatus, addCredits } from '@/lib/database';

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
    // TODO: Step 1 — Extract and verify HMAC signature
    // const signature = request.headers.get('x-nowpayments-sig');
    // if (!signature) {
    //   return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    // }

    const body = await request.json();

    // TODO: Step 2 — Implement HMAC-SHA512 signature verification
    // import crypto from 'crypto';
    // const sortedBody = Object.fromEntries(Object.entries(body).sort());
    // const serialized = JSON.stringify(sortedBody);
    // const hmac = crypto.createHmac('sha512', process.env.NOWPAYMENTS_IPN_SECRET_KEY || '');
    // hmac.update(serialized);
    // const expectedSig = hmac.digest('hex');
    // const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
    // if (!isValid) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    // }

    const provider = paymentService.getProvider();
    const validationResult = await provider.validateNotification(body);

    if (!validationResult.isValid) {
      console.warn('⚠️ [WEBHOOK] Invalid NOWPayments signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const { orderId, amount } = validationResult;
    const paymentStatus = body.payment_status as string;

    console.log(`📦 [WEBHOOK] NOWPayments IPN: order=${orderId}, status=${paymentStatus}, amount=${amount} USD`);

    // TODO: Step 3 — Handle payment status transitions
    if (paymentStatus === 'finished') {
      await initDatabase();

      // TODO: Implement getPaymentByOrderId in database.ts if not present
      // const payment = await getPaymentByOrderId(orderId);
      // if (!payment) {
      //   console.error(`❌ [WEBHOOK] Payment not found: order=${orderId}`);
      //   return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
      // }

      // TODO: Prevent double-crediting — check if already processed
      // if (payment.status === 'completed') {
      //   console.log(`ℹ️ [WEBHOOK] Already processed: order=${orderId}`);
      //   return NextResponse.json({ ok: true });
      // }

      // TODO: Credit the user
      // await updatePaymentStatus(orderId, 'completed');
      // await addCredits(payment.email, payment.units);
      // console.log(`✅ [WEBHOOK] Credited ${payment.units} credits to ${payment.email}`);
    }

    if (paymentStatus === 'failed' || paymentStatus === 'expired') {
      // TODO: Mark payment as failed in DB
      // await updatePaymentStatus(orderId, 'failed');
      console.log(`❌ [WEBHOOK] Payment ${paymentStatus}: order=${orderId}`);
    }

    if (paymentStatus === 'refunded') {
      // TODO: Deduct credits if already issued
      // await updatePaymentStatus(orderId, 'refunded');
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
