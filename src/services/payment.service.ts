import { getEnv } from '../config/env';
import { logger } from '../config/logger';

const env = getEnv();

type JsonRecord = Record<string, any>;

async function parseJsonSafe(response: Response): Promise<JsonRecord> {
  try {
    const data = await response.json();
    return (data ?? {}) as JsonRecord;
  } catch {
    return {};
  }
}

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
      const response = await fetch(`${this.baseUrl}/payment_intents`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
        }),
      });

      const data = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(data?.message || `Konnect API error (${response.status})`);
      }

      return {
        id: data.id,
        status: data.status,
        paymentUrl: data.payment_url,
        clientSecret: data.client_secret,
      };
    } catch (error: any) {
      logger.error('Konnect createPaymentIntent failed:', error?.message || error);
      throw new Error(`Failed to create payment intent: ${error?.message || 'Unknown error'}`);
    }
  }

  async verifyPayment(paymentId: string): Promise<KonnectWebhookPayload> {
    try {
      const response = await fetch(`${this.baseUrl}/payment_intents/${paymentId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      });

      const data = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(data?.message || `Konnect API error (${response.status})`);
      }

      return {
        paymentId: data.id,
        status: data.status === 'completed' ? 'SUCCESS' : 'FAILED',
        amount: data.amount,
        currency: data.currency,
        orderId: data.order?.id,
        transactionRef: data.transaction_ref,
        metadata: data.metadata,
      };
    } catch (error: any) {
      logger.error('Konnect verifyPayment failed:', error?.message || error);
      throw new Error(`Failed to verify payment: ${error?.message || 'Unknown error'}`);
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
