import { PaymentProvider, PaymentProviderType } from './types';
import { PayanywayProvider } from './providers/payanyway';

class PaymentService {
  private providers: Record<PaymentProviderType, PaymentProvider>;
  private activeProvider: PaymentProviderType;

  constructor() {
    this.providers = {
      payanyway: new PayanywayProvider(),
    };

    this.activeProvider = (process.env.PAYMENT_PROVIDER as PaymentProviderType) || 'payanyway';
  }

  getProvider(): PaymentProvider {
    return this.providers[this.activeProvider];
  }

  getActiveProviderName(): string {
    return this.activeProvider;
  }
}

export const paymentService = new PaymentService();
