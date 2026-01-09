import crypto from 'crypto';

interface RobokassaOptions {
  merchantLogin: string;
  pass1: string;
  pass2: string;
  isTest?: boolean;
}

export class Robokassa {
  private login: string;
  private pass1: string;
  private pass2: string;
  private baseUrl: string;

  constructor(options: RobokassaOptions) {
    this.login = options.merchantLogin;
    this.pass1 = options.pass1;
    this.pass2 = options.pass2;
    this.baseUrl = options.isTest 
      ? 'https://auth.robokassa.ru/Merchant/Index.aspx' 
      : 'https://auth.robokassa.ru/Merchant/Index.aspx';
  }

  /**
   * Генерирует ссылку на оплату
   */
  generatePaymentUrl(outSum: number, invId: number, description: string, email?: string, isRecurring: boolean = false): string {
    let signatureStr = `${this.login}:${outSum}:${invId}:${this.pass1}`;
    
    // Если нужны дополнительные параметры для рекуррентных платежей
    const customParams: Record<string, string> = {};
    if (isRecurring) {
      customParams['shp_is_recurring'] = '1';
      // Добавляем кастомные параметры в строку подписи в алфавитном порядке
      signatureStr += `:shp_is_recurring=1`;
    }

    const signature = crypto.createHash('md5').update(signatureStr).digest('hex');

    const params = new URLSearchParams({
      MerchantLogin: this.login,
      OutSum: outSum.toString(),
      InvId: invId.toString(),
      Description: description,
      SignatureValue: signature,
      Culture: 'ru',
      Encoding: 'utf-8',
    });

    if (email) params.append('Email', email);
    if (isRecurring) params.append('shp_is_recurring', '1');
    
    // Для рекуррентных платежей по протоколу Robokassa нужно передать Recurring=true
    if (isRecurring) {
        params.append('IsRecurring', 'true');
    }

    return `${this.baseUrl}?${params.toString()}`;
  }

  /**
   * Проверяет подпись ответа (ResultURL)
   */
  validateSignature(outSum: string, invId: string, signature: string, customParams: Record<string, string> = {}): boolean {
    // Собираем строку: OutSum:InvId:Pass2[:shp_param1=value1[:shp_param2=value2...]]
    let str = `${outSum}:${invId}:${this.pass2}`;
    
    // Сортируем shp-параметры по алфавиту
    const shpParams = Object.keys(customParams)
      .filter(key => key.startsWith('shp_'))
      .sort()
      .map(key => `${key}=${customParams[key]}`)
      .join(':');

    if (shpParams) {
      str += `:${shpParams}`;
    }

    const mySignature = crypto.createHash('md5').update(str).digest('hex');
    return mySignature.toLowerCase() === signature.toLowerCase();
  }
}

export const robokassa = new Robokassa({
  merchantLogin: process.env.ROBOKASSA_LOGIN || '',
  pass1: process.env.ROBOKASSA_PASS1 || '',
  pass2: process.env.ROBOKASSA_PASS2 || '',
  isTest: process.env.ROBOKASSA_TEST_MODE === 'true'
});

