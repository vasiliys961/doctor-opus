import { NextResponse } from 'next/server';
import { getCreditPricing } from '@/lib/payment/credit-pricing';
import { getPublicPaymentProvider } from '@/lib/payment/payment-mode';

export const dynamic = 'force-dynamic';

/**
 * Публичные настройки оплаты для UI (курс, минимум, активный провайдер).
 */
export async function GET() {
  const { creditPriceRub, minTopupRub } = getCreditPricing();
  return NextResponse.json({
    provider: getPublicPaymentProvider(),
    creditPriceRub,
    minTopupRub,
    currency: 'RUB',
  });
}
