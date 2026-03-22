import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { getDbClient, initDatabase, confirmPayment } from '@/lib/database';
import { safeLog, safeError, safeWarn } from '@/lib/logger';
import { SUBSCRIPTION_PACKAGES } from '@/lib/subscription-manager';

/**
 * Webhook-обработчик уведомлений от PayAnyWay (Moneta.ru)
 * URL: POST /api/payment/payanyway
 *
 * Обрабатывает два типа запросов:
 * 1. Check URL (проверочный) — приходит ДО оплаты, обычно с MNT_COMMAND=CHECK.
 *    Ответ: XML (по спецификации MONETA.Assistant).
 * 2. Pay URL (уведомление об оплате) — MNT_OPERATION_ID присутствует.
 *    Ответ: XML с кодом 200 и номенклатурой.
 *
 * Подпись входящего Pay URL:
 *   MD5(MNT_ID + MNT_TRANSACTION_ID + MNT_OPERATION_ID + MNT_AMOUNT + MNT_CURRENCY_CODE + MNT_SUBSCRIBER_ID + MNT_TEST_MODE + SECRET)
 *
 * Подпись входящего Check URL:
 *   MD5(MNT_COMMAND + MNT_ID + MNT_TRANSACTION_ID + MNT_OPERATION_ID + MNT_AMOUNT + MNT_CURRENCY_CODE + MNT_SUBSCRIBER_ID + MNT_TEST_MODE + SECRET)
 *
 * Подпись ответа:
 *   MD5(resultCode + MNT_ID + MNT_TRANSACTION_ID + SECRET)
 */

const MNT_ID = process.env.PAYANYWAY_MNT_ID || '';
const MNT_SECRET = process.env.PAYANYWAY_SECRET || '';
const PAYANYWAY_STOREFRONT_ENABLED = ['1', 'true', 'yes', 'on'].includes(
  (process.env.PAYANYWAY_STOREFRONT_ENABLED || '').toLowerCase()
);
const PAYANYWAY_AGENT_TYPE = process.env.PAYANYWAY_AGENT_TYPE || 'commission';
const PAYANYWAY_SUPPLIER_NAME = process.env.PAYANYWAY_SUPPLIER_NAME || '';
const PAYANYWAY_SUPPLIER_INN = process.env.PAYANYWAY_SUPPLIER_INN || '';
const PAYANYWAY_SELLER_ACCOUNT = process.env.PAYANYWAY_SELLER_ACCOUNT || '';
const PAYANYWAY_STOREFRONT_TOKEN = process.env.PAYANYWAY_STOREFRONT_TOKEN || '';
const PAYANYWAY_SUPPLIER_PHONES = (process.env.PAYANYWAY_SUPPLIER_PHONES || '')
  .split(',')
  .map(v => v.trim())
  .filter(Boolean);

type Package = {
  packageId: string;
  units: number;
  priceRub: number;
  name: string;
};

type ReceiptContext = {
  customerEmail: string;
  phone?: string;
  clientName?: string;
  clientInn?: string;
  delivery?: number;
};

type StorefrontPayload = {
  action: string;
  customerEmail: string;
  productCode?: string;
  productPrice?: string;
  productPriceWithDiscount?: string;
  productQuantity?: string;
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
    parseEncodedPairs(text, raw, decoded);
  } catch {
    // возвращаем пустые объекты
  }

  return { raw, decoded };
}

function decodeFormComponent(value: string): string {
  return decodeURIComponent(value.replace(/\+/g, ' '));
}

function parseEncodedPairs(
  encoded: string,
  raw: Record<string, string>,
  decoded: Record<string, string>
): void {
  if (!encoded) return;
  encoded.split('&').forEach(pair => {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) return;
    const rawKey = pair.slice(0, eqIdx);
    const rawVal = pair.slice(eqIdx + 1);
    const key = decodeFormComponent(rawKey);
    raw[key] = rawVal;
    decoded[key] = decodeFormComponent(rawVal);
  });
}

