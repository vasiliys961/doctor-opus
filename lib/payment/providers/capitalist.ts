import crypto from 'crypto';
import { PaymentProvider } from '../types';

type CapitalistFieldMap = Record<string, string>;

function createCapitalistSign(fields: CapitalistFieldMap, secret: string): string {
  const payload = { ...fields };
  delete payload.sign;

  const sortedKeys = Object.keys(payload).sort((a, b) => a.localeCompare(b));
  const canonical = sortedKeys.map((k) => payload[k]).join(':');
  return crypto.createHmac('md5', secret).update(canonical).digest('hex');
}

export class CapitalistProvider implements PaymentProvider {
  private merchantId: string;
  private secret: string;
  private baseUrl: string;

  constructor() {
    this.merchantId = process.env.CAPITALIST_MERCHANT_ID || '';
    this.secret = process.env.CAPITALIST_SECRET || '';
    this.baseUrl = 'https://capitalist.net/merchant/pay';
  }

  async generatePaymentUrl(options: {
    amount: number;
    orderId: string | number;
    description: string;
    email?: string;
    isRecurring?: boolean;
    metadata?: Record<string, string>;
  }): Promise<string> {
    if (!this.merchantId || !this.secret) {
      throw new Error('Capitalist credentials not configured. Set CAPITALIST_MERCHANT_ID and CAPITALIST_SECRET.');
    }

    const appUrl = process.env.NEXTAUTH_URL || 'https://doctor-opus.online';
    const amountStr = options.amount.toFixed(2);
    const orderId = String(options.orderId);

    const params: CapitalistFieldMap = {
      merchantid: this.merchantId,
      number: orderId,
      amount: amountStr,
      currency: 'USD',
      description: options.description,
      success_url: `${appUrl}/subscription?status=success`,
      fail_url: `${appUrl}/subscription?status=fail`,
    };

    if (options.email) {
      params.opt_email = options.email;
    }

    params.sign = createCapitalistSign(params, this.secret);

    const qs = new URLSearchParams(params);
    return `${this.baseUrl}?${qs.toString()}`;
  }

  async validateNotification(data: any): Promise<{
    isValid: boolean;
    orderId: string;
    amount: number;
    signature?: string;
    raw?: any;
  }> {
    const normalized: CapitalistFieldMap = {};
    for (const [key, value] of Object.entries(data || {})) {
      normalized[key] = String(value ?? '');
    }

    const sign = normalized.sign || '';
    const expected = createCapitalistSign(normalized, this.secret);
    const isValid = !!sign && sign.toLowerCase() === expected.toLowerCase();

    const orderId =
      normalized.order_number ||
      normalized.number ||
      normalized.order_id ||
      normalized.invoice_id ||
      '';

    const amountRaw = normalized.payment_amount || normalized.amount || '0';
    const amount = Number.parseFloat(amountRaw) || 0;

    return {
      isValid,
      orderId,
      amount,
      signature: sign,
      raw: data,
    };
  }

  getSuccessResponse(_orderId: string): string {
    // Capitalist expects a simple 200 ACK from webhook endpoint.
    return 'OK';
  }
}
