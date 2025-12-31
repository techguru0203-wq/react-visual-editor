import Stripe from 'stripe';
import { eq, and, isNull } from 'drizzle-orm';
import { STRIPE_CONFIG } from '../config/constants';
import { db } from '../db';
import {
  stripeCustomers,
  stripeSubscriptions,
  stripeOrders,
  stripeWebhookEvents,
  InsertStripeSubscription,
  InsertStripeOrder,
  InsertStripeWebhookEvent,
} from '../db/schema';

// Initialize Stripe with error handling for missing configuration
let stripe: Stripe | null = null;

if (!STRIPE_CONFIG.SECRET_KEY) {
  console.error(
    '⚠️  STRIPE_CONFIG.SECRET_KEY is not configured. Stripe functionality will be unavailable.'
  );
} else {
  try {
    stripe = new Stripe(STRIPE_CONFIG.SECRET_KEY);
  } catch (error) {
    console.error('⚠️  Failed to initialize Stripe:', error);
  }
}

// ==================== Helper Functions ====================

function ensureStripeConfigured(): Stripe {
  if (!stripe) {
    throw new Error(
      'Stripe is not configured. Please set STRIPE_CONFIG.SECRET_KEY in your environment variables.'
    );
  }
  return stripe;
}

// ==================== Stripe API Functions ====================

export async function createCheckoutSession(params: {
  productName: string;
  unitAmount: number; // USD
  customerEmail: string;
  quantity: number;
  successUrl: string;
  cancelUrl: string;
  userId?: string; // optional, for linking to user
  priceId?: string; // Stripe Price ID for tracking
  productId?: string; // Stripe Product ID for tracking
}): Promise<{ sessionId: string; url: string | null }> {
  const {
    productName,
    unitAmount,
    customerEmail,
    quantity,
    successUrl,
    cancelUrl,
    userId,
    priceId,
    productId,
  } = params;

  // Try to get or create a Stripe customer for this user
  let stripeCustomerId: string | undefined;
  if (userId) {
    const existingCustomer = await getStripeCustomerByUserId(userId);
    if (existingCustomer) {
      stripeCustomerId = existingCustomer.customerId;
    }
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: productName },
          unit_amount: Math.round(unitAmount * 100),
        },
        quantity,
      },
    ],
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
  };

  // Use existing customer or provide email for new customer creation
  if (stripeCustomerId) {
    sessionParams.customer = stripeCustomerId;
  } else {
    sessionParams.customer_email = customerEmail;
  }

  // Add metadata for tracking
  const metadata: Record<string, string> = {};
  if (userId) metadata.userId = userId;
  if (priceId) metadata.priceId = priceId;
  if (productId) metadata.productId = productId;

  if (Object.keys(metadata).length > 0) {
    sessionParams.metadata = metadata;
  }

  const session = await ensureStripeConfigured().checkout.sessions.create(
    sessionParams
  );

  return {
    sessionId: session.id,
    url: session.url,
  };
}

export async function createSubscriptionSession(params: {
  productName: string;
  unitAmount: number; // USD
  customerEmail: string;
  interval: 'week' | 'month' | 'year';
  intervalCount?: number;
  trialDays?: number;
  successUrl: string;
  cancelUrl: string;
  userId?: string; // optional, for linking to user
  priceId?: string; // Stripe Price ID for tracking
  productId?: string; // Stripe Product ID for tracking
}): Promise<{ sessionId: string; url: string | null }> {
  const {
    productName,
    unitAmount,
    customerEmail,
    interval,
    intervalCount = 1,
    trialDays,
    successUrl,
    cancelUrl,
    userId,
    priceId,
    productId,
  } = params;

  // Try to get or create a Stripe customer for this user
  let stripeCustomerId: string | undefined;
  if (userId) {
    const existingCustomer = await getStripeCustomerByUserId(userId);
    if (existingCustomer) {
      stripeCustomerId = existingCustomer.customerId;
    }
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    payment_method_types: ['card'],
    subscription_data: {
      trial_period_days: trialDays,
    },
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: productName },
          unit_amount: Math.round(unitAmount * 100),
          recurring: { interval, interval_count: intervalCount },
        },
        quantity: 1,
      },
    ],
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
  };

  // Use existing customer or provide email for new customer creation
  if (stripeCustomerId) {
    sessionParams.customer = stripeCustomerId;
  } else {
    sessionParams.customer_email = customerEmail;
  }

  // Add metadata for tracking
  const metadata: Record<string, string> = {};
  if (userId) metadata.userId = userId;
  if (priceId) metadata.priceId = priceId;
  if (productId) metadata.productId = productId;

  if (Object.keys(metadata).length > 0) {
    sessionParams.metadata = metadata;
  }

  const session = await ensureStripeConfigured().checkout.sessions.create(
    sessionParams
  );

  return {
    sessionId: session.id,
    url: session.url,
  };
}

// ==================== Database Operations ====================

