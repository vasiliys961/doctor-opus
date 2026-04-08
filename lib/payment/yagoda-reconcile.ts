import { confirmPayment, initDatabase, sql } from '@/lib/database';
import { safeLog, safeWarn } from '@/lib/logger';
import { YAGODA_TOPUP_PACKAGE_ID } from './credit-pricing';
import { yagodaFetchOrderStatuses } from './yagoda-api';

export type YagodaReconcileResult = {
  success: boolean;
  confirmedPayments: Array<{
    paymentId: number;
    email: string;
    amount: number;
    units: number;
    transactionId: string;
  }>;
};

/**
 * Для pending-платежей Yagoda опрашивает API статусов (если webhook опоздал или не дошёл).
 */
export async function reconcileYagodaPendingForEmail(
  email: string,
  limit = 10
): Promise<YagodaReconcileResult> {
  const confirmedPayments: YagodaReconcileResult['confirmedPayments'] = [];

  try {
    await initDatabase();

    const candidates = await sql`
      SELECT id, email, amount, units
      FROM payments
      WHERE email = ${email}
        AND (
          status = 'pending'
          OR (
            status = 'failed'
            AND created_at >= CURRENT_TIMESTAMP - INTERVAL '72 hours'
          )
        )
        AND package_id = ${YAGODA_TOPUP_PACKAGE_ID}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    const rows = candidates.rows as Array<{
      id: number;
      email: string;
      amount: string | number;
      units: string | number;
    }>;

    if (rows.length === 0) {
      return { success: true, confirmedPayments };
    }

    const orderIds = rows.map((r) => String(r.id));
    const statuses = await yagodaFetchOrderStatuses(orderIds);
    const payedIds = new Set(
      statuses.filter((s) => s.status === 'payed' || s.status === 'paid').map((s) => s.external_id)
    );

    for (const row of rows) {
      const idStr = String(row.id);
      if (!payedIds.has(idStr)) continue;

      const txId = `yagoda_poll_${row.id}`;
      const result = await confirmPayment(row.id, txId);
      if (result.success && !result.alreadyProcessed) {
        confirmedPayments.push({
          paymentId: row.id,
          email: row.email,
          amount: Number(result.amount ?? row.amount),
          units: Number(result.units ?? row.units),
          transactionId: String(result.transactionId || txId),
        });
        safeLog(`✅ [YAGODA RECONCILE] Платёж #${row.id} подтверждён по опросу API`);
      } else if (result.success && result.alreadyProcessed) {
        safeLog(`ℹ️ [YAGODA RECONCILE] Платёж #${row.id} уже был подтверждён`);
      } else {
        safeWarn(`⚠️ [YAGODA RECONCILE] Не удалось подтвердить #${row.id}`);
      }
    }

    return { success: true, confirmedPayments };
  } catch (e: any) {
    safeWarn(`⚠️ [YAGODA RECONCILE] ${e?.message || e}`);
    return { success: false, confirmedPayments };
  }
}
