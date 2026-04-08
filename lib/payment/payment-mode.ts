import type { PaymentProviderType } from './types';

/**
 * Проект переключен на Yagoda.
 * Сохраняем функцию для совместимости, но всегда возвращаем false.
 */
export function isPayanywayPaymentMode(): boolean {
  return false;
}

export function getPublicPaymentProvider(): PaymentProviderType {
  return 'yagoda';
}
