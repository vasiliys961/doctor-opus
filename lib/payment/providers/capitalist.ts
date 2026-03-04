import crypto from 'crypto';
import { PaymentProvider } from '../types';

type CapitalistFieldMap = Record<string, string>;

function createCapitalistSign(fields: CapitalistFieldMap, secret: string, separator = ':'): string {
  const payload = { ...fields };
  delete payload.sign;

  const sortedKeys = Object.keys(payload).sort((a, b) => a.localeCompare(b));
  const canonical = sortedKeys.map((k) => payload[k]).join(separator);
  return crypto.createHmac('md5', secret).update(canonical).digest('hex');
}

export class CapitalistProvider implements PaymentProvider {
  private merchantId: string;
  private secret: string;
  private createOrderUrl: string;

  constructor() {
    this.merchantId = process.env.CAPITALIST_MERCHANT_ID || '';
    this.secret = process.env.CAPITALIST_SECRET || '';
    this.createOrderUrl = 'https://capitalist.net/merchant/payGate/createorder';
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

    const amountStr = options.amount.toFixed(2);
    const orderId = String(options.orderId);

    const orderPayload: CapitalistFieldMap = {
      merchantid: this.merchantId,
      number: orderId,
      amount: amountStr,
      currency: 'USD',
      description: options.description,
    };

    if (options.email) {
      orderPayload.opt_email = options.email;
    }

    // Документация противоречива по разделителю (":" vs "."),
    // поэтому сначала пробуем ":", затем fallback на ".".
    const tryCreateOrder = async (separator: ':' | '.') => {
      const payload = {
        ...orderPayload,
        sign: createCapitalistSign(orderPayload, this.secret, separator),
      };
      const response = await fetch(this.createOrderUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => ({}));
      return { response, json };
    };

    let result = await tryCreateOrder(':');
    const signError = result?.json?.errors?.sign || result?.json?.data?.errors?.sign;
    if ((!result.response.ok || !result.json?.order?.paymentUrl) && signError) {
      result = await tryCreateOrder('.');
    }

    const paymentUrl = result?.json?.order?.paymentUrl;
    if (!paymentUrl) {
      throw new Error(`Capitalist createorder failed: ${JSON.stringify(result.json || {})}`);
    }
    return String(paymentUrl);
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

    // По документации callback-подпись проверяется на этих полях:
    // merchant_id, order_number, payment_amount, payment_currency, payment_state
    const signaturePayload: CapitalistFieldMap = {
      merchant_id: normalized.merchant_id || normalized.merchantid || '',
      order_number: normalized.order_number || normalized.number || normalized.order_id || '',
      payment_amount: normalized.payment_amount || normalized.amount || '',
      payment_currency: normalized.payment_currency || normalized.currency || '',
      payment_state: normalized.payment_state || normalized.status || '',
    };

    const expectedColon = createCapitalistSign(signaturePayload, this.secret, ':');
    const expectedDot = createCapitalistSign(signaturePayload, this.secret, '.');
    const isValid =
      !!sign &&
      (sign.toLowerCase() === expectedColon.toLowerCase() ||
        sign.toLowerCase() === expectedDot.toLowerCase());

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
