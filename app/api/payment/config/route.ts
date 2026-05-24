import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getCreditPricing } from '@/lib/payment/credit-pricing';
import { getPublicPaymentProvider } from '@/lib/payment/payment-mode';
import { initDatabase } from '@/lib/database';
import { getSubscriptionAccessForEmail } from '@/lib/payment/subscription-access';

export const dynamic = 'force-dynamic';

/**
 * Публичные настройки оплаты для UI (курс, минимум, активный провайдер).
 */
export async function GET() {
  const { creditPriceRub, minTopupRub } = getCreditPricing();
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase() || '';
  let paymentAllowed = Boolean(email);
  let blockReason: string | null = email ? null : 'Необходима авторизация.';
  let blockCode: string | null = email ? null : 'unauthorized';
  let newUsersClosed = false;
  let newUsersCutoffIso: string | null = null;

  if (email) {
    try {
      await initDatabase();
      const access = await getSubscriptionAccessForEmail(email);
      paymentAllowed = access.allowed;
      blockReason = access.allowed ? null : access.reason || 'Подписка для новых аккаунтов временно закрыта.';
      blockCode = access.allowed ? null : access.code || 'subscription_access_denied';
      newUsersClosed = access.gateEnabled;
      newUsersCutoffIso = access.cutoffIso;
    } catch {
      paymentAllowed = false;
      blockReason = 'Не удалось проверить доступ к подписке. Попробуйте позже.';
      blockCode = 'access_check_failed';
    }
  }

  return NextResponse.json({
    provider: getPublicPaymentProvider(),
    creditPriceRub,
    minTopupRub,
    currency: 'RUB',
    paymentAllowed,
    blockReason,
    blockCode,
    newUsersClosed,
    newUsersCutoffIso,
  });
}