/**
 * Find or create a Stripe customer record
 */
export async function findOrCreateStripeCustomer(params: {
  userId: string;
  stripeCustomerId: string;
}): Promise<string> {
  const { userId, stripeCustomerId } = params;

  // Check if customer already exists
  const existing = await db
    .select()
    .from(stripeCustomers)
    .where(
      and(eq(stripeCustomers.userId, userId), isNull(stripeCustomers.deletedAt))
    )
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  // Create new customer record
  const [newCustomer] = await db
    .insert(stripeCustomers)
    .values({
      userId,
      customerId: stripeCustomerId,
    })
    .returning();

  return newCustomer.id;
}

/**
 * Get Stripe customer by user ID
 */
export async function getStripeCustomerByUserId(userId: string) {
  const result = await db
    .select()
    .from(stripeCustomers)
    .where(
      and(eq(stripeCustomers.userId, userId), isNull(stripeCustomers.deletedAt))
    )
    .limit(1);

  return result[0] || null;
}

/**
 * Get Stripe customer by Stripe customer ID
 */
export async function getStripeCustomerByStripeId(customerId: string) {
  const result = await db
    .select()
    .from(stripeCustomers)
    .where(
      and(
        eq(stripeCustomers.customerId, customerId),
        isNull(stripeCustomers.deletedAt)
      )
    )
    .limit(1);

  return result[0] || null;
}

/**
 * Create or update subscription
 */
export async function upsertStripeSubscription(data: InsertStripeSubscription) {
  // Check if subscription already exists
  if (data.subscriptionId) {
    const existing = await db
      .select()
      .from(stripeSubscriptions)
      .where(eq(stripeSubscriptions.subscriptionId, data.subscriptionId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing subscription
      const [updated] = await db
        .update(stripeSubscriptions)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(stripeSubscriptions.id, existing[0].id))
        .returning();

      return updated;
    }
  }

  // Create new subscription
  const [created] = await db
    .insert(stripeSubscriptions)
    .values(data)
    .returning();

  return created;
}

/**
 * Get active subscriptions for a customer
 */
export async function getActiveSubscriptionsByCustomerId(customerId: string) {
  return await db
    .select()
    .from(stripeSubscriptions)
    .where(
      and(
        eq(stripeSubscriptions.customerId, customerId),
        eq(stripeSubscriptions.status, 'active'),
        isNull(stripeSubscriptions.deletedAt)
      )
    );
}

/**
 * Get all subscriptions for a user
 */
export async function getSubscriptionsByUserId(userId: string) {
  const customer = await getStripeCustomerByUserId(userId);
  if (!customer) return [];

  return await db
    .select()
    .from(stripeSubscriptions)
    .where(
      and(
        eq(stripeSubscriptions.customerId, customer.customerId),
        isNull(stripeSubscriptions.deletedAt)
      )
    );
}

/**
 * Create order
 */
export async function createStripeOrder(data: InsertStripeOrder) {
  const [created] = await db.insert(stripeOrders).values(data).returning();

  return created;
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  checkoutSessionId: string,
  status: 'pending' | 'completed' | 'canceled'
) {
  const [updated] = await db
    .update(stripeOrders)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(stripeOrders.checkoutSessionId, checkoutSessionId))
    .returning();

  return updated;
}

/**
 * Get orders for a user
 */
export async function getOrdersByUserId(userId: string) {
  const customer = await getStripeCustomerByUserId(userId);
  if (!customer) return [];

  return await db
    .select()
    .from(stripeOrders)
    .where(
      and(
        eq(stripeOrders.customerId, customer.customerId),
        isNull(stripeOrders.deletedAt)
      )
    );
}

/**
 * Log webhook event (for idempotency and debugging)
 */
export async function logWebhookEvent(data: InsertStripeWebhookEvent) {
  try {
    const [created] = await db
      .insert(stripeWebhookEvents)
      .values(data)
      .returning();

    return created;
  } catch (error: any) {
    // If unique constraint fails, event already processed
    if (error.code === '23505') {
      return null;
    }
    throw error;
  }
}

/**
 * Check if webhook event was already processed
 */
export async function isWebhookEventProcessed(
  eventId: string
): Promise<boolean> {
  const result = await db
    .select()
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.eventId, eventId))
    .limit(1);

  return result.length > 0;
}

/**
 * Mark webhook event as processed
 */
export async function markWebhookEventProcessed(
  eventId: string,
  processingError?: string
) {
  await db
    .update(stripeWebhookEvents)
    .set({
      processed: true,
      processingError,
    })
    .where(eq(stripeWebhookEvents.eventId, eventId));
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(subscriptionId: string) {
  const [updated] = await db
    .update(stripeSubscriptions)
    .set({
      status: 'canceled',
      canceledAt: Math.floor(Date.now() / 1000),
      updatedAt: new Date(),
    })
    .where(eq(stripeSubscriptions.subscriptionId, subscriptionId))
    .returning();

  return updated;
}
