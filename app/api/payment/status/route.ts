import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { initDatabase, reconcilePendingPaymentsForEmail, sql } from '@/lib/database';
import { sendPaymentCreditedEmail } from '@/lib/email-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    if (!email) {
      return NextResponse.json({ success: false, error: 'Необходима авторизация' }, { status: 401 });
    }

    await initDatabase();
    // Автодозавершение "подвисших" pending оплат, если transaction_id уже известен.
    const reconcile = await reconcilePendingPaymentsForEmail(email, 10);
    if (reconcile.success && reconcile.confirmedPayments.length > 0) {
      for (const confirmed of reconcile.confirmedPayments) {
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
          console.warn('⚠️ [PAYMENT STATUS] Не удалось отправить email о дозачислении:', mailError);
        }
      }
    }

    const balanceResult = await sql`
      SELECT balance, total_spent, updated_at
      FROM user_balances
      WHERE email = ${email}
      LIMIT 1
    `;

    const paymentsResult = await sql`
      SELECT id, amount, units, status, transaction_id, created_at, updated_at
      FROM payments
      WHERE email = ${email}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    const balanceRow = balanceResult.rows[0] || null;
    const payments = paymentsResult.rows || [];
    const lastCompletedPayment = payments.find((p: any) => p.status === 'completed') || null;
    const hasPendingPayments = payments.some((p: any) => p.status === 'pending');

    return NextResponse.json({
      success: true,
      email,
      balance: balanceRow ? Number(balanceRow.balance) : 0,
      totalSpent: balanceRow ? Number(balanceRow.total_spent || 0) : 0,
      balanceUpdatedAt: balanceRow?.updated_at || null,
      hasPendingPayments,
      lastCompletedPayment: lastCompletedPayment
        ? {
            id: lastCompletedPayment.id,
            amount: Number(lastCompletedPayment.amount),
            units: Number(lastCompletedPayment.units),
            status: lastCompletedPayment.status,
            transactionId: lastCompletedPayment.transaction_id || null,
            createdAt: lastCompletedPayment.created_at,
            updatedAt: lastCompletedPayment.updated_at,
          }
        : null,
      recentPayments: payments.map((p: any) => ({
        id: p.id,
        amount: Number(p.amount),
        units: Number(p.units),
        status: p.status,
        transactionId: p.transaction_id || null,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      })),
    });
  } catch (error: any) {
    console.error('❌ [PAYMENT STATUS] Ошибка:', error);
    return NextResponse.json({ success: false, error: 'Ошибка проверки статуса оплаты' }, { status: 500 });
  }
}

