import crypto from 'crypto';
import { attachTransactionToPendingPayment, confirmPayment, sql } from '@/lib/database';
import { safeError, safeLog, safeWarn } from '@/lib/logger';

type LookupConfig = {
  key: string;
  secret: string;
  account: string;
  endpoint: string;
};

type LookupResult = {
  found: boolean;
  operationId?: string;
  isSuccessful?: boolean;
  raw?: any;
};

type BridgeResult = {
  success: boolean;
  scanned: number;
  attached: number;
  confirmed: number;
  skippedReason?: string;
  confirmedPayments: Array<{
    paymentId: number;
    email: string;
    amount: number;
    units: number;
    transactionId: string;
  }>;
  failures: Array<{ paymentId: number; reason: string }>;
};

function getLookupConfig(): LookupConfig | null {
  const key = (process.env.PAYANYWAY_OPERATION_LOOKUP_KEY || '').trim();
  const secret = (process.env.PAYANYWAY_OPERATION_LOOKUP_SECRET || '').trim();
  const account = (process.env.PAYANYWAY_OPERATION_LOOKUP_ACCOUNT || process.env.PAYANYWAY_MNT_ID || '').trim();
  const endpoint = (process.env.PAYANYWAY_OPERATION_LOOKUP_ENDPOINT || 'https://bpa.payanyway.ru/api/getoperation').trim();
  if (!key || !secret || !account) return null;
  return { key, secret, account, endpoint };
}

function getNested(obj: any, path: string[]): any {
  let current = obj;
  for (const segment of path) {
    if (current == null) return undefined;
    current = current[segment];
  }
  return current;
}

function firstNonEmptyString(...values: any[]): string | null {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return null;
}

function parseLookupResponse(payload: any): LookupResult {
  if (!payload) return { found: false, raw: payload };

  const operationId = firstNonEmptyString(
    getNested(payload, ['id']),
    getNested(payload, ['operationId']),
    getNested(payload, ['operation']),
    getNested(payload, ['operationInfo', 'id']),
    getNested(payload, ['operationInfo', 'operationId']),
    getNested(payload, ['result', 'id']),
    getNested(payload, ['result', 'operationId']),
    Array.isArray(payload) ? payload[0]?.id : null,
    Array.isArray(payload) ? payload[0]?.operationId : null
  );

  const statusRaw = firstNonEmptyString(
    getNested(payload, ['status']),
    getNested(payload, ['state']),
    getNested(payload, ['operationInfo', 'status']),
    getNested(payload, ['operationInfo', 'state']),
    getNested(payload, ['result', 'status']),
    getNested(payload, ['result', 'state']),
    Array.isArray(payload) ? payload[0]?.status : null,
    Array.isArray(payload) ? payload[0]?.state : null
  );
  const status = (statusRaw || '').toLowerCase();

  const successBool = [
    getNested(payload, ['success']),
    getNested(payload, ['isSuccess']),
    getNested(payload, ['operationInfo', 'success']),
    getNested(payload, ['operationInfo', 'isSuccess']),
    getNested(payload, ['result', 'success']),
  ].find(v => typeof v === 'boolean');

  const hasSuccessStatus = [
    'success',
    'succeeded',
    'completed',
    'done',
    'processed',
    'paid',
    'выполн',
    'успеш',
    'оплачен',
  ].some(token => status.includes(token));

  const hasFailureStatus = [
    'fail',
    'failed',
    'error',
    'cancel',
    'canceled',
    'cancelled',
    'refund',
    'reversed',
    'pending',
    'hold',
    'freeze',
    'frozen',
    'заморож',
    'ожида',
  ].some(token => status.includes(token));

  const isSuccessful = typeof successBool === 'boolean'
    ? successBool
    : (hasSuccessStatus && !hasFailureStatus);

  return {
    found: Boolean(operationId),
    operationId: operationId || undefined,
    isSuccessful,
    raw: payload,
  };
}

