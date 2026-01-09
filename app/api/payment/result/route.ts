import { NextRequest, NextResponse } from 'next/server';
import { robokassa } from "@/lib/robokassa";

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const params: Record<string, string> = {};
    data.forEach((value, key) => {
      params[key] = value.toString();
    });

    console.log('💰 [PAYMENT RESULT] Получены данные от Robokassa:', params);

    const { OutSum, InvId, SignatureValue, Email } = params;

    // Извлекаем кастомные параметры (shp_*)
    const shpParams: Record<string, string> = {};
    data.forEach((value, key) => {
      if (key.startsWith('shp_')) {
        shpParams[key] = value.toString();
      }
    });

    // Валидация подписи
    const isValid = robokassa.validateSignature(OutSum, InvId, SignatureValue, shpParams);

    if (!isValid) {
      console.error('❌ [PAYMENT RESULT] Неверная подпись!');
      return new Response('bad sign', { status: 200 }); // Робокасса ожидает текстовый ответ
    }

    // ВАЖНО: Здесь должна быть логика начисления баланса в вашей БД
    // Так как сейчас баланс хранится в localStorage (на клиенте), 
    // серверный вебхук не может напрямую обновить его.
    
    // ПЛАН: В будущем здесь будет обновление БД. 
    // Пока что мы вернем 'OK', а клиент будет проверять статус платежа самостоятельно или через SuccessURL.
    
    console.log(`✅ [PAYMENT RESULT] Платеж на сумму ${OutSum} для ${Email} подтвержден.`);

    // Ответ для Робокассы об успешном получении уведомления
    return new Response(`OK${InvId}`, { status: 200 });

  } catch (error: any) {
    console.error('❌ [PAYMENT RESULT] Ошибка обработки вебхука:', error);
    return new Response('error', { status: 500 });
  }
}

