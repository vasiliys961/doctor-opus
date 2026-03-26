import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { createPaymentConfirmationRequest, initDatabase } from '@/lib/database';
import { sendPaymentConfirmationRequestedAlertEmail } from '@/lib/email-service';
import { SUBSCRIPTION_PACKAGES } from '@/lib/subscription-manager';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ success: false, error: 'Необходима авторизация' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const packageId = String(body?.packageId || '').trim() as keyof typeof SUBSCRIPTION_PACKAGES;
    const claimedAmount = Number(body?.claimedAmount || 0);
    const paidAt = body?.paidAt ? String(body.paidAt) : null;
    const payerName = body?.payerName ? String(body.payerName) : null;
    const cardLast4 = body?.cardLast4 ? String(body.cardLast4) : null;
    const bankOperationId = body?.bankOperationId ? String(body.bankOperationId) : null;
    const payerMessage = body?.payerMessage ? String(body.payerMessage) : null;
    const comment = body?.comment ? String(body.comment) : null;

    const pkg = SUBSCRIPTION_PACKAGES[packageId];
    if (!pkg) {
      return NextResponse.json({ success: false, error: 'Неверный пакет' }, { status: 400 });
    }
    if (pkg.category === 'team') {
      return NextResponse.json(
        { success: false, error: 'Для медцентров используйте оплату/счет через PayAnyWay' },
        { status: 400 }
      );
    }
    if (!Number.isFinite(claimedAmount) || claimedAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Укажите сумму оплаты' }, { status: 400 });
    }
    if (cardLast4 && !/^\d{4}$/.test(cardLast4.trim())) {
      return NextResponse.json({ success: false, error: 'Последние 4 цифры карты должны содержать ровно 4 цифры' }, { status: 400 });
    }

    await initDatabase();
    const createResult = await createPaymentConfirmationRequest({
      email,
      provider: 'vtb',
      packageId,
      expectedAmount: pkg.priceRub,
      expectedUnits: pkg.credits,
      claimedAmount,
      paidAt,
      payerName,
      cardLast4,
      bankOperationId,
      payerMessage,
      userComment: comment,
    });

    if (!createResult.success || !createResult.requestId) {
      return NextResponse.json(
        { success: false, error: 'Не удалось создать заявку на подтверждение оплаты' },
        { status: 500 }
      );
    }

    const alertEmail = process.env.PAYMENT_ALERT_EMAIL || 'vasiliys@mail.ru';
    void sendPaymentConfirmationRequestedAlertEmail({
      to: alertEmail,
      userEmail: email,
      requestId: Number(createResult.requestId),
      packageName: pkg.name,
      expectedAmount: pkg.priceRub,
      claimedAmount,
      paidAt,
      payerName,
      cardLast4,
      bankOperationId,
      payerMessage,
      comment,
    });

    return NextResponse.json({
      success: true,
      requestId: Number(createResult.requestId),
      reused: Boolean((createResult as any).reused),
      packageId,
      packageName: pkg.name,
      expectedAmount: pkg.priceRub,
    });
  } catch (error) {
    console.error('❌ [VTB REQUEST] Ошибка создания заявки:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка создания заявки подтверждения оплаты' },
      { status: 500 }
    );
  }
}
