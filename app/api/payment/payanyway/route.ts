import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { initDatabase, sql } from '@/lib/database';
import { safeLog, safeError, safeWarn } from '@/lib/logger';
import { SUBSCRIPTION_PACKAGES } from '@/lib/subscription-manager';

/**
 * Webhook-обработчик уведомлений от PayAnyWay (Moneta.ru)
 * URL: POST /api/payment/payanyway
 *
 * Обрабатывает два типа запросов:
 * 1. Check URL (проверочный) — приходит ДО оплаты, MNT_OPERATION_ID отсутствует.
 *    Ответ: JSON с данными о товаре для фискализации чека.
 * 2. Pay URL (уведомление об оплате) — MNT_OPERATION_ID присутствует.
 *    Ответ: XML с кодом 200 и номенклатурой.
 *
 * Подпись входящего запроса:
 *   MD5(MNT_ID + MNT_TRANSACTION_ID + MNT_OPERATION_ID + MNT_AMOUNT + MNT_CURRENCY_CODE + MNT_SUBSCRIBER_ID + MNT_TEST_MODE + SECRET)
 *
 * Подпись ответа:
 *   MD5(resultCode + MNT_ID + MNT_TRANSACTION_ID + SECRET)
 */

const MNT_ID = process.env.PAYANYWAY_MNT_ID || '';
const MNT_SECRET = process.env.PAYANYWAY_SECRET || '';

type Package = {
  packageId: string;
  units: number;
  priceRub: number;
  name: string;
};

/** Находит пакет по сумме платежа (с допуском ±1 рубль) */
function findPackageByAmount(amount: number): Package | null {
  for (const [key, pkg] of Object.entries(SUBSCRIPTION_PACKAGES)) {
    if (Math.abs(pkg.priceRub - amount) <= 1) {
      return { packageId: key, units: pkg.credits, priceRub: pkg.priceRub, name: pkg.name };
    }
  }
  return null;
}

/**
 * Парсит тело запроса и возвращает:
 * - raw: значения как есть из body (для проверки подписи)
 * - decoded: URL-decoded значения (для бизнес-логики)
 */
async function parseBody(request: NextRequest): Promise<{
  raw: Record<string, string>;
  decoded: Record<string, string>;
}> {
  const raw: Record<string, string> = {};
  const decoded: Record<string, string> = {};

  try {
    const text = await request.text();
    text.split('&').forEach(pair => {
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) return;
      const rawKey = pair.slice(0, eqIdx);
      const rawVal = pair.slice(eqIdx + 1);
      const key = decodeURIComponent(rawKey);
      raw[key] = rawVal;
      decoded[key] = decodeURIComponent(rawVal);
    });
  } catch {
    // возвращаем пустые объекты
  }

  return { raw, decoded };
}

/** Проверяет MD5-подпись входящего запроса используя raw значения */
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

  safeLog(`💳 [PAYANYWAY] Строка для подписи: ${str.replace(MNT_SECRET, '***')}`);
  safeLog(`💳 [PAYANYWAY] Ожидаемая подпись: ${expected}`);
  safeLog(`💳 [PAYANYWAY] Полученная подпись: ${signature}`);

  return expected.toLowerCase() === signature.toLowerCase();
}

/** Подпись для ответа: MD5(resultCode + MNT_ID + MNT_TRANSACTION_ID + SECRET) */
function buildResponseSignature(resultCode: string, txId: string): string {
  return crypto.createHash('md5').update(`${resultCode}${MNT_ID}${txId}${MNT_SECRET}`).digest('hex');
}

/** Экранирует спецсимволы для XML-атрибутов и значений */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * XML-ответ на Pay URL уведомление.
 * resultCode: 200 = успех, 500 = ошибка/отмена
 */
