import crypto from 'crypto';
import { PaymentProvider } from '../types';

type ArsenalFieldMap = Record<string, string>;

function md5(input: string): string {
  return crypto.createHash('md5').update(input).digest('hex');
}

function hmacMd5(input: string, secret: string): string {
  return crypto.createHmac('md5', secret).update(input).digest('hex');
}

function normalizeMap(data: any): ArsenalFieldMap {
  const out: ArsenalFieldMap = {};
  for (const [key, value] of Object.entries(data || {})) {
    out[String(key)] = String(value ?? '');
  }
  return out;
}

function canonicalFromPayload(payload: ArsenalFieldMap, separator: string): string {
  const filtered = Object.fromEntries(
    Object.entries(payload).filter(([k]) => !['sign', 'signature', 'hash'].includes(k.toLowerCase()))
  );
  const sortedKeys = Object.keys(filtered).sort((a, b) => a.localeCompare(b));
  return sortedKeys.map((k) => filtered[k]).join(separator);
}

export class ArsenalPayProvider implements PaymentProvider {
  private widgetId: string;
  private widgetKey: string;
  private callbackKey: string;
  private widgetPageUrl: string;

  constructor() {
    this.widgetId = process.env.ARSENALPAY_WIDGET_ID || '';
    this.widgetKey = process.env.ARSENALPAY_WIDGET_KEY || '';
    this.callbackKey = process.env.ARSENALPAY_CALLBACK_KEY || '';
    this.widgetPageUrl = process.env.ARSENALPAY_WIDGET_URL || 'https://arsenalpay.ru/widget.html';
  }

  async generatePaymentUrl(options: {
    amount: number;
    orderId: string | number;
    description: string;
    email?: string;
    isRecurring?: boolean;
    metadata?: Record<string, string>;
  }): Promise<string> {
    if (!this.widgetId) {
      throw new Error('ArsenalPay is not configured. Set ARSENALPAY_WIDGET_ID in environment variables.');
    }

    const params = new URLSearchParams({
      widget: this.widgetId,
      destination: String(options.orderId),
      amount: options.amount.toFixed(2),
    });

    // Optional data accepted by many hosted checkout pages.
    if (options.email) params.set('email', options.email);
    if (options.description) params.set('comment', options.description);

    // Optional client-side signature for widget launch if merchant enables strict checks.
    if (this.widgetKey) {
      const base = `${this.widgetId}:${String(options.orderId)}:${options.amount.toFixed(2)}`;
      params.set('sign', md5(`${base}:${this.widgetKey}`));
    }

    return `${this.widgetPageUrl}?${params.toString()}`;
  }

  async validateNotification(data: any): Promise<{
    isValid: boolean;
    orderId: string;
    amount: number;
    signature?: string;
    raw?: any;
  }> {
    const normalized = normalizeMap(data);
    const signature = String(normalized.sign || normalized.signature || normalized.hash || '').trim();
    const orderId = String(
      normalized.destination ||
      normalized.order_id ||
      normalized.orderId ||
      normalized.invoice_id ||
      ''
    );
    const amount = Number.parseFloat(
      String(normalized.amount || normalized.payment_amount || normalized.sum || '0')
    ) || 0;

    if (!signature || !this.callbackKey) {
      return { isValid: false, orderId, amount, signature, raw: data };
    }

    const canonicalColon = canonicalFromPayload(normalized, ':');
    const canonicalDot = canonicalFromPayload(normalized, '.');
    const canonicalSemicolon = canonicalFromPayload(normalized, ';');

    const candidates = new Set<string>([
      md5(`${canonicalColon}:${this.callbackKey}`),
      md5(`${canonicalDot}.${this.callbackKey}`),
      md5(`${canonicalSemicolon};${this.callbackKey}`),
      hmacMd5(canonicalColon, this.callbackKey),
      hmacMd5(canonicalDot, this.callbackKey),
      hmacMd5(canonicalSemicolon, this.callbackKey),
      md5(`${orderId}:${amount.toFixed(2)}:${this.callbackKey}`),
      md5(`${orderId}:${this.callbackKey}`),
    ].map((v) => v.toLowerCase()));

    const isValid = candidates.has(signature.toLowerCase());
    return { isValid, orderId, amount, signature, raw: data };
  }

  getSuccessResponse(_orderId: string): string {
    return 'OK';
  }
}
