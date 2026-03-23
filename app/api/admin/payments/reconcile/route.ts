import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions, isAdminEmail } from '@/lib/auth';
import { initDatabase, reconcilePendingPayments, sql } from '@/lib/database';
import { sendPaymentCreditedEmail } from '@/lib/email-service';
import { safeError, safeLog } from '@/lib/logger';
import { bridgePendingPaymentsWithPayAnyWay } from '@/lib/payment/payanyway-bridge-reconcile';

export const dynamic = 'force-dynamic';

async function ensureAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdminEmail(session.user.email)) return null;
  return session;
}

export async function POST(request: NextRequest) {
  try {
    const session = await ensureAdmin();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const limitRaw = Number(body?.limit || 200);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 200, 1), 500);

    await initDatabase();
    const bridge = await bridgePendingPaymentsWithPayAnyWay({ limit });
    const result = await reconcilePendingPayments(limit);
    const confirmedPayments = [
      ...(bridge.confirmedPayments || []),
      ...(result.confirmedPayments || []),
    ];

    if (confirmedPayments.length > 0) {
      for (const confirmed of confirmedPayments) {
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
          safeError('⚠️ [ADMIN RECONCILE] Не удалось отправить email о пополнении:', mailError);
        }
      }
    }

    safeLog('🔄 [ADMIN RECONCILE] Выполнено', {
      by: session.user.email,
      limit,
      success: result.success,
      processed: result.processed,
      confirmed: Number(result.confirmed || 0) + Number(bridge.confirmed || 0),
      failures: result.failures.length,
      bridge: {
        success: bridge.success,
        scanned: bridge.scanned,
        attached: bridge.attached,
        confirmed: bridge.confirmed,
      },
    });

    return NextResponse.json({
      success: true,
      ...result,
      bridge,
      confirmedPayments,
      confirmed: Number(result.confirmed || 0) + Number(bridge.confirmed || 0),
      initiatedBy: session.user.email,
    });
  } catch (error: any) {
    safeError('❌ [ADMIN RECONCILE] Ошибка:', error?.message || error);
    return NextResponse.json({ success: false, error: 'Ошибка запуска сверки' }, { status: 500 });
  }
}
