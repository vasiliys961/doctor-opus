import { PaymentProvider } from '../types';
import { yagodaCreateOrder } from '../yagoda-api';

export class YagodaProvider implements PaymentProvider {
  async generatePaymentUrl(options: {
    amount: number;
    orderId: string | number;
    description: string;
    email?: string;
    isRecurring?: boolean;
    metadata?: Record<string, string>;
  }): Promise<string> {
    const email = (options.email || '').trim();
    if (!email) {
      throw new Error('Email обязателен для оплаты через Yagoda');
    }

    const result = await yagodaCreateOrder({
      orderId: String(options.orderId),
      email,
      amountRub: options.amount,
      itemName: options.description || 'Пополнение баланса Doctor Opus',
    });

    return result.payment_url;
  }

  async validateNotification(): Promise<{
    isValid: boolean;
    orderId: string;
    amount: number;
    signature?: string;
    raw?: any;
  }> {
    return { isValid: false, orderId: '', amount: 0 };
  }

  getSuccessResponse(): string {
    return JSON.stringify({ ok: true });
  }
}
