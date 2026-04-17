import axios from 'axios';
import { getEnv } from '../config/env';
import { logger } from '../config/logger';

const env = getEnv();

export interface KonnectPaymentIntentRequest {
  amount: number;
  currency: string;
  customerId: string;
  customerEmail: string;
  orderId: string;
  webhookUrl?: string;
}

export interface KonnectPaymentIntentResponse {
  id: string;
  status: string;
  paymentUrl: string;
  clientSecret?: string;
}

export interface KonnectWebhookPayload {
  paymentId: string;
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED';
  amount: number;
  currency: string;
  orderId: string;
  transactionRef: string;
  metadata?: Record<string, any>;
}

export class KonnectPaymentService {
  private baseUrl = 'https://api.konnect.network/api/v1';
  private apiKey: string;
  private secretKey: string;
  private entityId: string;

  constructor() {
    if (!env.KONNECT_API_KEY || !env.KONNECT_SECRET_KEY || !env.KONNECT_ENTITY_ID) {
      throw new Error('Konnect payment credentials not configured');
    }
    this.apiKey = env.KONNECT_API_KEY;
    this.secretKey = env.KONNECT_SECRET_KEY;
    this.entityId = env.KONNECT_ENTITY_ID;
  }

  async createPaymentIntent(
    request: KonnectPaymentIntentRequest
  ): Promise<KonnectPaymentIntentResponse> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/payment_intents`,
        {
          amount: request.amount,
          currency: request.currency,
          customer: {
            id: request.customerId,
            email: request.customerEmail,
          },
          order: {
            id: request.orderId,
          },
          entity_id: this.entityId,
          webhook_url: request.webhookUrl || `${env.FRONTEND_URL}/api/payment/webhook`,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        id: response.data.id,
        status: response.data.status,
        paymentUrl: response.data.payment_url,
        clientSecret: response.data.client_secret,
      };
    } catch (error: any) {
      logger.error('Konnect createPaymentIntent failed:', error.response?.data || error.message);
      throw new Error(`Failed to create payment intent: ${error.response?.data?.message || error.message}`);
    }
  }

  async verifyPayment(paymentId: string): Promise<KonnectWebhookPayload> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/payment_intents/${paymentId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.secretKey}`,
          },
        }
      );

      return {
        paymentId: response.data.id,
        status: response.data.status === 'completed' ? 'SUCCESS' : 'FAILED',
        amount: response.data.amount,
        currency: response.data.currency,
        orderId: response.data.order?.id,
        transactionRef: response.data.transaction_ref,
        metadata: response.data.metadata,
      };
    } catch (error: any) {
      logger.error('Konnect verifyPayment failed:', error.response?.data || error.message);
      throw new Error(`Failed to verify payment: ${error.response?.data?.message || error.message}`);
    }
  }

  async handleWebhook(payload: any, signature: string): Promise<KonnectWebhookPayload> {
    // Verify webhook signature if implemented
    // For now, just process the payload
    logger.info('Konnect webhook received:', payload);

    return {
      paymentId: payload.id,
      status: payload.status === 'completed' || payload.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
      amount: payload.amount,
      currency: payload.currency,
      orderId: payload.order?.id || payload.orderId,
      transactionRef: payload.transaction_ref || payload.transactionRef,
      metadata: payload.metadata,
    };
  }
}

// Stripe service placeholder (similar architecture)
export class StripePaymentService {
  // Install stripe package and implement similarly
  async createCheckoutSession(params: {
    amount: number;
    currency: string;
    successUrl: string;
    cancelUrl: string;
    metadata: Record<string, string>;
  }): Promise<{ sessionId: string; url: string }> {
    logger.info('Stripe checkout not implemented', params);
    throw new Error('Stripe payment not implemented');
  }

  async verifySession(sessionId: string): Promise<any> {
    logger.info('Stripe verify not implemented', { sessionId });
    throw new Error('Stripe verification not implemented');
  }
}

export const konnectPaymentService = env.KONNECT_API_KEY
  ? new KonnectPaymentService()
  : null;

export const stripePaymentService = new StripePaymentService();
