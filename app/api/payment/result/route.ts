import { NextRequest, NextResponse } from 'next/server';
import { paymentService } from "@/lib/payment/payment-service";
import { confirmPayment, initDatabase } from "@/lib/database";

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const params: Record<string, string> = {};
    data.forEach((value, key) => {
      params[key] = value.toString();
    });

    console.log(`💰 [PAYMENT RESULT] Получены данные от ${paymentService.getActiveProviderName()}:`, params);

    const provider = paymentService.getProvider();
    const { isValid, orderId, amount, signature } = await provider.validateNotification(params);

    if (!isValid) {
      console.error('❌ [PAYMENT RESULT] Неверная подпись!');
      return new Response('bad sign', { status: 200 });
    }

    // Инициализация БД
    await initDatabase();

    // Подтверждаем платеж и начисляем баланс в БД
    const confirmResult = await confirmPayment(parseInt(orderId), signature || '');

    if (!confirmResult.success) {
      console.error('❌ [PAYMENT RESULT] Ошибка подтверждения платежа в БД:', confirmResult.error);
      return new Response('error updating db', { status: 200 });
    }

    console.log(`✅ [PAYMENT RESULT] Платеж подтвержден, баланс пополнен для заказа #${orderId}.`);

    // Ответ для платежной системы об успешном получении уведомления
    const response = provider.getSuccessResponse(orderId);
    return typeof response === 'string' 
      ? new Response(response, { status: 200 })
      : NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ [PAYMENT RESULT] Ошибка обработки вебхука:', error);
    return new Response('error', { status: 500 });
  }
}

