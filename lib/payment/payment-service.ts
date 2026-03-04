import { PaymentProvider, PaymentProviderType } from './types';
import { NowPaymentsProvider } from './providers/nowpayments';
import { CapitalistProvider } from './providers/capitalist';

class PaymentService {
  private providers: Record<PaymentProviderType, PaymentProvider>;
  private activeProvider: PaymentProviderType;

  constructor() {
    this.providers = {
      nowpayments: new NowPaymentsProvider(),
      capitalist: new CapitalistProvider(),
    };

    this.activeProvider = (process.env.PAYMENT_PROVIDER as PaymentProviderType) || 'nowpayments';
  }

  getProvider(): PaymentProvider {
    return this.providers[this.activeProvider] || this.providers.nowpayments;
  }

  getProviderByName(provider: string): PaymentProvider {
    const key = provider as PaymentProviderType;
    return this.providers[key] || this.providers.nowpayments;
  }

  getActiveProviderName(): string {
    return this.providers[this.activeProvider] ? this.activeProvider : 'nowpayments';
  }
}

export const paymentService = new PaymentService();
