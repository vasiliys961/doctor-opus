import crypto from 'crypto';
import { PaymentProvider } from '../types';

/**
 * Провайдер платежей PayAnyWay (НКО «Монета.ру»)
 * Документация: https://moneta.ru/merchant/docs
 *
 * Формат проверки подписи входящего уведомления:
 * MD5(MNT_ID + MNT_TRANSACTION_ID + MNT_OPERATION_ID + MNT_AMOUNT + MNT_CURRENCY_CODE + MNT_TEST_MODE + MNT_SECRET_KEY)
 *
 * Формат подписи исходящей формы:
 * MD5(MNT_ID + MNT_TRANSACTION_ID + MNT_AMOUNT + MNT_CURRENCY_CODE + MNT_TEST_MODE + MNT_SECRET_KEY)
 */
export class PayanywayProvider implements PaymentProvider {
  private mntId: string;
  private secret: string;
  private testMode: string;
  private baseUrl: string;

  constructor() {
    this.mntId = process.env.PAYANYWAY_MNT_ID || '';
    this.secret = process.env.PAYANYWAY_SECRET || '';
    this.testMode = process.env.PAYANYWAY_TEST_MODE || '0';
    this.baseUrl = 'https://www.payanyway.ru/assistant.htm';
  }

  async generatePaymentUrl(options: {
    amount: number;
    orderId: string | number;
    description: string;
    email?: string;
    isRecurring?: boolean;
    metadata?: Record<string, string>;
  }): Promise<string> {
    const { amount, orderId, description, email } = options;
    const amountStr = amount.toFixed(2);

    const signature = crypto
      .createHash('md5')
      .update(`${this.mntId}${orderId}${amountStr}RUB${this.testMode}${this.secret}`)
      .digest('hex');

    const params = new URLSearchParams({
      MNT_ID: this.mntId,
      MNT_TRANSACTION_ID: orderId.toString(),
      MNT_AMOUNT: amountStr,
      MNT_CURRENCY_CODE: 'RUB',
      MNT_DESCRIPTION: description,
      MNT_TEST_MODE: this.testMode,
      MNT_SIGNATURE: signature,
      MNT_SUCCESS_URL: `${process.env.NEXTAUTH_URL || 'https://doctor-opus.ru'}/subscription?status=success`,
      MNT_FAIL_URL: `${process.env.NEXTAUTH_URL || 'https://doctor-opus.ru'}/subscription?status=fail`,
    });

    if (email) params.append('MNT_SUBSCRIBER_ID', email);

    return `${this.baseUrl}?${params.toString()}`;
  }

  async validateNotification(data: any): Promise<{
    isValid: boolean;
    orderId: string;
    amount: number;
    signature?: string;
    raw?: any;
  }> {
    const {
      MNT_ID,
      MNT_TRANSACTION_ID,
      MNT_OPERATION_ID,
      MNT_AMOUNT,
      MNT_CURRENCY_CODE,
      MNT_TEST_MODE,
      MNT_SIGNATURE,
    } = data;

    const MNT_SUBSCRIBER_ID = data.MNT_SUBSCRIBER_ID || '';
    const str = `${MNT_ID}${MNT_TRANSACTION_ID}${MNT_OPERATION_ID}${MNT_AMOUNT}${MNT_CURRENCY_CODE}${MNT_SUBSCRIBER_ID}${MNT_TEST_MODE}${this.secret}`;
    const mySignature = crypto.createHash('md5').update(str).digest('hex');
    const isValid = mySignature.toLowerCase() === (MNT_SIGNATURE as string || '').toLowerCase();

    return {
      isValid,
      orderId: MNT_TRANSACTION_ID as string,
      amount: parseFloat(MNT_AMOUNT as string),
      signature: MNT_SIGNATURE as string,
      raw: data,
    };
  }

  getSuccessResponse(_orderId: string): string {
    return 'SUCCESS';
  }
}
