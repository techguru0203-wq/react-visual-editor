/**
 * This's file is used for install module
 */
import stripeRouter from './routes/stripe';
import stripeWebhookRouter from './routes/webhook/stripe';

/**
 * Stripe Routes
 * Conditionally mounted based on STRIPE_SECRET_KEY availability
 */
if (process.env.STRIPE_SECRET_KEY) {
  app.use('/api/stripe/webhook', stripeWebhookRouter);
  app.use('/api/stripe', stripeRouter);
  console.log('Stripe routes mounted');
} else {
  console.warn('STRIPE_SECRET_KEY not set, Stripe routes not mounted');
}
