import { PaymentProvider, PaymentProviderType } from './types';
import { YagodaProvider } from './providers/yagoda';

function resolveActiveProvider(): PaymentProviderType {
  return 'yagoda';
}

class PaymentService {
  private providers: Record<PaymentProviderType, PaymentProvider>;
  private activeProvider: PaymentProviderType;

  constructor() {
    this.providers = {
      yagoda: new YagodaProvider(),
    };

    this.activeProvider = resolveActiveProvider();
  }

  getProvider(): PaymentProvider {
    return this.providers[this.activeProvider];
  }

  getActiveProviderName(): string {
    return this.activeProvider;
  }
}

export const paymentService = new PaymentService();