async function lookupOperationByTransaction(transactionId: string, cfg: LookupConfig): Promise<LookupResult> {
  try {
    const signature = crypto
      .createHash('md5')
      .update(`${cfg.account}${transactionId}${cfg.secret}`)
      .digest('hex');

    const url = `${cfg.endpoint}?key=${encodeURIComponent(cfg.key)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          signature,
          account: cfg.account,
          transaction: transactionId,
          both: false,
        }),
      });
    } finally {
      clearTimeout(timeout);
    }

    const text = await response.text();
    let payload: any = null;
    try {
      payload = JSON.parse(text);
    } catch {
      safeWarn(`⚠️ [PAYANYWAY BRIDGE] Некорректный JSON lookup по tx=${transactionId}`);
      return { found: false };
    }

    if (!response.ok) {
      safeWarn(`⚠️ [PAYANYWAY BRIDGE] HTTP ${response.status} lookup по tx=${transactionId}`);
      return { found: false, raw: payload };
    }

    return parseLookupResponse(payload);
  } catch (error: any) {
    safeError(`❌ [PAYANYWAY BRIDGE] Ошибка lookup по tx=${transactionId}:`, error?.message || error);
    return { found: false };
  }
}

export async function bridgePendingPaymentsWithPayAnyWay(args?: { limit?: number; email?: string }): Promise<BridgeResult> {
  const cfg = getLookupConfig();
  if (!cfg) {
    return {
      success: true,
      scanned: 0,
      attached: 0,
      confirmed: 0,
      skippedReason: 'lookup config is not set',
      confirmedPayments: [],
      failures: [],
    };
  }

  const limit = Math.min(Math.max(args?.limit || 100, 1), 500);
  const email = (args?.email || '').trim().toLowerCase();

  try {
    const pending = email
      ? await sql`
          SELECT id, email, amount, units, created_at
          FROM payments
          WHERE status = 'pending'
            AND transaction_id IS NULL
            AND email = ${email}
          ORDER BY created_at ASC
          LIMIT ${limit}
        `
      : await sql`
          SELECT id, email, amount, units, created_at
          FROM payments
          WHERE status = 'pending'
            AND transaction_id IS NULL
          ORDER BY created_at ASC
          LIMIT ${limit}
        `;

    let scanned = 0;
    let attached = 0;
    let confirmed = 0;
    const confirmedPayments: BridgeResult['confirmedPayments'] = [];
    const failures: BridgeResult['failures'] = [];

    for (const row of pending.rows) {
      scanned += 1;
      const paymentId = Number(row.id);
      const lookup = await lookupOperationByTransaction(String(paymentId), cfg);
      if (!lookup.found || !lookup.operationId) continue;

      if (!lookup.isSuccessful) {
        failures.push({ paymentId, reason: 'operation exists but not successful' });
        continue;
      }

      const attach = await attachTransactionToPendingPayment(paymentId, lookup.operationId);
      if (!attach.success) {
        failures.push({ paymentId, reason: 'attach transaction failed' });
        continue;
      }
      attached += 1;

      const confirm = await confirmPayment(paymentId, lookup.operationId);
      if (!confirm.success) {
        failures.push({ paymentId, reason: 'confirmPayment failed after attach' });
        continue;
      }
      if (!confirm.alreadyProcessed) {
        confirmed += 1;
        confirmedPayments.push({
          paymentId: Number(confirm.paymentId || paymentId),
          email: String(confirm.email || row.email),
          amount: Number(confirm.amount || row.amount || 0),
          units: Number(confirm.units || row.units || 0),
          transactionId: String(confirm.transactionId || lookup.operationId),
        });
      }
    }

    safeLog('🔄 [PAYANYWAY BRIDGE] Выполнено', { scanned, attached, confirmed, failures: failures.length });
    return { success: true, scanned, attached, confirmed, confirmedPayments, failures };
  } catch (error: any) {
    safeError('❌ [PAYANYWAY BRIDGE] Ошибка bridge-reconcile:', error?.message || error);
    return { success: false, scanned: 0, attached: 0, confirmed: 0, confirmedPayments: [], failures: [{ paymentId: 0, reason: 'bridge failed' }] };
  }
}
