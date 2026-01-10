import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { robokassa } from "@/lib/robokassa";
import { SUBSCRIPTION_PACKAGES } from "@/lib/subscription-manager";
import { savePaymentConsent } from "@/lib/database";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Необходима авторизация' },
        { status: 401 }
      );
    }

    const { packageId, isRecurring } = await request.json();

    if (!packageId || !SUBSCRIPTION_PACKAGES[packageId as keyof typeof SUBSCRIPTION_PACKAGES]) {
      return NextResponse.json(
        { success: false, error: 'Неверный пакет услуг' },
        { status: 400 }
      );
    }

    const pkg = SUBSCRIPTION_PACKAGES[packageId as keyof typeof SUBSCRIPTION_PACKAGES];
    
    // Логируем согласие пользователя (требование эквайринга)
    if (isRecurring) {
      await savePaymentConsent({
        email: session.user.email || 'unknown',
        package_id: packageId,
        consent_type: 'recurring_agreement',
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      });
    }

    // Генерируем уникальный ID инвойса (можно сохранять в БД, если она есть)
    // В данном случае используем timestamp для уникальности
    const invId = Math.floor(Date.now() / 1000);

    const paymentUrl = robokassa.generatePaymentUrl(
      pkg.priceRub,
      invId,
      `Активация пакета ${pkg.name} для ${session.user.email}`,
      session.user.email || undefined,
      isRecurring
    );

    return NextResponse.json({
      success: true,
      paymentUrl
    });

  } catch (error: any) {
    console.error('❌ [PAYMENT CREATE] Ошибка:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Ошибка сервера' },
      { status: 500 }
    );
  }
}

