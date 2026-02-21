import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { initDatabase, sql } from '@/lib/database';
import { safeLog, safeError, safeWarn } from '@/lib/logger';
import { SUBSCRIPTION_PACKAGES } from '@/lib/subscription-manager';

/**
 * Webhook-обработчик уведомлений от PayAnyWay (Moneta.ru)
 * URL: POST /api/payment/payanyway
 *
 * Особенность витрины PayAnyWay:
 * Покупатель выбирает пакет самостоятельно по сумме. Мы определяем пакет
 * по сумме платежа (MNT_AMOUNT) и начисляем соответствующее количество единиц.
 *
 * Проверка подписи:
 * MD5(MNT_ID + MNT_TRANSACTION_ID + MNT_OPERATION_ID + MNT_AMOUNT + MNT_CURRENCY_CODE + MNT_TEST_MODE + MNT_SECRET_KEY)
 */

const MNT_ID = process.env.PAYANYWAY_MNT_ID || '';
const MNT_SECRET = process.env.PAYANYWAY_SECRET || '';

/** Находит пакет по сумме платежа (с допуском ±1 рубль) */
function findPackageByAmount(amount: number): {
  packageId: string;
  units: number;
  priceRub: number;
} | null {
  for (const [key, pkg] of Object.entries(SUBSCRIPTION_PACKAGES)) {
    if (Math.abs(pkg.priceRub - amount) <= 1) {
      return { packageId: key, units: pkg.credits, priceRub: pkg.priceRub };
    }
  }
  return null;
}


/**
 * Парсит тело запроса и возвращает два объекта:
 * - raw: значения как есть (для проверки подписи)
 * - decoded: URL-decoded значения (для использования в логике)
 */
async function parseBody(request: NextRequest): Promise<{
  raw: Record<string, string>;
  decoded: Record<string, string>;
}> {
  const raw: Record<string, string> = {};
  const decoded: Record<string, string> = {};

  try {
    const text = await request.text();

    // Парсим как urlencoded — получаем и raw и decoded
    text.split('&').forEach(pair => {
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) return;
      const rawKey = pair.slice(0, eqIdx);
      const rawVal = pair.slice(eqIdx + 1);
      const key = decodeURIComponent(rawKey);
      raw[key] = rawVal;                          // сырое значение (для подписи)
      decoded[key] = decodeURIComponent(rawVal);  // декодированное (для логики)
    });
  } catch {
    // Если всё упало — возвращаем пустые объекты
  }

  return { raw, decoded };
}

