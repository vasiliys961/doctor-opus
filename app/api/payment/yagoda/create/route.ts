import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { initDatabase, createPayment } from '@/lib/database';
import { paymentService } from '@/lib/payment/payment-service';
import {
  creditsFromAmountRub,
  validateTopupAmountRub,
  YAGODA_TOPUP_PACKAGE_ID,
} from '@/lib/payment/credit-pricing';
import { isPayanywayPaymentMode } from '@/lib/payment/payment-mode';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (isPayanywayPaymentMode()) {
      return NextResponse.json(
        { success: false, error: 'На этом окружении используется PayAnyWay, не Yagoda' },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ success: false, error: 'Необходима авторизация' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const amountRub = Number(body?.amountRub);

    const validation = validateTopupAmountRub(amountRub);
    if (!validation.ok) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    const units = creditsFromAmountRub(amountRub);
    await initDatabase();

    const paymentResult = await createPayment({
      email,
      amount: Number(amountRub.toFixed(2)),
      units,
      package_id: YAGODA_TOPUP_PACKAGE_ID,
    });

    if (!paymentResult.success || !paymentResult.paymentId) {
      return NextResponse.json(
        { success: false, error: 'Не удалось создать платёж в базе' },
        { status: 500 }
      );
    }

    const provider = paymentService.getProvider();
    const paymentUrl = await provider.generatePaymentUrl({
      amount: Number(amountRub.toFixed(2)),
      orderId: paymentResult.paymentId,
      description: `Пополнение баланса Doctor Opus: ${units} ед.`,
      email,
    });

    return NextResponse.json({
      success: true,
      paymentUrl,
      paymentId: paymentResult.paymentId,
      units,
      amountRub: Number(amountRub.toFixed(2)),
      reused: Boolean((paymentResult as { reused?: boolean }).reused),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Ошибка создания платежа';
    console.error('❌ [YAGODA CREATE]', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
