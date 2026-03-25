import { NextRequest, NextResponse } from 'next/server';
import { expireStalePendingPayments, initDatabase, reconcilePendingPayments, releasePendingNoticeReservation, reservePendingNoticeCandidates, sql } from '@/lib/database';
import { sendPaymentCreditedEmail, sendPaymentPendingHelpEmail } from '@/lib/email-service';
import { safeError, safeLog } from '@/lib/logger';
import { bridgePendingPaymentsWithPayAnyWay } from '@/lib/payment/payanyway-bridge-reconcile';

export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.PAYMENT_RECONCILE_SECRET;
  if (!secret) return false;

  const querySecret = request.nextUrl.searchParams.get('secret') || '';
  const headerSecret = request.headers.get('x-reconcile-secret') || '';
  return querySecret === secret || headerSecret === secret;
}

async function runReconcile(limit: number) {
  await initDatabase();
  const expired = await expireStalePendingPayments();
  const pendingNoticeReserve = await reservePendingNoticeCandidates();
  const bridge = await bridgePendingPaymentsWithPayAnyWay({ limit });
  const result = await reconcilePendingPayments(limit);

  const mergedConfirmedPayments = [
    ...(bridge.confirmedPayments || []),
    ...(result.confirmedPayments || []),
  ];

  if (mergedConfirmedPayments.length > 0) {
    for (const confirmed of mergedConfirmedPayments) {
      try {
        const balanceResult = await sql`
          SELECT balance
          FROM user_balances
          WHERE email = ${confirmed.email}
          LIMIT 1
        `;
        const balanceAfter = balanceResult.rows[0]?.balance != null
          ? Number(balanceResult.rows[0].balance)
          : null;

        await sendPaymentCreditedEmail({
          email: confirmed.email,
          amountRub: confirmed.amount,
          units: confirmed.units,
          balanceAfter,
          paymentId: confirmed.paymentId,
          transactionId: confirmed.transactionId,
        });
      } catch (mailError) {
        safeError('⚠️ [PAYMENT RECONCILE] Не удалось отправить email о пополнении:', mailError);
      }
    }
  }

  let pendingNoticeSent = 0;
  let pendingNoticeFailed = 0;
  if (pendingNoticeReserve.success && pendingNoticeReserve.reserved.length > 0) {
    const failedPaymentIds: number[] = [];
    for (const row of pendingNoticeReserve.reserved) {
      try {
        const mailResult = await sendPaymentPendingHelpEmail({
          email: row.email,
          paymentId: row.paymentId,
          amountRub: row.amountRub,
          createdAt: row.createdAt,
        });
        if (mailResult?.success) {
          pendingNoticeSent += 1;
        } else {
          pendingNoticeFailed += 1;
          failedPaymentIds.push(row.paymentId);
        }
      } catch {
        pendingNoticeFailed += 1;
        failedPaymentIds.push(row.paymentId);
      }
    }
    if (failedPaymentIds.length > 0) {
      await releasePendingNoticeReservation(failedPaymentIds);
    }
  }

  return {
    ...result,
    expired,
    pendingNotices: {
      reserved: pendingNoticeReserve.success ? pendingNoticeReserve.reserved.length : 0,
      sent: pendingNoticeSent,
      failed: pendingNoticeFailed,
    },
    bridge,
    confirmedPayments: mergedConfirmedPayments,
    confirmed: Number(result.confirmed || 0) + Number(bridge.confirmed || 0),
  };
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const limitRaw = request.nextUrl.searchParams.get('limit');
    const limit = Math.min(Math.max(parseInt(limitRaw || '100', 10) || 100, 1), 500);
    const result = await runReconcile(limit);
    safeLog('🔄 [PAYMENT RECONCILE] Выполнено:', result);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    safeError('❌ [PAYMENT RECONCILE] Ошибка:', error?.message || error);
    return NextResponse.json({ success: false, error: 'Reconcile failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(Math.max(parseInt(String(body?.limit || '100'), 10) || 100, 1), 500);
    const result = await runReconcile(limit);
    safeLog('🔄 [PAYMENT RECONCILE] Выполнено:', result);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    safeError('❌ [PAYMENT RECONCILE] Ошибка POST:', error?.message || error);
    return NextResponse.json({ success: false, error: 'Reconcile failed' }, { status: 500 });
  }
}