/** Проверяет MD5-подпись используя raw (не декодированные) значения */
function validateSignatureRaw(raw: Record<string, string>): boolean {
  const id = raw.MNT_ID || '';
  const txId = raw.MNT_TRANSACTION_ID || '';
  const opId = raw.MNT_OPERATION_ID || '';
  const amount = raw.MNT_AMOUNT || '';
  const currency = raw.MNT_CURRENCY_CODE || '';
  const subscriberId = raw.MNT_SUBSCRIBER_ID || '';
  const testMode = raw.MNT_TEST_MODE || '';
  const signature = raw.MNT_SIGNATURE || '';

  const str = `${id}${txId}${opId}${amount}${currency}${subscriberId}${testMode}${MNT_SECRET}`;
  const expected = crypto.createHash('md5').update(str).digest('hex');

  safeLog(`💳 [PAYANYWAY] Строка для подписи: ${str}`);
  safeLog(`💳 [PAYANYWAY] Ожидаемая подпись: ${expected}`);
  safeLog(`💳 [PAYANYWAY] Полученная подпись: ${signature}`);

  return expected.toLowerCase() === signature.toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const { raw, decoded } = await parseBody(request);

    const contentType = request.headers.get('content-type') || 'unknown';
    safeLog(`💳 [PAYANYWAY] Content-Type: ${contentType}`);
    safeLog(`💳 [PAYANYWAY] Raw данные: ${JSON.stringify(raw)}`);
    safeLog(`💳 [PAYANYWAY] Decoded данные: ${JSON.stringify(decoded)}`);

    // Используем decoded для бизнес-логики, raw для подписи
    const data = decoded;

    // Проверяем, что MNT_ID совпадает (базовая защита)
    if (data.MNT_ID !== MNT_ID) {
      safeWarn(`⚠️ [PAYANYWAY] Неверный MNT_ID: ${data.MNT_ID}`);
      return new Response('FAIL', { status: 200 });
    }

    // Проверяем подпись используя raw значения (как их считает PayAnyWay)
    if (!validateSignatureRaw(raw)) {
      safeError('❌ [PAYANYWAY] Неверная подпись!');
      return new Response('FAIL', { status: 200 });
    }

    const amount = parseFloat(data.MNT_AMOUNT || '0');
    const operationId = data.MNT_OPERATION_ID || '';

    // По документации Moneta.ru email покупателя передаётся в MNT_SUBSCRIBER_ID
    const email = (data.MNT_SUBSCRIBER_ID || '').toLowerCase().trim();

    safeLog(`💳 [PAYANYWAY] Все поля: ${JSON.stringify(Object.keys(data))}`);

    if (!email) {
      safeWarn(`⚠️ [PAYANYWAY] MNT_SUBSCRIBER_ID пуст. Все данные: ${JSON.stringify(data)}`);
      return new Response('FAIL', { status: 200 });
    }

    // Определяем пакет по сумме
    const pkg = findPackageByAmount(amount);
    if (!pkg) {
      safeError(`❌ [PAYANYWAY] Не найден пакет для суммы ${amount} руб.`);
      return new Response('FAIL', { status: 200 });
    }

    safeLog(`✅ [PAYANYWAY] Платёж подтверждён: ${email}, ${pkg.units} ед., операция ${operationId}`);

    await initDatabase();

    // Идемпотентность: проверяем, не обрабатывали ли этот operation_id ранее
    const { rows: existing } = await sql`
      SELECT id FROM payments WHERE transaction_id = ${operationId} AND status = 'completed'
    `;
    if (existing.length > 0) {
      safeLog(`ℹ️ [PAYANYWAY] Операция ${operationId} уже обработана (идемпотентность)`);
      return new Response('SUCCESS', { status: 200 });
    }

    // Сохраняем платёж в БД
    const { rows: paymentRows } = await sql`
      INSERT INTO payments (email, amount, units, package_id, status, transaction_id)
      VALUES (${email}, ${amount}, ${pkg.units}, ${pkg.packageId}, 'completed', ${operationId})
      RETURNING id
    `;
    const paymentId = paymentRows[0]?.id;

    // Начисляем единицы на баланс пользователя
    await sql`
      INSERT INTO user_balances (email, balance, is_test_account)
      VALUES (${email}, ${pkg.units}, false)
      ON CONFLICT (email)
      DO UPDATE SET
        balance = user_balances.balance + ${pkg.units},
        is_test_account = false,
        updated_at = CURRENT_TIMESTAMP
    `;

    // Логируем транзакцию
    await sql`
      INSERT INTO credit_transactions (email, amount, operation, metadata, balance_after)
      SELECT ${email}, ${pkg.units}, ${'Пополнение (PayAnyWay)'}, ${JSON.stringify({ paymentId, operationId, packageId: pkg.packageId })}::jsonb, balance
      FROM user_balances WHERE email = ${email}
    `;

    safeLog(`💰 [PAYANYWAY] Баланс ${email} пополнен на ${pkg.units} ед. (платёж #${paymentId})`);

    // PayAnyWay ожидает ответ "SUCCESS"
    return new Response('SUCCESS', { status: 200 });

  } catch (error: any) {
    safeError('❌ [PAYANYWAY] Ошибка обработки webhook:', error?.message);
    return new Response('FAIL', { status: 500 });
  }
}
