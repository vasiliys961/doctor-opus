import crypto from 'crypto';
import { PaymentProvider } from '../types';

/**
 * Провайдер платежей Botoplat (botoplat.ru)
 * Комиссия 2.9%, автоматизация чеков и актов
 */
export class BotoplatProvider implements PaymentProvider {
  private merchantId: string;
  private secretKey: string;
  private baseUrl: string;

  constructor() {
    this.merchantId = process.env.BOTOPLAT_MERCHANT_ID || '';
    this.secretKey = process.env.BOTOPLAT_SECRET_KEY || '';
    this.baseUrl = 'https://api.botoplat.ru/v1/pay'; // Гипотетический URL API
  }

  async generatePaymentUrl(options: {
    amount: number;
    orderId: string | number;
    description: string;
    email?: string;
    isRecurring?: boolean;
    metadata?: Record<string, string>;
  }): Promise<string> {
    const { amount, orderId, description, email, metadata = {} } = options;

    // В реальности здесь будет формирование подписи и URL согласно документации Botoplat
    // Пока возвращаем заглушку с параметрами
    const params = new URLSearchParams({
      m: this.merchantId,
      oa: amount.toString(),
      o: orderId.toString(),
      d: description,
      s: this.generateSignature(amount, orderId),
    });

    if (email) params.append('em', email);
    
    // Добавляем метаданные
    Object.entries(metadata).forEach(([key, value]) => {
      params.append(`cf_${key}`, value);
    });

    // Возвращаем ссылку на оплату (шаблон)
    return `${this.baseUrl}?${params.toString()}`;
  }

  async validateNotification(data: any): Promise<{
    isValid: boolean;
    orderId: string;
    amount: number;
    signature?: string;
    raw?: any;
  }> {
    // Логика валидации вебхука от Botoplat
    const { order_id, amount, signature } = data;
    
    // Проверка подписи (примерная)
    const isValid = this.generateSignature(amount, order_id) === signature;

    return {
      isValid,
      orderId: order_id,
      amount: parseFloat(amount),
      signature,
      raw: data
    };
  }

  getSuccessResponse(orderId: string): string {
    // Ответ серверу Botoplat о том, что уведомление получено
    return 'OK';
  }

  private generateSignature(amount: number | string, orderId: number | string): string {
    if (!this.secretKey) return 'no-secret-key';
    const str = `${this.merchantId}:${amount}:${orderId}:${this.secretKey}`;
    return crypto.createHash('sha256').update(str).digest('hex');
  }
}
