import Stripe from 'stripe';
import { PaymentGateway, PaymentResponse } from './PaymentGateway';

export class StripeGateway implements PaymentGateway {
  private stripe: Stripe;

  constructor(apiKey: string) {
    this.stripe = new Stripe(apiKey, {
      apiVersion: '2023-10-16' as any,
    });
  }

  async processPayment(amount: number, currency: string, description: string): Promise<PaymentResponse> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        description,
        confirm: true,
        payment_method: 'pm_card_visa', // Sandbox default
        automatic_payment_methods: {
            enabled: true,
            allow_redirects: 'never',
        },
      });

      return {
        success: paymentIntent.status === 'succeeded',
        transactionId: paymentIntent.id,
        amount,
        currency,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
        amount,
        currency,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async refundPayment(transactionId: string): Promise<PaymentResponse> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: transactionId,
      });

      return {
        success: refund.status === 'succeeded',
        transactionId: refund.id,
        amount: refund.amount ? refund.amount / 100 : 0,
        currency: refund.currency || 'usd',
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
        amount: 0,
        currency: 'usd',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
