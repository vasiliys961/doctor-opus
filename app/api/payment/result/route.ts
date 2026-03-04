import { NextRequest, NextResponse } from 'next/server';
import { paymentService } from "@/lib/payment/payment-service";
import { confirmPayment, initDatabase, sql } from "@/lib/database";
import { safeLog, safeError, safeWarn } from '@/lib/logger';

// IP-адреса платежных систем (из env, через запятую)
const PAYMENT_IP_WHITELIST = (process.env.PAYMENT_IP_WHITELIST || '')
  .split(',')
  .map(ip => ip.trim())
  .filter(Boolean);

function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    // IP-фильтрация (если whitelist настроен)
    if (PAYMENT_IP_WHITELIST.length > 0) {
      const clientIP = getClientIP(request);
      if (!PAYMENT_IP_WHITELIST.includes(clientIP)) {
        safeWarn(`⚠️ [PAYMENT RESULT] Запрос с неразрешённого IP: ${clientIP}`);
        return new Response('forbidden', { status: 403 });
      }
    }

    const data = await request.formData();
    const params: Record<string, string> = {};
    data.forEach((value, key) => {
      params[key] = value.toString();
    });

    safeLog(`💰 [PAYMENT RESULT] Получены данные от ${paymentService.getActiveProviderName()}`);

    const providerName = paymentService.getActiveProviderName();
    const provider = paymentService.getProvider();
    const { isValid, orderId, amount, signature } = await provider.validateNotification(params);

    if (!isValid) {
      safeError('❌ [PAYMENT RESULT] Неверная подпись!');
      return new Response('bad sign', { status: 200 });
    }

    // Для Capitalist подтверждаем баланс только при успешном состоянии платежа.
    if (providerName === 'capitalist') {
      const expectedMerchantId = process.env.CAPITALIST_MERCHANT_ID || '';
      const incomingMerchantId = String(params.merchant_id || params.merchantid || '');
      if (expectedMerchantId && incomingMerchantId && incomingMerchantId !== expectedMerchantId) {
        return new Response('bad merchant', { status: 200 });
      }

      const paymentState = (params.payment_state || params.status || '').toLowerCase();
      const isSuccess = ['success', 'paid', 'completed', 'finished'].includes(paymentState);
      const isFailure = ['fail', 'failed', 'cancelled', 'canceled', 'expired'].includes(paymentState);

      if (isFailure) {
        const paymentId = Number.parseInt(String(orderId), 10);
        if (Number.isFinite(paymentId) && paymentId > 0) {
          await initDatabase();
          await sql`UPDATE payments SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ${paymentId} AND status = 'pending'`;
        }
        const response = provider.getSuccessResponse(orderId);
        return typeof response === 'string'
          ? new Response(response, { status: 200 })
          : NextResponse.json(response);
      }

      if (!isSuccess) {
        // Игнорируем промежуточные статусы, но подтверждаем webhook 200.
        const response = provider.getSuccessResponse(orderId);
        return typeof response === 'string'
          ? new Response(response, { status: 200 })
          : NextResponse.json(response);
      }
    }

    // Инициализация БД
    await initDatabase();

    // Подтверждаем платеж и начисляем баланс в БД (транзакционно)
    const confirmResult = await confirmPayment(parseInt(orderId), signature || '');

    if (!confirmResult.success) {
      safeError('❌ [PAYMENT RESULT] Ошибка подтверждения платежа в БД');
      return new Response('error updating db', { status: 200 });
    }

    safeLog(`✅ [PAYMENT RESULT] Платеж подтвержден для заказа #${orderId}`);

    // Ответ для платежной системы об успешном получении уведомления
    const response = provider.getSuccessResponse(orderId);
    return typeof response === 'string' 
      ? new Response(response, { status: 200 })
      : NextResponse.json(response);

  } catch (error: any) {
    safeError('❌ [PAYMENT RESULT] Ошибка обработки вебхука:', error.message);
    return new Response('error', { status: 500 });
  }
}
