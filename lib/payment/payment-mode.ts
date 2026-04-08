import type { PaymentProviderType } from './types';

/** Режим PayAnyWay (например EN / legacy). Во всех остальных случаях — Yagoda. */
export function isPayanywayPaymentMode(): boolean {
  return (process.env.PAYMENT_PROVIDER || '').trim().toLowerCase() === 'payanyway';
}

export function getPublicPaymentProvider(): PaymentProviderType {
  return isPayanywayPaymentMode() ? 'payanyway' : 'yagoda';
}
