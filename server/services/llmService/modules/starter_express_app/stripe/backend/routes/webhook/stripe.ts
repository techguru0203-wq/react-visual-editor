import express from 'express';
import Stripe from 'stripe';
import { STRIPE_CONFIG } from '../../config/constants';
import {
  findOrCreateStripeCustomer,
  upsertStripeSubscription,
  createStripeOrder,
  logWebhookEvent,
  isWebhookEventProcessed,
  markWebhookEventProcessed,
} from '../../services/stripeService';

const router = express.Router();

const stripe = new Stripe(STRIPE_CONFIG.SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
});

/**
 * POST /webhook/stripe
 * Handle Stripe webhook events
 */
router.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = STRIPE_CONFIG.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('Stripe webhook secret not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  console.log('Received Stripe webhook event:', event.type, event.id);

  // Check if event already processed (idempotency)
  try {
    const alreadyProcessed = await isWebhookEventProcessed(event.id);
    if (alreadyProcessed) {
      console.log('Event already processed:', event.id);
      return res.json({ received: true, status: 'already_processed' });
    }
  } catch (error) {
    console.error('Error checking event status:', error);
    // Continue processing even if check fails
  }

  // Log the webhook event
  try {
    await logWebhookEvent({
      eventId: event.id,
      eventType: event.type,
      data: JSON.stringify(event.data.object),
      processed: false,
    });
  } catch (error) {
    console.error('Error logging webhook event:', error);
    // Continue processing even if logging fails
  }

  // Process the event
  let processingError: string | undefined;

  try {
    switch (event.type) {
      // ==================== Checkout Session Events ====================

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        console.log('Processing checkout.session.completed:', {
          sessionId: session.id,
          mode: session.mode,
          customerEmail: session.customer_email,
          amountTotal: session.amount_total,
          paymentStatus: session.payment_status,
        });

        if (session.mode === 'payment') {
          // One-time payment
          await handleOneTimePayment(session);
        } else if (session.mode === 'subscription') {
          // Subscription created via checkout
          await handleSubscriptionCheckout(session);
        }
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout session expired:', session.id);
        // Optionally handle expired sessions
        break;
      }

      // ==================== Customer Events ====================

      case 'customer.created': {
        const customer = event.data.object as Stripe.Customer;
        console.log('Customer created:', customer.id);
        // Customer will be linked when they complete a payment
        break;
      }

      case 'customer.updated': {
        const customer = event.data.object as Stripe.Customer;
        console.log('Customer updated:', customer.id);
        break;
      }

      case 'customer.deleted': {
        const customer = event.data.object as Stripe.Customer;
        console.log('Customer deleted:', customer.id);
        // Optionally soft-delete customer record
        break;
      }

      // ==================== Subscription Events ====================

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCreated(subscription);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription trial will end:', subscription.id);
        // Optionally send notification to user
        break;
      }

      // ==================== Invoice Events ====================

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      case 'invoice.finalized': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Invoice finalized:', invoice.id);
        break;
      }

      // ==================== Payment Intent Events ====================

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment intent succeeded:', paymentIntent.id);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment intent failed:', paymentIntent.id);
        break;
      }

      // ==================== Default ====================

      default:
        console.log('Unhandled event type:', event.type);
    }

    // Mark event as processed
    await markWebhookEventProcessed(event.id);

    res.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    processingError = error?.message || 'Unknown error';

    // Mark event as processed with error
    try {
      await markWebhookEventProcessed(event.id, processingError);
    } catch (logError) {
      console.error('Error marking event as failed:', logError);
    }

    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ==================== Event Handlers ====================

/**
 * Handle one-time payment completion
 */
async function handleOneTimePayment(session: Stripe.Checkout.Session) {
  if (session.payment_status !== 'paid') {
    console.log('Payment not completed yet:', session.id);
    return;
  }

  const customerId = session.customer as string;
  const userId = session.metadata?.userId;

  // Link customer to user if userId provided
  if (userId && customerId) {
    await findOrCreateStripeCustomer({
      userId,
      stripeCustomerId: customerId,
    });
  }

  // Get priceId and productId from metadata first (preferred), then from line items
  let priceId: string | undefined = session.metadata?.priceId;
  let productId: string | undefined = session.metadata?.productId;

  // If not in metadata, fetch from line items
  if (!priceId || !productId) {
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(
        session.id
      );
      if (lineItems.data && lineItems.data.length > 0) {
        const firstItem = lineItems.data[0];
        if (!priceId) {
          priceId = firstItem.price?.id;
        }
        if (!productId) {
          productId =
            typeof firstItem.price?.product === 'string'
              ? firstItem.price.product
              : firstItem.price?.product?.id;
        }
      }
    } catch (error) {
      console.error('Error fetching line items:', error);
    }
  }

  console.log('Creating order with:', {
    checkoutSessionId: session.id,
    customerId,
    priceId,
    productId,
    userId,
  });

  // Create order record
  await createStripeOrder({
    checkoutSessionId: session.id,
    paymentIntentId: session.payment_intent as string,
    customerId: customerId || session.customer_email || 'unknown',
    priceId,
    productId,
    amountSubtotal: session.amount_subtotal || 0,
    amountTotal: session.amount_total || 0,
    currency: session.currency || 'usd',
    paymentStatus: session.payment_status,
    status: 'completed',
    metadata: JSON.stringify(session.metadata || {}),
  });

  console.log('One-time payment processed successfully:', session.id);
}

