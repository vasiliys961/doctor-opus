import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { expireStalePendingPayments, initDatabase, reconcilePendingPaymentsForEmail, sql } from '@/lib/database';
import { sendPaymentCreditedEmail } from '@/lib/email-service';
import { bridgePendingPaymentsWithPayAnyWay } from '@/lib/payment/payanyway-bridge-reconcile';
import { isPayanywayPaymentMode } from '@/lib/payment/payment-mode';
import { reconcileYagodaPendingForEmail } from '@/lib/payment/yagoda-reconcile';
import { YAGODA_TOPUP_PACKAGE_ID } from '@/lib/payment/credit-pricing';

export const dynamic = 'force-dynamic';

function buildPendingDiagnostic(payment: any) {
  const createdAt = new Date(payment.created_at);
  const ageMinutes = Math.max(0, Math.floor((Date.now() - createdAt.getTime()) / 60000));
  const hasTx = Boolean(payment.transaction_id);
  const isYagoda = payment.package_id === YAGODA_TOPUP_PACKAGE_ID;

  if (hasTx) {
    return {
      reason: 'Операция найдена, ожидаем финальное подтверждение.',
      action: 'Ожидайте автоподтверждения. Если статус не изменится в течение 10 минут — обратитесь в поддержку.',
      ageMinutes,
    };
  }

  if (ageMinutes < 5) {
    return {
      reason: 'Платеж только создан и еще не завершен в платежной форме.',
      action: isYagoda
        ? 'Завершите оплату в Yagoda или подождите 1–2 минуты и нажмите «Проверить оплату сейчас».'
        : 'Завершите оплату в PayAnyWay или подождите 1-2 минуты и нажмите "Проверить оплату сейчас".',
      ageMinutes,
    };
  }

  if (ageMinutes < 30) {
    return {
      reason: isYagoda
        ? 'Платеж не завершен в Yagoda или страница оплаты была закрыта.'
        : 'Платеж не завершен в PayAnyWay или страница оплаты была закрыта.',
      action: 'Проверьте оплату в банке. Если списания не было — повторите оплату по новой ссылке.',
      ageMinutes,
    };
  }

  return {
    reason: 'Платеж долго остается без операции и, вероятно, не был завершен.',
    action: 'Запустите оплату повторно по новой ссылке. Старый pending будет автоматически помечен как истекший.',
    ageMinutes,
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    if (!email) {
      return NextResponse.json({ success: false, error: 'Необходима авторизация' }, { status: 401 });
    }

    await initDatabase();
    const expired = await expireStalePendingPayments({ email });

    let bridge: { confirmedPayments?: any[] } = { confirmedPayments: [] };
    let reconcile: { confirmedPayments?: any[] } = { confirmedPayments: [] };
    let yagodaRec: { confirmedPayments?: any[]; success?: boolean } = { confirmedPayments: [] };

    if (isPayanywayPaymentMode()) {
      bridge = await bridgePendingPaymentsWithPayAnyWay({ email, limit: 10 });
      reconcile = await reconcilePendingPaymentsForEmail(email, 10);
    } else {
      yagodaRec = await reconcileYagodaPendingForEmail(email, 10);
    }

    const confirmedPayments = [
      ...(bridge.confirmedPayments || []),
      ...(reconcile.confirmedPayments || []),
      ...(yagodaRec.confirmedPayments || []),
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
    const pendingPayments = payments.filter((p: any) => p.status === 'pending');
    const hasPendingPayments = pendingPayments.length > 0;
    const lastPendingPayment = pendingPayments.length > 0
      ? pendingPayments
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      : null;
    const pendingDiagnostic = lastPendingPayment ? buildPendingDiagnostic(lastPendingPayment) : null;

    return NextResponse.json({
      success: true,
      email,
      balance: balanceRow ? Number(balanceRow.balance) : 0,
      totalSpent: balanceRow ? Number(balanceRow.total_spent || 0) : 0,
      balanceUpdatedAt: balanceRow?.updated_at || null,
      hasPendingPayments,
      expiredByCleanup: expired,
      bridge,
      pendingDiagnostic: pendingDiagnostic
        ? {
            paymentId: Number(lastPendingPayment.id),
            amount: Number(lastPendingPayment.amount),
            units: Number(lastPendingPayment.units),
            transactionId: lastPendingPayment.transaction_id || null,
            createdAt: lastPendingPayment.created_at,
            ...pendingDiagnostic,
          }
        : null,
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
        pendingDiagnostic: p.status === 'pending' ? buildPendingDiagnostic(p) : null,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      })),
    });
  } catch (error: any) {
    console.error('❌ [PAYMENT STATUS] Ошибка:', error);
    return NextResponse.json({ success: false, error: 'Ошибка проверки статуса оплаты' }, { status: 500 });
  }
}

