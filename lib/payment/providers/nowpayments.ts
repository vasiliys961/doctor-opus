import { PaymentProvider } from '../types';
import crypto from 'crypto';

/**
 * NOWPayments crypto/fiat payment gateway provider
 * Documentation: https://nowpayments.io/docs
 *
 * Webhook HMAC signature verification:
 * HMAC-SHA512(sorted_request_body_json, NOWPAYMENTS_IPN_SECRET_KEY)
 *
 * TODO: Complete integration after NOWPayments account setup:
 * 1. Set NOWPAYMENTS_API_KEY in environment variables
 * 2. Set NOWPAYMENTS_IPN_SECRET_KEY for webhook verification
 * 3. Replace placeholder URLs with real NOWPayments API endpoints
 */
export class NowPaymentsProvider implements PaymentProvider {
  private apiKey: string;
  private ipnSecret: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.NOWPAYMENTS_API_KEY || '';
    this.ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET_KEY || '';
    this.baseUrl = 'https://api.nowpayments.io/v1';
  }

  async generatePaymentUrl(options: {
    amount: number;
    orderId: string | number;
    description: string;
    email?: string;
    isRecurring?: boolean;
    metadata?: Record<string, string>;
  }): Promise<string> {
    const { amount, orderId, description } = options;
    const appUrl = process.env.NEXTAUTH_URL || 'https://doctor-opus.online';

    // TODO: Replace with real NOWPayments Invoice API call
    // POST https://api.nowpayments.io/v1/invoice
    // Headers: x-api-key: this.apiKey
    // Body: { price_amount, price_currency: 'usd', order_id, order_description, success_url, cancel_url, ipn_callback_url }

    if (!this.apiKey) {
      throw new Error('NOWPayments API key not configured. Set NOWPAYMENTS_API_KEY in environment variables.');
    }

    const response = await fetch(`${this.baseUrl}/invoice`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        price_amount: amount,
        price_currency: 'usd',
        order_id: orderId.toString(),
        order_description: description,
        success_url: `${appUrl}/balance?status=success`,
        cancel_url: `${appUrl}/balance?status=cancelled`,
        ipn_callback_url: `${appUrl}/api/payment/webhook`,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`NOWPayments invoice creation failed: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.invoice_url as string;
  }

  async validateNotification(data: any): Promise<{
    isValid: boolean;
    orderId: string;
    amount: number;
    signature?: string;
    raw?: any;
  }> {
    // HMAC-SHA512(sorted_json_body, NOWPAYMENTS_IPN_SECRET_KEY)
    // Подпись передаём через служебное поле _signature из route handler.
    const signature = String(data?._signature || '').trim();
    if (!signature || !this.ipnSecret) {
      return {
        isValid: false,
        orderId: String(data?.order_id || ''),
        amount: Number.parseFloat(String(data?.price_amount || '0')) || 0,
        signature,
        raw: data,
      };
    }

    // Исключаем служебные поля из проверки.
    const payload = Object.fromEntries(
      Object.entries(data || {}).filter(([k]) => !k.startsWith('_'))
    );
    const sortedPayload = Object.fromEntries(
      Object.entries(payload).sort(([a], [b]) => a.localeCompare(b))
    );
    const serialized = JSON.stringify(sortedPayload);
    const expectedSig = crypto
      .createHmac('sha512', this.ipnSecret)
      .update(serialized)
      .digest('hex');

    const sigBuf = Buffer.from(signature.toLowerCase(), 'utf8');
    const expBuf = Buffer.from(expectedSig.toLowerCase(), 'utf8');
    const isValid =
      sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);

    return {
      isValid,
      orderId: data.order_id as string,
      amount: parseFloat(data.price_amount),
      signature,
      raw: data,
    };
  }

  getSuccessResponse(_orderId: string): string {
    return 'OK';
  }
}
