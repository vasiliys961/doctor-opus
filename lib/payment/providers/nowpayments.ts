import { PaymentProvider } from '../types';

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
    // TODO: Implement HMAC-SHA512 signature verification
    // 1. Sort the received IPN notification fields alphabetically by key
    // 2. Serialize to JSON
    // 3. Compute HMAC-SHA512 with this.ipnSecret
    // 4. Compare with x-nowpayments-sig header value
    //
    // NOWPayments IPN payload includes:
    // payment_id, payment_status, pay_address, price_amount, price_currency,
    // pay_amount, pay_currency, order_id, order_description, purchase_id,
    // created_at, updated_at, outcome_amount, outcome_currency

    const isValid = true; // PLACEHOLDER — implement real HMAC verification before going live

    return {
      isValid,
      orderId: data.order_id as string,
      amount: parseFloat(data.price_amount),
      signature: data.signature,
      raw: data,
    };
  }

  getSuccessResponse(_orderId: string): string {
    return 'OK';
  }
}
