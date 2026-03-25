export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  error?: string;
  amount: number;
  currency: string;
  timestamp: string;
}

export interface PaymentGateway {
  processPayment(amount: number, currency: string, description: string): Promise<PaymentResponse>;
  refundPayment(transactionId: string): Promise<PaymentResponse>;
}
