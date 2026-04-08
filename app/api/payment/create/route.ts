import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { paymentService } from "@/lib/payment/payment-service";
import { SUBSCRIPTION_PACKAGES } from "@/lib/subscription-manager";
import { initDatabase, createPayment } from "@/lib/database";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Необходима авторизация' },
        { status: 401 }
      );
    }

    const { packageId } = await request.json();

    if (!packageId || !SUBSCRIPTION_PACKAGES[packageId as keyof typeof SUBSCRIPTION_PACKAGES]) {
      return NextResponse.json(
        { success: false, error: 'Неверный пакет услуг' },
        { status: 400 }
      );
    }

    const pkg = SUBSCRIPTION_PACKAGES[packageId as keyof typeof SUBSCRIPTION_PACKAGES];
    // Инициализация БД
    await initDatabase();

    // Создаем запись о платеже в БД
    const paymentResult = await createPayment({
      email: session.user.email || 'unknown',
      amount: pkg.priceRub,
      units: pkg.credits,
      package_id: packageId
    });

    if (!paymentResult.success) {
      throw new Error('Ошибка сохранения данных платежа в базе');
    }

    // Используем ID из базы как InvId для провайдера
    const invId = paymentResult.paymentId;

    const provider = paymentService.getProvider();
    const paymentUrl = await provider.generatePaymentUrl({
      amount: pkg.priceRub,
      orderId: invId,
      description: `Активация пакета ${pkg.name} для ${session.user.email}`,
      email: session.user.email || undefined,
    });

    return NextResponse.json({
      success: true,
      paymentUrl
    });

  } catch (error: any) {
    console.error('❌ [PAYMENT CREATE] Ошибка:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка создания платежа' },
      { status: 500 }
    );
  }
}