function buildPayUrlXml(txId: string, resultCode: string, email: string, pkg: Package | null): string {
  const signature = buildResponseSignature(resultCode, txId);
  const itemName = pkg
    ? pkg.name.replace(/[&"'<>#$\\\/]/g, ' ')
    : 'Пакет единиц Doctor Opus';
  const itemPrice = pkg ? pkg.priceRub.toFixed(2) : '0.00';

  const inventoryItem = {
    name: itemName,
    price: itemPrice,
    quantity: '1',
    vatTag: '1105',       // без НДС (самозанятые)
    pm: 'full_payment',   // полный расчёт
    po: 'service',        // услуга
  };

  const inventoryJson = escapeXml(JSON.stringify([inventoryItem]));

  return `<?xml version="1.0" encoding="UTF-8"?>
<mnt_response>
  <mnt_id>${MNT_ID}</mnt_id>
  <mnt_transaction_id>${escapeXml(txId)}</mnt_transaction_id>
  <mnt_result_code>${resultCode}</mnt_result_code>
  <mnt_signature>${signature}</mnt_signature>
  <mnt_attributes>
    <attribute>
      <key>CUSTOMER</key>
      <value>${escapeXml(email)}</value>
    </attribute>
    <attribute>
      <key>INVENTORY</key>
      <value>${inventoryJson}</value>
    </attribute>
  </mnt_attributes>
</mnt_response>`;
}

/**
 * JSON-ответ на Check URL (проверочный запрос до оплаты).
 * resultCode 402 = заказ готов к оплате.
 */
function buildCheckUrlJson(txId: string, amount: number, email: string, pkg: Package | null): object {
  const resultCode = '402';
  const signature = buildResponseSignature(resultCode, txId);
  const itemName = pkg ? pkg.name : 'Пакет единиц Doctor Opus';
  const itemPrice = pkg ? pkg.priceRub : amount;

  return {
    id: MNT_ID,
    transactionId: txId,
    amount: itemPrice.toFixed(2),
    signature,
    resultCode,
    description: 'Заказ создан и готов к оплате',
    receipt: {
      client: {
        email,
      },
      items: [
        {
          name: itemName,
          price: itemPrice,
          quantity: 1,
          paymentMethod: 'full_payment',
          paymentObject: 'service',
          vat: 'none',
        },
      ],
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const { raw, decoded } = await parseBody(request);

    const contentType = request.headers.get('content-type') || 'unknown';
    safeLog(`💳 [PAYANYWAY] Content-Type: ${contentType}`);
    safeLog(`💳 [PAYANYWAY] Raw данные: ${JSON.stringify(raw)}`);
    safeLog(`💳 [PAYANYWAY] Decoded данные: ${JSON.stringify(decoded)}`);

    const data = decoded;

    // Базовая защита: проверяем MNT_ID
    if (data.MNT_ID !== MNT_ID) {
      safeWarn(`⚠️ [PAYANYWAY] Неверный MNT_ID: ${data.MNT_ID}`);
      return new Response('FAIL', { status: 200 });
    }

    // Проверяем подпись по raw значениям
    if (!validateSignatureRaw(raw)) {
      safeError('❌ [PAYANYWAY] Неверная подпись!');
      return new Response('FAIL', { status: 200 });
    }

    const txId = data.MNT_TRANSACTION_ID || '';
    const amount = parseFloat(data.MNT_AMOUNT || '0');
    const email = (data.MNT_SUBSCRIBER_ID || '').toLowerCase().trim();
    const pkg = findPackageByAmount(amount);

    // Check URL: MNT_OPERATION_ID отсутствует — запрос ДО оплаты
    if (!data.MNT_OPERATION_ID) {
      safeLog(`🔍 [PAYANYWAY] Check URL: txId=${txId}, amount=${amount}, email=${email}`);
      const response = buildCheckUrlJson(txId, amount, email, pkg);
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      });
    }

    // Pay URL: уведомление об успешной оплате
    const operationId = data.MNT_OPERATION_ID;
    safeLog(`💳 [PAYANYWAY] Pay URL: txId=${txId}, operationId=${operationId}, email=${email}`);

    if (!email) {
      safeWarn(`⚠️ [PAYANYWAY] MNT_SUBSCRIBER_ID пуст`);
      const xml = buildPayUrlXml(txId, '500', '', null);
      return new Response(xml, {
        status: 200,
        headers: { 'Content-Type': 'application/xml; charset=UTF-8' },
      });
    }

    if (!pkg) {
      safeError(`❌ [PAYANYWAY] Не найден пакет для суммы ${amount} руб.`);
      const xml = buildPayUrlXml(txId, '500', email, null);
      return new Response(xml, {
        status: 200,
        headers: { 'Content-Type': 'application/xml; charset=UTF-8' },
      });
    }

    safeLog(`✅ [PAYANYWAY] Платёж подтверждён: ${email}, ${pkg.units} ед., операция ${operationId}`);

    await initDatabase();

    // Идемпотентность: не обрабатываем дважды
    const { rows: existing } = await sql`
      SELECT id FROM payments WHERE transaction_id = ${operationId} AND status = 'completed'
    `;
    if (existing.length > 0) {
      safeLog(`ℹ️ [PAYANYWAY] Операция ${operationId} уже обработана`);
      const xml = buildPayUrlXml(txId, '200', email, pkg);
      return new Response(xml, {
        status: 200,
        headers: { 'Content-Type': 'application/xml; charset=UTF-8' },
      });
    }

    // Сохраняем платёж
    const { rows: paymentRows } = await sql`
      INSERT INTO payments (email, amount, units, package_id, status, transaction_id)
      VALUES (${email}, ${amount}, ${pkg.units}, ${pkg.packageId}, 'completed', ${operationId})
      RETURNING id
    `;
    const paymentId = paymentRows[0]?.id;

    // Начисляем единицы на баланс
    await sql`
      INSERT INTO user_balances (email, balance, is_test_account)
      VALUES (${email}, ${pkg.units}, false)
      ON CONFLICT (email)
      DO UPDATE SET
        balance = user_balances.balance + ${pkg.units},
        is_test_account = false,
        updated_at = CURRENT_TIMESTAMP
    `;

    // Логируем транзакцию (некритично)
    try {
      await sql`
        INSERT INTO credit_transactions (email, amount, operation, metadata, balance_after)
        SELECT ${email}, ${pkg.units}, ${'Пополнение (PayAnyWay)'}, ${JSON.stringify({ paymentId, operationId, packageId: pkg.packageId })}::jsonb, balance
        FROM user_balances WHERE email = ${email}
      `;
    } catch (logErr: any) {
      safeWarn(`⚠️ [PAYANYWAY] Не удалось записать credit_transactions: ${logErr?.message}`);
    }

    safeLog(`💰 [PAYANYWAY] Баланс ${email} пополнен на ${pkg.units} ед. (платёж #${paymentId})`);

    const xml = buildPayUrlXml(txId, '200', email, pkg);
    return new Response(xml, {
      status: 200,
      headers: { 'Content-Type': 'application/xml; charset=UTF-8' },
    });

  } catch (error: any) {
    safeError('❌ [PAYANYWAY] Ошибка обработки webhook:', error?.message);
    return new Response('FAIL', { status: 500 });
  }
}
