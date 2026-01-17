import { PaymentProvider, PaymentProviderType } from './types';
import { RobokassaProvider } from './providers/robokassa';

// Placeholder classes for other providers
class TinkoffProvider implements PaymentProvider {
  async generatePaymentUrl() { return '#'; }
  async validateNotification() { return { isValid: false, orderId: '', amount: 0 }; }
  getSuccessResponse() { return 'OK'; }
}

class ProdamusProvider implements PaymentProvider {
  async generatePaymentUrl() { return '#'; }
  async validateNotification() { return { isValid: false, orderId: '', amount: 0 }; }
  getSuccessResponse() { return 'OK'; }
}

class YooMoneyProvider implements PaymentProvider {
  async generatePaymentUrl() { return '#'; }
  async validateNotification() { return { isValid: false, orderId: '', amount: 0 }; }
  getSuccessResponse() { return 'OK'; }
}

class PaymentService {
  private providers: Record<PaymentProviderType, PaymentProvider>;
  private activeProvider: PaymentProviderType;

  constructor() {
    this.providers = {
      robokassa: new RobokassaProvider(),
      tinkoff: new TinkoffProvider(),
      prodamus: new ProdamusProvider(),
      yoomoney: new YooMoneyProvider()
    };
    
    // Set active provider from env, default to robokassa for now
    this.activeProvider = (process.env.PAYMENT_PROVIDER as PaymentProviderType) || 'robokassa';
  }

  getProvider(): PaymentProvider {
    return this.providers[this.activeProvider];
  }

  getActiveProviderName(): string {
    return this.activeProvider;
  }
}

export const paymentService = new PaymentService();
