/**
 * Stripe Integration Shared Types
 */

// ==================== Request Types ====================

export interface CreateCheckoutSessionRequest {
  productId: string;
  quantity?: number;
}

export interface CreateSubscriptionSessionRequest {
  productId: string;
  interval: 'week' | 'month' | 'year';
  intervalCount?: number;
  trialDays?: number;
}

export interface CancelSubscriptionRequest {
  subscriptionId: string;
}

// ==================== Response Types ====================

export interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{
      code: string;
      path: string[];
      message: string;
    }>;
  };
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

// ==================== Data Types ====================

export interface StripeCustomer {
  id: string;
  userId: string;
  customerId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt?: Date | string | null;
}

export type StripeSubscriptionStatus =
  | 'not_started'
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused';

export interface StripeSubscription {
  id: string;
  customerId: string;
  subscriptionId: string | null;
  priceId: string | null;
  productId: string | null;
  currentPeriodStart: number | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: number | null;
  trialStart: number | null;
  trialEnd: number | null;
  paymentMethodBrand: string | null;
  paymentMethodLast4: string | null;
  status: StripeSubscriptionStatus;
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt?: Date | string | null;
}

export type StripeOrderStatus = 'pending' | 'completed' | 'canceled';

export interface StripeOrder {
  id: string;
  checkoutSessionId: string;
  paymentIntentId: string;
  customerId: string;
  priceId?: string | null;
  productId?: string | null;
  amountSubtotal: number;
  amountTotal: number;
  currency: string;
  paymentStatus: string;
  status: StripeOrderStatus;
  metadata: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt?: Date | string | null;
}

export interface StripeWebhookEvent {
  id: string;
  eventId: string;
  eventType: string;
  data: string;
  processed: boolean;
  processingError: string | null;
  createdAt: Date | string;
}

// ==================== API Response Data Types ====================

export interface CheckoutSessionData {
  sessionId: string;
}

export interface SubscriptionsData {
  subscriptions: StripeSubscription[];
  total: number;
}

export interface OrdersData {
  orders: StripeOrder[];
  total: number;
}

export interface CustomerData {
  customer: StripeCustomer;
}

export interface CancelSubscriptionData {
  subscription: StripeSubscription;
}

// ==================== Helper Types ====================

/**
 * Converts Date fields to strings for JSON serialization
 */
export type Serialized<T> = {
  [K in keyof T]: T[K] extends Date
    ? string
    : T[K] extends Date | null
    ? string | null
    : T[K] extends Date | undefined
    ? string | undefined
    : T[K];
};
