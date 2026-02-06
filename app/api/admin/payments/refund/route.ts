import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions, isAdminEmail } from "@/lib/auth";

/**
 * POST /api/admin/payments/refund — Подтверждение возврата средств
 * 
 * Универсальный механизм:
 * 1. Обновляет статус платежа в БД на 'refunded'
 * 2. Обнуляет баланс пользователя на сумму возврата
 * 3. Когда платежная система будет подключена, здесь же вызовется provider.refund()
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email || !isAdminEmail(session.user.email)) {
      return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 403 });
    }

    const body = await request.json();
    const { paymentId } = body;

    if (!paymentId) {
      return NextResponse.json({ success: false, error: 'Не указан ID платежа' }, { status: 400 });
    }

    const { sql, initDatabase } = await import('@/lib/database');
    await initDatabase();

    // 1. Получаем информацию о платеже
    const { rows: paymentRows } = await sql`
      SELECT id, email, amount, units, status, transaction_id 
      FROM payments 
      WHERE id = ${paymentId}
    `;

    if (paymentRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Платеж не найден' }, { status: 404 });
    }

    const payment = paymentRows[0];

    if (payment.status === 'refunded') {
      return NextResponse.json({ success: false, error: 'Платеж уже был возвращен' }, { status: 400 });
    }

    // 2. Обновляем статус платежа
    await sql`
      UPDATE payments 
      SET status = 'refunded', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ${paymentId}
    `;

    // 3. Списываем юниты с баланса пользователя (возврат = минус юниты)
    await sql`
      UPDATE user_balances 
      SET balance = GREATEST(0, balance - ${payment.units}), updated_at = CURRENT_TIMESTAMP
      WHERE email = ${payment.email}
    `;

    // 4. TODO: Когда будет подключена платежная система, вызвать API возврата:
    // const provider = getPaymentProvider(); // robokassa / prodamus / etc
    // if (provider.refund) {
    //   await provider.refund(payment.transaction_id, payment.amount);
    // }

    console.log(`💸 [ADMIN REFUND] Возврат одобрен админом ${session.user.email}:
      Платеж #${paymentId} | ${payment.email} | ${payment.amount} руб. | ${payment.units} ед.`);

    return NextResponse.json({ 
      success: true, 
      message: `Возврат оформлен: ${payment.amount} руб. для ${payment.email}`,
      refund: {
        paymentId: payment.id,
        email: payment.email,
        amount: payment.amount,
        units: payment.units,
        note: 'Статус платежа обновлен на "refunded". Перевод средств выполните вручную в кабинете платежной системы.'
      }
    });
  } catch (error: any) {
    console.error('❌ [ADMIN REFUND] Ошибка:', error);
    return NextResponse.json({ success: false, error: 'Ошибка обработки возврата' }, { status: 500 });
  }
}
