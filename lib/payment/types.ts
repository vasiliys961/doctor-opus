export interface PaymentProvider {
  /**
   * Generates the URL to redirect the user for payment
   */
  generatePaymentUrl(options: {
    amount: number;
    orderId: string | number;
    description: string;
    email?: string;
    isRecurring?: boolean;
    metadata?: Record<string, string>;
  }): Promise<string>;

  /**
   * Validates the notification (webhook) from the payment system
   */
  validateNotification(data: any): Promise<{
    isValid: boolean;
    orderId: string;
    amount: number;
    signature?: string;
    raw?: any;
  }>;

  /**
   * Success response string or object for the payment system's webhook
   */
  getSuccessResponse(orderId: string): string | object;

  /**
   * Refund a payment (partial or full).
   * Returns success status. Implementation depends on the provider.
   */
  refund?(transactionId: string, amount: number): Promise<{
    success: boolean;
    refundId?: string;
    error?: string;
  }>;
}

export type PaymentProviderType = 'robokassa' | 'tinkoff' | 'prodamus' | 'yoomoney' | 'botoplat';

export type RefundStatus = 'pending' | 'approved' | 'completed' | 'rejected';
