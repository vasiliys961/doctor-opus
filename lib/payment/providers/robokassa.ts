import crypto from 'crypto';
import { PaymentProvider } from '../types';

export class RobokassaProvider implements PaymentProvider {
  private login: string;
  private pass1: string;
  private pass2: string;
  private baseUrl: string;

  constructor() {
    this.login = process.env.ROBOKASSA_LOGIN || '';
    this.pass1 = process.env.ROBOKASSA_PASS1 || '';
    this.pass2 = process.env.ROBOKASSA_PASS2 || '';
    this.baseUrl = 'https://auth.robokassa.ru/Merchant/Index.aspx';
  }

  async generatePaymentUrl(options: {
    amount: number;
    orderId: string | number;
    description: string;
    email?: string;
    isRecurring?: boolean;
    metadata?: Record<string, string>;
  }): Promise<string> {
    const { amount, orderId, description, email, isRecurring, metadata = {} } = options;
    
    let signatureStr = `${this.login}:${amount}:${orderId}:${this.pass1}`;
    
    // Add custom shp_ params to signature
    const shpParams = Object.keys(metadata)
      .filter(key => key.startsWith('shp_'))
      .sort()
      .map(key => `${key}=${metadata[key]}`)
      .join(':');

    if (shpParams) {
      signatureStr += `:${shpParams}`;
    }

    const signature = crypto.createHash('md5').update(signatureStr).digest('hex');

    const params = new URLSearchParams({
      MerchantLogin: this.login,
      OutSum: amount.toString(),
      InvId: orderId.toString(),
      Description: description,
      SignatureValue: signature,
      Culture: 'ru',
      Encoding: 'utf-8',
    });

    if (email) params.append('Email', email);
    
    // Custom metadata
    Object.entries(metadata).forEach(([key, value]) => {
      params.append(key, value);
    });

    if (isRecurring) {
      params.append('IsRecurring', 'true');
    }

    return `${this.baseUrl}?${params.toString()}`;
  }

  async validateNotification(data: any): Promise<{
    isValid: boolean;
    orderId: string;
    amount: number;
    signature?: string;
    raw?: any;
  }> {
    const { OutSum, InvId, SignatureValue } = data;
    
    // Extract shp_ params
    const customParams: Record<string, string> = {};
    Object.entries(data).forEach(([key, value]) => {
      if (key.startsWith('shp_') && typeof value === 'string') {
        customParams[key] = value;
      }
    });

    let str = `${OutSum}:${InvId}:${this.pass2}`;
    
    const shpParams = Object.keys(customParams)
      .sort()
      .map(key => `${key}=${customParams[key]}`)
      .join(':');

    if (shpParams) {
      str += `:${shpParams}`;
    }

    const mySignature = crypto.createHash('md5').update(str).digest('hex');
    const isValid = mySignature.toLowerCase() === (SignatureValue as string).toLowerCase();

    return {
      isValid,
      orderId: InvId as string,
      amount: parseFloat(OutSum as string),
      signature: SignatureValue as string,
      raw: data
    };
  }

  getSuccessResponse(orderId: string): string {
    return `OK${orderId}`;
  }
}
