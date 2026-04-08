import { NextRequest, NextResponse } from 'next/server';
import { initDatabase, confirmPayment } from '@/lib/database';
import { safeLog, safeWarn } from '@/lib/logger';
import { isPayanywayPaymentMode } from '@/lib/payment/payment-mode';

export const dynamic = 'force-dynamic';

/**
 * Webhook Yagoda: уведомление об изменении статуса заказа.
 * URL в кабинете: https://doctor-opus.ru/api/payment/ya (со слэшем — rewrite в next.config)
 */
function verifyWebhookSecret(request: NextRequest): boolean {
  const secret = (process.env.YAGODA_WEBHOOK_SECRET || '').trim();
  if (!secret) return true;
  const auth = request.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (isPayanywayPaymentMode()) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  if (!verifyWebhookSecret(request)) {
    safeWarn('⚠️ [YAGODA WEBHOOK] Отклонено: неверный секрет');
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: { order_id?: string | number; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const orderRaw = body?.order_id;
  const statusRaw = String(body?.status || '').toLowerCase();

  if (orderRaw == null || !statusRaw) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const paymentId = parseInt(String(orderRaw), 10);
  if (!Number.isFinite(paymentId) || paymentId <= 0) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (statusRaw !== 'payed' && statusRaw !== 'paid') {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    await initDatabase();
    const transactionId = `yagoda_webhook_${paymentId}`;
    const result = await confirmPayment(paymentId, transactionId);

    if (result.success) {
      if (!result.alreadyProcessed) {
        safeLog(`✅ [YAGODA WEBHOOK] Платёж #${paymentId} зачислен`);
      }
      return NextResponse.json({ ok: true, paymentId, alreadyProcessed: result.alreadyProcessed });
    }

    safeWarn(`⚠️ [YAGODA WEBHOOK] confirmPayment не удался для #${paymentId}`);
    return NextResponse.json({ ok: false }, { status: 500 });
  } catch (e) {
    safeWarn(`⚠️ [YAGODA WEBHOOK] Ошибка: ${e}`);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'yagoda-webhook' });
}
