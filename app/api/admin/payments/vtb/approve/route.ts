import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions, isAdminEmail } from '@/lib/auth';
import { approvePaymentConfirmationRequest, initDatabase, sql } from '@/lib/database';
import { sendPaymentCreditedEmail } from '@/lib/email-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const adminEmail = session?.user?.email?.trim().toLowerCase();
    if (!adminEmail || !isAdminEmail(adminEmail)) {
      return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const requestId = Number(body?.requestId || 0);
    const adminComment = body?.adminComment ? String(body.adminComment) : undefined;
    if (!Number.isInteger(requestId) || requestId <= 0) {
      return NextResponse.json({ success: false, error: 'Некорректный requestId' }, { status: 400 });
    }

    await initDatabase();
    const result = await approvePaymentConfirmationRequest({
      requestId,
      adminEmail,
      adminComment,
    });
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Не удалось подтвердить заявку' }, { status: 500 });
    }

    if (!result.alreadyProcessed && result.email) {
      const balanceResult = await sql`
        SELECT balance
        FROM user_balances
        WHERE email = ${result.email}
        LIMIT 1
      `;
      const balanceAfter = balanceResult.rows[0]?.balance != null
        ? Number(balanceResult.rows[0].balance)
        : null;

      void sendPaymentCreditedEmail({
        email: result.email,
        amountRub: Number(result.amount || 0),
        units: Number(result.units || 0),
        balanceAfter,
        paymentId: Number(result.paymentId || 0),
        transactionId: String(result.transactionId || ''),
      });
    }

    return NextResponse.json({
      success: true,
      requestId,
      alreadyProcessed: Boolean(result.alreadyProcessed),
      paymentId: Number(result.paymentId || 0),
    });
  } catch (error) {
    console.error('❌ [ADMIN VTB APPROVE] Ошибка:', error);
    return NextResponse.json({ success: false, error: 'Ошибка подтверждения заявки оплаты' }, { status: 500 });
  }
}
