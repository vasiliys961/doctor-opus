import { PaymentProvider, PaymentProviderType } from './types';
import { PayanywayProvider } from './providers/payanyway';
import { YagodaProvider } from './providers/yagoda';

function resolveActiveProvider(): PaymentProviderType {
  const raw = (process.env.PAYMENT_PROVIDER || '').trim().toLowerCase();
  return raw === 'payanyway' ? 'payanyway' : 'yagoda';
}

class PaymentService {
  private providers: Record<PaymentProviderType, PaymentProvider>;
  private activeProvider: PaymentProviderType;

  constructor() {
    this.providers = {
      payanyway: new PayanywayProvider(),
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
