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

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
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

    const provider = paymentService.getProvider();
    const normalizedAmount = Number(amountRub.toFixed(2));

    const createAndGenerate = async (reusePendingWindowMinutes: number) => {
      const paymentResult = await createPayment(
        {
          email,
          amount: normalizedAmount,
          units,
          package_id: YAGODA_TOPUP_PACKAGE_ID,
        },
        { reusePendingWindowMinutes }
      );
      if (!paymentResult.success || !paymentResult.paymentId) {
        throw new Error('Не удалось создать платёж в базе');
      }

      const paymentUrl = await provider.generatePaymentUrl({
        amount: normalizedAmount,
        orderId: paymentResult.paymentId,
        description: `Пополнение баланса Doctor Opus: ${units} ед.`,
        email,
      });

      return { paymentResult, paymentUrl };
    };

    let generated: { paymentResult: { paymentId: number; reused?: boolean }; paymentUrl: string };
    try {
      generated = await createAndGenerate(30);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      const isDuplicateOrder = msg.includes('уже существует') || msg.includes('already exists');
      if (!isDuplicateOrder) throw err;
      // Страховка от конфликта order_id в Yagoda: создаем новый payment.id без reuse.
      generated = await createAndGenerate(0);
    }

    return NextResponse.json({
      success: true,
      paymentUrl: generated.paymentUrl,
      paymentId: generated.paymentResult.paymentId,
      units,
      amountRub: normalizedAmount,
      reused: Boolean(generated.paymentResult.reused),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Ошибка создания платежа';
    console.error('❌ [YAGODA CREATE]', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
