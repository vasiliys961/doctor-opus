import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions, isAdminEmail } from '@/lib/auth';
import { confirmPayment, initDatabase, sql } from '@/lib/database';
import { yagodaFetchOrderStatuses } from '@/lib/payment/yagoda-api';
import { YAGODA_TOPUP_PACKAGE_ID } from '@/lib/payment/credit-pricing';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !isAdminEmail(session.user.email)) {
      return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const paymentId = Number(body?.paymentId || 0);
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return NextResponse.json({ success: false, error: 'Некорректный paymentId' }, { status: 400 });
    }

    await initDatabase();

    const paymentResult = await sql`
      SELECT id, email, amount, units, status, package_id, transaction_id
      FROM payments
      WHERE id = ${paymentId}
      LIMIT 1
    `;
    const payment = paymentResult.rows[0];
    if (!payment) {
      return NextResponse.json({ success: false, error: 'Платеж не найден' }, { status: 404 });
    }
    if (String(payment.package_id || '') !== YAGODA_TOPUP_PACKAGE_ID) {
      return NextResponse.json({ success: false, error: 'Поддерживается только yagoda_topup' }, { status: 400 });
    }

    const statuses = await yagodaFetchOrderStatuses([String(paymentId)]);
    const row = statuses.find((s) => String(s.external_id) === String(paymentId)) || null;
    const yagodaStatus = String(row?.status || '').toLowerCase();

    if (yagodaStatus !== 'payed' && yagodaStatus !== 'paid') {
      return NextResponse.json({
        success: true,
        reconciled: false,
        reason: 'yagoda_not_paid',
        paymentId,
        paymentStatus: payment.status,
        yagodaStatus: yagodaStatus || null,
      });
    }

    if (String(payment.status) === 'failed' || String(payment.status) === 'expired') {
      await sql`
        UPDATE payments
        SET status = 'pending',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${paymentId}
          AND status IN ('failed', 'expired')
      `;
    }

    const txId = `yagoda_admin_${paymentId}`;
    const confirm = await confirmPayment(paymentId, txId);
    if (!confirm.success) {
      return NextResponse.json(
        { success: false, error: 'Не удалось подтвердить платеж в Opus', paymentId, yagodaStatus },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      reconciled: true,
      alreadyProcessed: Boolean(confirm.alreadyProcessed),
      paymentId,
      yagodaStatus,
      email: confirm.email || payment.email,
      amount: Number(confirm.amount ?? payment.amount ?? 0),
      units: Number(confirm.units ?? payment.units ?? 0),
      transactionId: String(confirm.transactionId || txId),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Ошибка ручной сверки Yagoda' },
      { status: 500 }
    );
  }
}

