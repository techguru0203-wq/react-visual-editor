// Stripe Integration
import {
  pgTable,
  text,
  timestamp,
  boolean,
  bigint,
  pgEnum,
} from 'drizzle-orm/pg-core';

// Stripe subscription status enum
// IMPORTANT: pgEnum must be defined BEFORE any table definitions
export const stripeSubscriptionStatusEnum = pgEnum(
  'stripe_subscription_status',
  [
    'not_started',
    'incomplete',
    'incomplete_expired',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'paused',
  ]
);

// Stripe order status enum
export const stripeOrderStatusEnum = pgEnum('stripe_order_status', [
  'pending',
  'completed',
  'canceled',
]);

// Users table reference - should exist in your main application

// Stripe Customers Table
// Links application users to Stripe customer IDs
export const stripeCustomers = pgTable('stripe_customers', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`)
    .notNull(),
  userId: text('user_id')
    .references(() => users.id)
    .notNull()
    .unique(),
  customerId: text('customer_id').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// Stripe Subscriptions Table
// Manages subscription data including status, periods, and payment details
export const stripeSubscriptions = pgTable('stripe_subscriptions', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`)
    .notNull(),
  customerId: text('customer_id').notNull(),
  subscriptionId: text('subscription_id').unique(),
  priceId: text('price_id'),
  productId: text('product_id'),
  currentPeriodStart: bigint('current_period_start', { mode: 'number' }),
  currentPeriodEnd: bigint('current_period_end', { mode: 'number' }),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
  canceledAt: bigint('canceled_at', { mode: 'number' }),
  trialStart: bigint('trial_start', { mode: 'number' }),
  trialEnd: bigint('trial_end', { mode: 'number' }),
  paymentMethodBrand: text('payment_method_brand'),
  paymentMethodLast4: text('payment_method_last4'),
  status: stripeSubscriptionStatusEnum('status').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// Stripe Orders Table
// Stores order/purchase information from checkout sessions
export const stripeOrders = pgTable('stripe_orders', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`)
    .notNull(),
  checkoutSessionId: text('checkout_session_id').notNull().unique(),
  paymentIntentId: text('payment_intent_id').notNull(),
  customerId: text('customer_id').notNull(),
  priceId: text('price_id'), // Stripe Price ID
  productId: text('product_id'), // Stripe Product ID
  amountSubtotal: bigint('amount_subtotal', { mode: 'number' }).notNull(),
  amountTotal: bigint('amount_total', { mode: 'number' }).notNull(),
  currency: text('currency').notNull(),
  paymentStatus: text('payment_status').notNull(),
  status: stripeOrderStatusEnum('status').default('pending').notNull(),
  metadata: text('metadata'), // JSON string for additional data
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// Stripe Webhook Events Table (optional but recommended)
// Stores webhook events for debugging and audit trail
export const stripeWebhookEvents = pgTable('stripe_webhook_events', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`)
    .notNull(),
  eventId: text('event_id').notNull().unique(),
  eventType: text('event_type').notNull(),
  data: text('data').notNull(), // JSON string of event data
  processed: boolean('processed').default(false).notNull(),
  processingError: text('processing_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Zod schemas for validation
export const insertStripeCustomerSchema = z.object({
  userId: z.string().uuid(),
  customerId: z.string().min(1, 'Stripe customer ID is required'),
});

export const insertStripeSubscriptionSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  subscriptionId: z.string().optional(),
  priceId: z.string().optional(),
  productId: z.string().optional(),
  currentPeriodStart: z.number().optional(),
  currentPeriodEnd: z.number().optional(),
  cancelAtPeriodEnd: z.boolean().default(false),
  canceledAt: z.number().optional(),
  trialStart: z.number().optional(),
  trialEnd: z.number().optional(),
  paymentMethodBrand: z.string().optional(),
  paymentMethodLast4: z.string().optional(),
  status: z.enum([
    'not_started',
    'incomplete',
    'incomplete_expired',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'paused',
  ]),
});

export const insertStripeOrderSchema = z.object({
  checkoutSessionId: z.string().min(1, 'Checkout session ID is required'),
  paymentIntentId: z.string().min(1, 'Payment intent ID is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  priceId: z.string().optional(),
  productId: z.string().optional(),
  amountSubtotal: z.number().int().positive(),
  amountTotal: z.number().int().positive(),
  currency: z.string().length(3, 'Currency must be a 3-letter code'),
  paymentStatus: z.string().min(1, 'Payment status is required'),
  status: z.enum(['pending', 'completed', 'canceled']).default('pending'),
  metadata: z.string().optional(),
});

// Type exports
export type StripeCustomer = typeof stripeCustomers.$inferSelect;
export type InsertStripeCustomer = typeof stripeCustomers.$inferInsert;

export type StripeSubscription = typeof stripeSubscriptions.$inferSelect;
export type InsertStripeSubscription = typeof stripeSubscriptions.$inferInsert;

export type StripeOrder = typeof stripeOrders.$inferSelect;
export type InsertStripeOrder = typeof stripeOrders.$inferInsert;

export type StripeWebhookEvent = typeof stripeWebhookEvents.$inferSelect;
export type InsertStripeWebhookEvent = typeof stripeWebhookEvents.$inferInsert;
