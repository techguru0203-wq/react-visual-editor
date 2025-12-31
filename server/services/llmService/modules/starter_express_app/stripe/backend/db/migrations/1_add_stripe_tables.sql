-- Migration: Add Stripe Integration Tables
-- This migration adds tables for managing Stripe customers, subscriptions, orders, and webhook events

-- Create Stripe subscription status enum
DROP TYPE IF EXISTS stripe_subscription_status CASCADE;
CREATE TYPE stripe_subscription_status AS ENUM (
    'not_started',
    'incomplete',
    'incomplete_expired',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'paused'
);

-- Create Stripe order status enum
DROP TYPE IF EXISTS stripe_order_status CASCADE;
CREATE TYPE stripe_order_status AS ENUM (
    'pending',
    'completed',
    'canceled'
);

-- Create stripe_customers table
-- Links application users to Stripe customer IDs
CREATE TABLE "stripe_customers" (
    "id" TEXT PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL UNIQUE REFERENCES "Users"("id") ON DELETE CASCADE,
    "customer_id" TEXT NOT NULL UNIQUE,
    "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
    "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL,
    "deleted_at" TIMESTAMP DEFAULT NULL
);

-- Create index on user_id for faster lookups
CREATE INDEX "stripe_customers_user_id_idx" ON "stripe_customers"("user_id");

-- Create unique index on customer_id
CREATE UNIQUE INDEX "stripe_customers_customer_id_idx" ON "stripe_customers"("customer_id");

-- Create stripe_subscriptions table
-- Manages subscription data including status, periods, and payment details
CREATE TABLE "stripe_subscriptions" (
    "id" TEXT PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" TEXT NOT NULL,
    "subscription_id" TEXT UNIQUE,
    "price_id" TEXT,
    "product_id" TEXT,
    "current_period_start" BIGINT,
    "current_period_end" BIGINT,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT FALSE,
    "canceled_at" BIGINT,
    "trial_start" BIGINT,
    "trial_end" BIGINT,
    "payment_method_brand" TEXT,
    "payment_method_last4" TEXT,
    "status" stripe_subscription_status NOT NULL,
    "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
    "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL,
    "deleted_at" TIMESTAMP DEFAULT NULL
);

-- Create index on customer_id for faster lookups
CREATE INDEX "stripe_subscriptions_customer_id_idx" ON "stripe_subscriptions"("customer_id");

-- Create unique index on subscription_id
CREATE UNIQUE INDEX "stripe_subscriptions_subscription_id_idx" ON "stripe_subscriptions"("subscription_id") WHERE "subscription_id" IS NOT NULL;

-- Create stripe_orders table
-- Stores order/purchase information from checkout sessions
CREATE TABLE "stripe_orders" (
    "id" TEXT PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    "checkout_session_id" TEXT NOT NULL UNIQUE,
    "payment_intent_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "price_id" TEXT,
    "product_id" TEXT,
    "amount_subtotal" BIGINT NOT NULL,
    "amount_total" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "payment_status" TEXT NOT NULL,
    "status" stripe_order_status NOT NULL DEFAULT 'pending',
    "metadata" TEXT,
    "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
    "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL,
    "deleted_at" TIMESTAMP DEFAULT NULL
);

-- Create index on customer_id for faster lookups
CREATE INDEX "stripe_orders_customer_id_idx" ON "stripe_orders"("customer_id");

-- Create unique index on checkout_session_id
CREATE UNIQUE INDEX "stripe_orders_checkout_session_id_idx" ON "stripe_orders"("checkout_session_id");

-- Create index on payment_intent_id
CREATE INDEX "stripe_orders_payment_intent_id_idx" ON "stripe_orders"("payment_intent_id");

-- Create stripe_webhook_events table (optional but recommended)
-- Stores webhook events for debugging and audit trail
CREATE TABLE "stripe_webhook_events" (
    "id" TEXT PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    "event_id" TEXT NOT NULL UNIQUE,
    "event_type" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT FALSE,
    "processing_error" TEXT,
    "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create unique index on event_id to prevent duplicate processing
CREATE UNIQUE INDEX "stripe_webhook_events_event_id_idx" ON "stripe_webhook_events"("event_id");

-- Create index on processed status for querying unprocessed events
CREATE INDEX "stripe_webhook_events_processed_idx" ON "stripe_webhook_events"("processed");

-- Create index on event_type for filtering by event type
CREATE INDEX "stripe_webhook_events_event_type_idx" ON "stripe_webhook_events"("event_type");

-- Create view for user subscriptions (simplified without RLS)
-- This view joins customers and subscriptions for easy querying
CREATE VIEW "stripe_user_subscriptions" AS
SELECT
    c.user_id,
    c.customer_id,
    s.id as subscription_id_internal,
    s.subscription_id,
    s.status as subscription_status,
    s.price_id,
    s.product_id,
    s.current_period_start,
    s.current_period_end,
    s.cancel_at_period_end,
    s.canceled_at,
    s.trial_start,
    s.trial_end,
    s.payment_method_brand,
    s.payment_method_last4,
    s.created_at,
    s.updated_at
FROM "stripe_customers" c
LEFT JOIN "stripe_subscriptions" s ON c.customer_id = s.customer_id
WHERE c.deleted_at IS NULL
AND (s.deleted_at IS NULL OR s.deleted_at IS NULL);

-- Create view for user orders
-- This view joins customers and orders for easy querying
CREATE VIEW "stripe_user_orders" AS
SELECT
    c.user_id,
    c.customer_id,
    o.id as order_id,
    o.checkout_session_id,
    o.payment_intent_id,
    o.amount_subtotal,
    o.amount_total,
    o.currency,
    o.payment_status,
    o.status as order_status,
    o.metadata,
    o.created_at as order_date,
    o.updated_at
FROM "stripe_customers" c
LEFT JOIN "stripe_orders" o ON c.customer_id = o.customer_id
WHERE c.deleted_at IS NULL
AND (o.deleted_at IS NULL OR o.deleted_at IS NULL);

-- Add comments for documentation
COMMENT ON TABLE "stripe_customers" IS 'Links application users to Stripe customer IDs';
COMMENT ON TABLE "stripe_subscriptions" IS 'Manages subscription data including status, periods, and payment details';
COMMENT ON TABLE "stripe_orders" IS 'Stores order/purchase information from checkout sessions';
COMMENT ON TABLE "stripe_webhook_events" IS 'Stores webhook events for debugging and audit trail';