/**
 * Handle subscription checkout completion
 */
async function handleSubscriptionCheckout(session: Stripe.Checkout.Session) {
  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;
  const userId = session.metadata?.userId;

  // Link customer to user if userId provided
  if (userId && customerId) {
    await findOrCreateStripeCustomer({
      userId,
      stripeCustomerId: customerId,
    });
  }

  // Fetch full subscription details
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await handleSubscriptionCreated(subscription);
  }

  console.log('Subscription checkout processed:', session.id);
}

/**
 * Handle subscription created
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('Processing subscription created:', subscription.id);

  const defaultPaymentMethod = subscription.default_payment_method;
  let paymentMethodBrand: string | undefined;
  let paymentMethodLast4: string | undefined;

  if (defaultPaymentMethod && typeof defaultPaymentMethod === 'object') {
    const pm = defaultPaymentMethod as Stripe.PaymentMethod;
    paymentMethodBrand = pm.card?.brand;
    paymentMethodLast4 = pm.card?.last4;
  }

  await upsertStripeSubscription({
    customerId: subscription.customer as string,
    subscriptionId: subscription.id,
    priceId: subscription.items.data[0]?.price?.id,
    productId: subscription.items.data[0]?.price?.product as string,
    currentPeriodStart: (subscription as any).current_period_start,
    currentPeriodEnd: (subscription as any).current_period_end,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: (subscription as any).canceled_at || undefined,
    trialStart: (subscription as any).trial_start || undefined,
    trialEnd: (subscription as any).trial_end || undefined,
    paymentMethodBrand,
    paymentMethodLast4,
    status: subscription.status as any,
  });

  console.log('Subscription created in database:', subscription.id);
}

/**
 * Handle subscription updated
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('Processing subscription updated:', subscription.id);

  const defaultPaymentMethod = subscription.default_payment_method;
  let paymentMethodBrand: string | undefined;
  let paymentMethodLast4: string | undefined;

  if (defaultPaymentMethod && typeof defaultPaymentMethod === 'object') {
    const pm = defaultPaymentMethod as Stripe.PaymentMethod;
    paymentMethodBrand = pm.card?.brand;
    paymentMethodLast4 = pm.card?.last4;
  }

  await upsertStripeSubscription({
    customerId: subscription.customer as string,
    subscriptionId: subscription.id,
    priceId: subscription.items.data[0]?.price?.id,
    productId: subscription.items.data[0]?.price?.product as string,
    currentPeriodStart: (subscription as any).current_period_start,
    currentPeriodEnd: (subscription as any).current_period_end,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: (subscription as any).canceled_at || undefined,
    trialStart: (subscription as any).trial_start || undefined,
    trialEnd: (subscription as any).trial_end || undefined,
    paymentMethodBrand,
    paymentMethodLast4,
    status: subscription.status as any,
  });

  console.log('Subscription updated in database:', subscription.id);
}

/**
 * Handle subscription deleted
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('Processing subscription deleted:', subscription.id);

  await upsertStripeSubscription({
    customerId: subscription.customer as string,
    subscriptionId: subscription.id,
    status: 'canceled',
    canceledAt: Math.floor(Date.now() / 1000),
  });

  console.log('Subscription marked as canceled:', subscription.id);
}

/**
 * Handle invoice payment succeeded
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('Processing invoice payment succeeded:', invoice.id);

  const subscriptionId = (invoice as any).subscription as string | undefined;

  if (subscriptionId) {
    // This is a subscription payment
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await handleSubscriptionUpdated(subscription);

    console.log('Subscription payment processed:', subscriptionId);
  } else {
    // This might be a one-time invoice
    console.log('One-time invoice paid:', invoice.id);
  }
}

/**
 * Handle invoice payment failed
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Processing invoice payment failed:', invoice.id);

  const subscriptionId = (invoice as any).subscription as string | undefined;

  if (subscriptionId) {
    // Update subscription status
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await handleSubscriptionUpdated(subscription);

    console.log('Subscription payment failed, status updated:', subscriptionId);
    // Optionally send notification to user
  }
}

export default router;