function buildSignatureSource(data: Record<string, string>, isCheck: boolean): string {
  const command = data.MNT_COMMAND || '';
  const id = data.MNT_ID || '';
  const txId = data.MNT_TRANSACTION_ID || '';
  const opId = data.MNT_OPERATION_ID || '';
  const amount = data.MNT_AMOUNT || '';
  const currency = data.MNT_CURRENCY_CODE || '';
  const subscriberId = data.MNT_SUBSCRIBER_ID || '';
  const testMode = data.MNT_TEST_MODE || '';

  return isCheck
    ? `${command}${id}${txId}${opId}${amount}${currency}${subscriberId}${testMode}${MNT_SECRET}`
    : `${id}${txId}${opId}${amount}${currency}${subscriberId}${testMode}${MNT_SECRET}`;
}

/** Проверяет MD5-подпись входящего запроса (совместимо с raw/decode вариациями кодирования) */
function validateSignature(raw: Record<string, string>, decoded: Record<string, string>, isCheck: boolean): boolean {
  const signature = (raw.MNT_SIGNATURE || decoded.MNT_SIGNATURE || '').toLowerCase();

  const rawSource = buildSignatureSource(raw, isCheck);
  const rawExpected = crypto.createHash('md5').update(rawSource).digest('hex').toLowerCase();

  const decodedSource = buildSignatureSource(decoded, isCheck);
  const decodedExpected = crypto.createHash('md5').update(decodedSource).digest('hex').toLowerCase();

  safeLog(`💳 [PAYANYWAY] Строка подписи (raw): ${rawSource.replace(MNT_SECRET, '***')}`);
  safeLog(`💳 [PAYANYWAY] Ожидаемая подпись (raw): ${rawExpected}`);
  safeLog(`💳 [PAYANYWAY] Строка подписи (decoded): ${decodedSource.replace(MNT_SECRET, '***')}`);
  safeLog(`💳 [PAYANYWAY] Ожидаемая подпись (decoded): ${decodedExpected}`);
  safeLog(`💳 [PAYANYWAY] Полученная подпись: ${signature}`);

  return signature === rawExpected || signature === decodedExpected;
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

/** Убираем символы, которые PayAnyWay не рекомендует передавать в значениях. */
function sanitizeReceiptValue(value: string): string {
  return value.replace(/["'&$#\\\/<>]/g, ' ').replace(/\s+/g, ' ').trim();
}

function sanitizePhone(value: string): string {
  return value.replace(/\D/g, '').slice(0, 13);
}

function sanitizeInn(value: string): string {
  return value.replace(/\D/g, '').slice(0, 12);
}

function parseDelivery(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = parseFloat(value.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Number(parsed.toFixed(2));
}

function parsePositiveNumber(value?: string): number | null {
  if (!value) return null;
  const parsed = parseFloat(value.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function parsePositiveInt(value?: string, fallback = 1): number {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function secureEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function isStorefrontAuthorized(data: Record<string, string>): boolean {
  // Без явного включения storefront-flow мы не принимаем callback этого типа.
  if (!PAYANYWAY_STOREFRONT_ENABLED) return false;
  // В production storefront-callback без токена недопустим — иначе возможны ложные зачисления.
  if (!PAYANYWAY_STOREFRONT_TOKEN) {
    safeWarn('⚠️ [PAYANYWAY STOREFRONT] CALLBACK отклонён: PAYANYWAY_STOREFRONT_TOKEN не задан');
    return false;
  }
  const token = (data.token || data.secret || data.sig || '').trim();
  if (!token) return false;
  return secureEquals(token, PAYANYWAY_STOREFRONT_TOKEN);
}

function buildInventoryItem(itemName: string, itemPrice: string) {
  const name = sanitizeReceiptValue(itemName);
  const item: Record<string, any> = {
    // Совместимость с требованиями номенклатуры PayAnyWay/BPA.
    productName: name,
    productPrice: Number(itemPrice),
    productQuantity: 1,
    productVatCode: 1105, // НДС не облагается
    pm: 'full_payment',
    po: 'service',

    // Legacy-поля для обратной совместимости MONETA.Assistant.
    name,
    price: itemPrice,
    quantity: '1',
    vatTag: '1105',
  };

  if (PAYANYWAY_SELLER_ACCOUNT) item.sellerAccount = PAYANYWAY_SELLER_ACCOUNT;
  if (PAYANYWAY_SUPPLIER_INN) item.sellerInn = sanitizeInn(PAYANYWAY_SUPPLIER_INN);
  if (PAYANYWAY_SUPPLIER_NAME) item.sellerName = sanitizeReceiptValue(PAYANYWAY_SUPPLIER_NAME);
  if (PAYANYWAY_SUPPLIER_PHONES.length > 0) item.sellerPhone = sanitizePhone(PAYANYWAY_SUPPLIER_PHONES[0]);

  return item;
}

function buildMntAttributesXml(inventoryJson: string, context: ReceiptContext): string {
  const attributes: Array<{ key: string; value: string }> = [
    { key: 'INVENTORY', value: inventoryJson },
    { key: 'inventory', value: inventoryJson }, // совместимость: некоторые витрины ожидают lowercase
    { key: 'CUSTOMER', value: sanitizeReceiptValue(context.customerEmail) },
  ];

  if (context.clientName || context.clientInn) {
    const client = [{
      ...(context.clientName ? { name: sanitizeReceiptValue(context.clientName) } : {}),
      ...(context.clientInn ? { inn: sanitizeInn(context.clientInn) } : {}),
    }];
    attributes.push({ key: 'CLIENT', value: JSON.stringify(client) });
  }

  if (context.phone) {
    attributes.push({ key: 'PHONE', value: sanitizePhone(context.phone) });
  }

  if (typeof context.delivery === 'number') {
    attributes.push({ key: 'DELIVERY', value: context.delivery.toFixed(2) });
  }

  return attributes.map(({ key, value }) => `    <ATTRIBUTE>
      <KEY>${key}</KEY>
      <VALUE>${escapeXml(value)}</VALUE>
    </ATTRIBUTE>`).join('\n');
}

function extractReceiptContext(data: Record<string, string>, email: string): ReceiptContext {
  return {
    customerEmail: email,
    phone: data.PHONE || data.MNT_PHONE || data.CUSTOMER_PHONE || '',
    clientName: data.CLIENT_NAME || data.MNT_CLIENT_NAME || '',
    clientInn: data.CLIENT_INN || data.MNT_CLIENT_INN || '',
    delivery: parseDelivery(data.DELIVERY || data.MNT_DELIVERY || data.DELIVERY_AMOUNT),
  };
}

function extractStorefrontPayload(data: Record<string, string>): StorefrontPayload | null {
  const action = (data.action || '').toLowerCase().trim();
  const customerEmail = (data.customerEmail || '').toLowerCase().trim();
  if (action !== 'purchased' || !customerEmail) return null;

  return {
    action,
    customerEmail,
    productCode: data.productCode || '',
    productPrice: data.productPrice || '',
    productPriceWithDiscount: data.productPriceWithDiscount || '',
    productQuantity: data.productQuantity || '1',
  };
}

function buildStorefrontTransactionId(
  payload: StorefrontPayload,
  raw: Record<string, string>
): string {
  // Приоритет: уникальный ID от PayAnyWay (проверяем все возможные названия поля)
  const explicitId =
    raw.MNT_OPERATION_ID ||
    raw.MNT_TRANSACTION_ID ||
    raw.transactionId ||
    raw.operationId ||
    raw.orderId ||
    raw.paymentId ||
    raw.invoiceId ||
    raw.id ||
    '';

  if (explicitId) {
    return `storefront:${sanitizeReceiptValue(explicitId)}`;
  }

  // PayAnyWay storefront не передаёт уникальный ID операции.
  // Используем 2-часовое окно: ретраи одного callback дедуплицируются,
  // но отдельные платежи в разные часы получают разные ID и зачисляются.
  const twoHourWindow = Math.floor(Date.now() / (2 * 3600 * 1000));
  const price = payload.productPriceWithDiscount || payload.productPrice || '';
  const canonical = `${payload.customerEmail}:${price}:${twoHourWindow}`;
  const hash = crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 20);
  return `storefront:${payload.customerEmail}:${hash}`;
}

async function applyCompletedPayment(args: {
  email: string;
  amount: number;
  units: number;
  packageId: string;
  transactionId: string;
  operationLabel: string;
  metadata?: Record<string, unknown>;
}): Promise<{ success: boolean; alreadyProcessed?: boolean; paymentId?: number }> {
  const client = await getDbClient();
  try {
    await client.query('BEGIN');
    // Блокируем обработку конкретного transactionId в рамках транзакции.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [args.transactionId]);

    const existing = await client.query(
      `SELECT id FROM payments WHERE transaction_id = $1 AND status = 'completed' FOR UPDATE`,
      [args.transactionId]
    );
    if (existing.rows.length > 0) {
      await client.query('COMMIT');
      return { success: true, alreadyProcessed: true, paymentId: existing.rows[0].id };
    }

    const paymentRows = await client.query(
      `INSERT INTO payments (email, amount, units, package_id, status, transaction_id)
       VALUES ($1, $2, $3, $4, 'completed', $5)
       RETURNING id`,
      [args.email, args.amount, args.units, args.packageId, args.transactionId]
    );
    const paymentId = paymentRows.rows[0]?.id ?? null;

    await client.query(
      `INSERT INTO user_balances (email, balance, is_test_account)
       VALUES ($1, $2, false)
       ON CONFLICT (email)
       DO UPDATE SET
         balance = user_balances.balance + $2,
         is_test_account = false,
         updated_at = CURRENT_TIMESTAMP`,
      [args.email, args.units]
    );

    try {
      await client.query(
        `INSERT INTO credit_transactions (email, amount, operation, metadata, balance_after)
         SELECT $1::varchar, $2::numeric, $3::text, $4::jsonb, balance
         FROM user_balances WHERE email = $5::varchar`,
        [
          args.email,
          args.units,
          args.operationLabel,
          JSON.stringify(args.metadata || {}),
          args.email,
        ]
      );
    } catch (logErr: any) {
      safeWarn(`⚠️ [PAYANYWAY] Не удалось записать credit_transactions: ${logErr?.message}`);
    }

    await client.query('COMMIT');
    return { success: true, paymentId: paymentId ?? undefined };
  } catch (error: any) {
    try { await client.query('ROLLBACK'); } catch {}
    safeError('❌ [PAYANYWAY] Ошибка транзакции платежа:', error?.message);
    return { success: false };
  } finally {
    client.release();
  }
}

async function handleStorefrontCallback(
  payload: StorefrontPayload,
  raw: Record<string, string>
): Promise<Response> {
  if (!isStorefrontAuthorized(raw)) {
    safeWarn(`⚠️ [PAYANYWAY STOREFRONT] Отклонён callback: неверный токен`);
    return new Response('FAIL', { status: 200 });
  }

  if (!isValidEmail(payload.customerEmail)) {
    safeWarn(`⚠️ [PAYANYWAY STOREFRONT] Некорректный email: ${payload.customerEmail}`);
    return new Response('FAIL', { status: 200 });
  }

  const quantity = parsePositiveInt(payload.productQuantity, 1);
  const price =
    parsePositiveNumber(payload.productPriceWithDiscount) ??
    parsePositiveNumber(payload.productPrice);

  if (!price) {
    safeError(`❌ [PAYANYWAY STOREFRONT] Некорректная цена: ${payload.productPrice}`);
    return new Response('FAIL', { status: 200 });
  }

  const totalAmount = Number((price * quantity).toFixed(2));
  const pkg = findPackageByAmount(totalAmount);
  if (!pkg) {
    safeError(`❌ [PAYANYWAY STOREFRONT] Не найден пакет для суммы ${totalAmount} руб.`);
    return new Response('FAIL', { status: 200 });
  }

  const transactionId = buildStorefrontTransactionId(payload, raw);
  safeLog(`💳 [PAYANYWAY STOREFRONT] Callback purchased: email=${payload.customerEmail}, amount=${totalAmount}, tx=${transactionId}`);

  await initDatabase();
  const result = await applyCompletedPayment({
    email: payload.customerEmail,
    amount: totalAmount,
    units: pkg.units,
    packageId: pkg.packageId,
    transactionId,
    operationLabel: 'Пополнение (PayAnyWay Storefront)',
    metadata: {
      productCode: payload.productCode || null,
      productPrice: payload.productPrice || null,
      productPriceWithDiscount: payload.productPriceWithDiscount || null,
      productQuantity: quantity,
      action: payload.action,
      source: 'payanyway_storefront',
    },
  });

  if (!result.success) {
    return new Response('FAIL', { status: 200 });
  }
  if (result.alreadyProcessed) {
    safeLog(`ℹ️ [PAYANYWAY STOREFRONT] Операция уже обработана: ${transactionId}`);
  } else {
    safeLog(`✅ [PAYANYWAY STOREFRONT] Зачислено: ${payload.customerEmail}, +${pkg.units} ед., paymentId=${result.paymentId}`);
  }

  return new Response('SUCCESS', { status: 200 });
}

/**
 * XML-ответ на Pay URL уведомление.
 * resultCode: 200 = успех, 500 = ошибка/отмена
 */
function buildPayUrlXml(txId: string, resultCode: string, context: ReceiptContext, pkg: Package | null): string {
  const signature = buildResponseSignature(resultCode, txId);
  const itemName = pkg
    ? pkg.name.replace(/[&"'<>#$\\\/]/g, ' ')
    : 'Пакет единиц Doctor Opus';
  const itemPrice = pkg ? pkg.priceRub.toFixed(2) : '0.00';
  const inventoryItem = buildInventoryItem(itemName, itemPrice);
  const inventoryJson = JSON.stringify([inventoryItem]);
  const attributesXml = buildMntAttributesXml(inventoryJson, context);

  return `<?xml version="1.0" encoding="UTF-8"?>
<MNT_RESPONSE>
  <MNT_ID>${MNT_ID}</MNT_ID>
  <MNT_TRANSACTION_ID>${escapeXml(txId)}</MNT_TRANSACTION_ID>
  <MNT_RESULT_CODE>${resultCode}</MNT_RESULT_CODE>
  <MNT_SIGNATURE>${signature}</MNT_SIGNATURE>
  <MNT_ATTRIBUTES>
${attributesXml}
  </MNT_ATTRIBUTES>
</MNT_RESPONSE>`;
}

/**
 * XML-ответ на Check URL (проверочный запрос до оплаты).
 * resultCode 402 = заказ готов к оплате.
 */
function buildCheckUrlXml(txId: string, amount: number, context: ReceiptContext, pkg: Package | null): string {
  const resultCode = '402';
  const signature = buildResponseSignature(resultCode, txId);
  const itemPrice = pkg ? pkg.priceRub : amount;
  const inventoryItem = buildInventoryItem(
    (pkg?.name || 'Пакет единиц Doctor Opus').replace(/[&"'<>#$\\\/]/g, ' '),
    itemPrice.toFixed(2)
  );
  const inventoryJson = JSON.stringify([inventoryItem]);
  const attributesXml = buildMntAttributesXml(inventoryJson, context);

  return `<?xml version="1.0" encoding="UTF-8"?>
<MNT_RESPONSE>
  <MNT_ID>${MNT_ID}</MNT_ID>
  <MNT_TRANSACTION_ID>${escapeXml(txId)}</MNT_TRANSACTION_ID>
  <MNT_RESULT_CODE>${resultCode}</MNT_RESULT_CODE>
  <MNT_DESCRIPTION>Order created, but not paid</MNT_DESCRIPTION>
  <MNT_AMOUNT>${itemPrice.toFixed(2)}</MNT_AMOUNT>
  <MNT_SIGNATURE>${signature}</MNT_SIGNATURE>
  <MNT_ATTRIBUTES>
${attributesXml}
  </MNT_ATTRIBUTES>
</MNT_RESPONSE>`;
}

async function handlePayanyway(raw: Record<string, string>, decoded: Record<string, string>, contentType: string) {
  try {
    safeLog(`💳 [PAYANYWAY] Content-Type: ${contentType}`);
    safeLog(`💳 [PAYANYWAY] Raw данные: ${JSON.stringify(raw)}`);
    safeLog(`💳 [PAYANYWAY] Decoded данные: ${JSON.stringify(decoded)}`);

    const data = decoded;
    const storefrontPayload = PAYANYWAY_STOREFRONT_ENABLED
      ? extractStorefrontPayload(data)
      : null;
    if (storefrontPayload) {
      return handleStorefrontCallback(storefrontPayload, raw);
    }

    const txId = data.MNT_TRANSACTION_ID || '';
    const amount = parseFloat(data.MNT_AMOUNT || '0');
    const email = (data.MNT_SUBSCRIBER_ID || '').toLowerCase().trim();
    const receiptContext = extractReceiptContext(data, email);
    const pkg = findPackageByAmount(amount);

    // Базовая защита: проверяем MNT_ID (отвечаем XML, чтобы не ломать протокол callback)
    if (data.MNT_ID !== MNT_ID) {
      safeWarn(`⚠️ [PAYANYWAY] Неверный MNT_ID: ${data.MNT_ID}`);
      const xml = buildPayUrlXml(txId, '500', receiptContext, pkg);
      return new Response(xml, {
        status: 200,
        headers: { 'Content-Type': 'application/xml; charset=UTF-8' },
      });
    }

    // Check URL: по спецификации определяется MNT_COMMAND=CHECK
    // (добавлен fallback по отсутствию MNT_OPERATION_ID для совместимости)
    const isCheck = (data.MNT_COMMAND || '').toUpperCase() === 'CHECK' || !data.MNT_OPERATION_ID;

    // Проверяем подпись с учетом типа запроса (Check/Pay)
    if (!validateSignature(raw, data, isCheck)) {
      safeError('❌ [PAYANYWAY] Неверная подпись!');
      const xml = isCheck
        ? buildCheckUrlXml(txId, amount || 0, receiptContext, pkg)
        : buildPayUrlXml(txId, '500', receiptContext, pkg);
      return new Response(xml, {
        status: 200,
        headers: { 'Content-Type': 'application/xml; charset=UTF-8' },
      });
    }

    if (isCheck) {
      safeLog(`🔍 [PAYANYWAY] Check URL: txId=${txId}, amount=${amount}, email=${email}`);
      const xml = buildCheckUrlXml(txId, amount, receiptContext, pkg);
      return new Response(xml, {
        status: 200,
        headers: { 'Content-Type': 'application/xml; charset=UTF-8' },
      });
    }

    // Pay URL: уведомление об успешной оплате
    const operationId = data.MNT_OPERATION_ID;
    safeLog(`💳 [PAYANYWAY] Pay URL: txId=${txId}, operationId=${operationId}, email=${email}`);

    if (!operationId) {
      safeError('❌ [PAYANYWAY] Отсутствует MNT_OPERATION_ID');
      const xml = buildPayUrlXml(txId, '500', receiptContext, pkg);
      return new Response(xml, {
        status: 200,
        headers: { 'Content-Type': 'application/xml; charset=UTF-8' },
      });
    }

    if (!email) {
      safeWarn(`⚠️ [PAYANYWAY] MNT_SUBSCRIBER_ID пуст`);
      const xml = buildPayUrlXml(txId, '500', receiptContext, null);
      return new Response(xml, {
        status: 200,
        headers: { 'Content-Type': 'application/xml; charset=UTF-8' },
      });
    }

    if (!pkg) {
      safeError(`❌ [PAYANYWAY] Не найден пакет для суммы ${amount} руб.`);
      const xml = buildPayUrlXml(txId, '500', receiptContext, null);
      return new Response(xml, {
        status: 200,
        headers: { 'Content-Type': 'application/xml; charset=UTF-8' },
      });
    }

    safeLog(`✅ [PAYANYWAY] Платёж подтверждён: ${email}, ${pkg.units} ед., операция ${operationId}`);

    await initDatabase();

    // Определяем flow:
    // - Invoice API flow: txId — числовой ID из нашей БД (создан через /api/payment/create)
    //   → обновляем существующую pending-запись через confirmPayment
    // - Прочие случаи (прямая ссылка, ручная отправка)
    //   → вставляем новую запись через applyCompletedPayment
    const dbPaymentId = /^\d+$/.test(txId) ? parseInt(txId, 10) : null;

    let credited = false;
    let alreadyDone = false;

    if (dbPaymentId) {
      // Invoice API: обновляем запись payments(id=dbPaymentId) до completed
      const confirmResult = await confirmPayment(dbPaymentId, operationId);
      if (!confirmResult.success) {
        // Для invoice-flow безуспешное подтверждение не должно приводить к "новому" автозачислению.
        // Это защищает от расхождений "зачислено в Opus, но нет валидной связки с исходным инвойсом".
        safeError(`❌ [PAYANYWAY] confirmPayment(${dbPaymentId}) не удался; автозачисление запрещено`);
        const xml = buildPayUrlXml(txId, '500', receiptContext, pkg);
        return new Response(xml, { status: 200, headers: { 'Content-Type': 'application/xml; charset=UTF-8' } });
      } else {
        alreadyDone = confirmResult.alreadyProcessed ?? false;
        credited = !alreadyDone;
      }
    } else {
      // Прямая/ручная оплата без Invoice API
      const result = await applyCompletedPayment({
        email,
        amount,
        units: pkg.units,
        packageId: pkg.packageId,
        transactionId: operationId,
        operationLabel: 'Пополнение (PayAnyWay)',
        metadata: { operationId, source: 'payanyway_assistant' },
      });
      if (!result.success) {
        const xml = buildPayUrlXml(txId, '500', receiptContext, pkg);
        return new Response(xml, { status: 200, headers: { 'Content-Type': 'application/xml; charset=UTF-8' } });
      }
      alreadyDone = result.alreadyProcessed ?? false;
      credited = !alreadyDone;
    }

    if (alreadyDone) {
      safeLog(`ℹ️ [PAYANYWAY] Операция ${operationId} уже обработана`);
    } else if (credited) {
      safeLog(`💰 [PAYANYWAY] Баланс ${email} пополнен на ${pkg.units} ед.`);
    }

    const xml = buildPayUrlXml(txId, '200', receiptContext, pkg);
    return new Response(xml, {
      status: 200,
      headers: { 'Content-Type': 'application/xml; charset=UTF-8' },
    });
  } catch (error: any) {
    safeError('❌ [PAYANYWAY] Ошибка обработки webhook:', error?.message);
    return new Response('FAIL', { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { raw, decoded } = await parseBody(request);
    const contentType = request.headers.get('content-type') || 'application/x-www-form-urlencoded';
    return handlePayanyway(raw, decoded, contentType);
  } catch (error: any) {
    safeError('❌ [PAYANYWAY] Ошибка parse POST:', error?.message);
    return new Response('FAIL', { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const raw: Record<string, string> = {};
    const decoded: Record<string, string> = {};
    const query = request.nextUrl.search.startsWith('?')
      ? request.nextUrl.search.slice(1)
      : request.nextUrl.search;
    parseEncodedPairs(query, raw, decoded);
    return handlePayanyway(raw, decoded, 'application/x-www-form-urlencoded (query)');
  } catch (error: any) {
    safeError('❌ [PAYANYWAY] Ошибка parse GET:', error?.message);
    return new Response('FAIL', { status: 500 });
  }
}
