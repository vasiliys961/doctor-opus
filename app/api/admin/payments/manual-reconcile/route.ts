import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions, isAdminEmail } from '@/lib/auth';
import { attachTransactionToPendingPayment, confirmPayment, initDatabase, sql } from '@/lib/database';
import { sendPaymentCreditedEmail } from '@/lib/email-service';
import { safeError, safeLog } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type ReconcilePair = {
  paymentId: number;
  operationId: string;
};

async function ensureAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdminEmail(session.user.email)) return null;
  return session;
}

function normalizePairs(rawPairs: any[]): ReconcilePair[] {
  const output: ReconcilePair[] = [];
  for (const row of rawPairs || []) {
    const paymentId = Number(row?.paymentId);
    const operationId = String(row?.operationId || '').trim();
    if (!Number.isInteger(paymentId) || paymentId <= 0) continue;
    if (!operationId) continue;
    output.push({ paymentId, operationId });
  }

  const uniq = new Map<string, ReconcilePair>();
  for (const p of output) {
    uniq.set(`${p.paymentId}:${p.operationId}`, p);
  }
  return Array.from(uniq.values()).slice(0, 500);
}

export async function POST(request: NextRequest) {
  try {
    const session = await ensureAdmin();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const pairs = normalizePairs(Array.isArray(body?.pairs) ? body.pairs : []);
    if (pairs.length === 0) {
      return NextResponse.json({ success: false, error: 'Передайте хотя бы одну пару paymentId -> operationId' }, { status: 400 });
    }

    await initDatabase();

    let processed = 0;
    let confirmed = 0;
    const confirmedPayments: Array<{
      paymentId: number;
      email: string;
      amount: number;
      units: number;
      transactionId: string;
    }> = [];
    const failures: Array<{ paymentId: number; operationId: string; reason: string }> = [];

    for (const pair of pairs) {
      processed += 1;
      try {
        const paymentRows = await sql`
          SELECT id, email, amount, units, status, transaction_id
          FROM payments
          WHERE id = ${pair.paymentId}
          LIMIT 1
        `;
        const payment = paymentRows.rows[0];
        if (!payment) {
          failures.push({ paymentId: pair.paymentId, operationId: pair.operationId, reason: 'payment not found' });
          continue;
        }

        const duplicateTx = await sql`
          SELECT id
          FROM payments
          WHERE transaction_id = ${pair.operationId}
            AND status = 'completed'
            AND id <> ${pair.paymentId}
          LIMIT 1
        `;
        if (duplicateTx.rows.length > 0) {
          failures.push({
            paymentId: pair.paymentId,
            operationId: pair.operationId,
            reason: `transaction already used by payment #${duplicateTx.rows[0].id}`,
          });
          continue;
        }

        const attachResult = await attachTransactionToPendingPayment(pair.paymentId, pair.operationId);
        if (!attachResult.success) {
          failures.push({ paymentId: pair.paymentId, operationId: pair.operationId, reason: 'attach transaction failed' });
          continue;
        }

        const confirmResult = await confirmPayment(pair.paymentId, pair.operationId);
        if (!confirmResult.success) {
          failures.push({ paymentId: pair.paymentId, operationId: pair.operationId, reason: 'confirmPayment failed' });
          continue;
        }

        if (!confirmResult.alreadyProcessed) {
          confirmed += 1;
          confirmedPayments.push({
            paymentId: Number(confirmResult.paymentId || pair.paymentId),
            email: String(confirmResult.email || payment.email),
            amount: Number(confirmResult.amount || payment.amount || 0),
            units: Number(confirmResult.units || payment.units || 0),
            transactionId: String(confirmResult.transactionId || pair.operationId),
          });
        }
      } catch (pairError: any) {
        failures.push({ paymentId: pair.paymentId, operationId: pair.operationId, reason: pairError?.message || 'unexpected error' });
      }
    }

    for (const confirmedItem of confirmedPayments) {
      try {
        const balanceResult = await sql`
          SELECT balance
          FROM user_balances
          WHERE email = ${confirmedItem.email}
          LIMIT 1
        `;
        const balanceAfter = balanceResult.rows[0]?.balance != null
          ? Number(balanceResult.rows[0].balance)
          : null;

        await sendPaymentCreditedEmail({
          email: confirmedItem.email,
          amountRub: confirmedItem.amount,
          units: confirmedItem.units,
          balanceAfter,
          paymentId: confirmedItem.paymentId,
          transactionId: confirmedItem.transactionId,
        });
      } catch (mailError) {
        safeError('⚠️ [ADMIN MANUAL RECONCILE] Не удалось отправить email о пополнении:', mailError);
      }
    }

    safeLog('🔧 [ADMIN MANUAL RECONCILE] Выполнено', {
      by: session.user.email,
      processed,
      confirmed,
      failures: failures.length,
    });

    return NextResponse.json({
      success: true,
      processed,
      confirmed,
      confirmedPayments,
      failures,
      initiatedBy: session.user.email,
    });
  } catch (error: any) {
    safeError('❌ [ADMIN MANUAL RECONCILE] Ошибка:', error?.message || error);
    return NextResponse.json({ success: false, error: 'Ошибка ручного дожатия pending-платежей' }, { status: 500 });
  }
}
