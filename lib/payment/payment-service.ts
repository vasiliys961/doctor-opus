import { PaymentProvider, PaymentProviderType } from './types';
import { NowPaymentsProvider } from './providers/nowpayments';

class PaymentService {
  private providers: Record<PaymentProviderType, PaymentProvider>;
  private activeProvider: PaymentProviderType;

  constructor() {
    this.providers = {
      nowpayments: new NowPaymentsProvider(),
    };

    this.activeProvider = (process.env.PAYMENT_PROVIDER as PaymentProviderType) || 'nowpayments';
  }

  getProvider(): PaymentProvider {
    return this.providers[this.activeProvider];
  }

  getActiveProviderName(): string {
    return this.activeProvider;
  }
}

export const paymentService = new PaymentService();
