import express from 'express';
import { z, ZodError } from 'zod';
import { authenticateJWT, AuthRequest } from '../middleware/auth';
import {
  createCheckoutSession,
  createSubscriptionSession,
  getSubscriptionsByUserId,
  getOrdersByUserId,
  cancelSubscription,
  getStripeCustomerByUserId,
} from '../services/stripeService';
import { getFrontendUrl } from '../config/utils';
import { getProductByPriceId } from '../../shared/config/stripe-product';

const router = express.Router();

// ==================== Validation Schemas ====================

const CreateCheckoutSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().positive().default(1),
});

const CreateSubscriptionSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  interval: z.enum(['week', 'month', 'year']),
  intervalCount: z.number().int().positive().max(52).optional(), // default 1
  trialDays: z.number().int().min(0).max(90).optional(),
});

const CancelSubscriptionSchema = z.object({
  subscriptionId: z.string().min(1, 'Subscription ID is required'),
});

// ==================== Helper Functions ====================

function validationError(res: express.Response, err: ZodError) {
  return res.status(400).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Validation error',
      details: err.issues.map((i) => ({
        code: i.code,
        path: i.path,
        message: i.message,
      })),
    },
  });
}

function errorResponse(
  res: express.Response,
  statusCode: number,
  code: string,
  message: string
) {
  return res.status(statusCode).json({
    success: false,
    error: { code, message },
  });
}

// ==================== Payment Routes ====================

/**
 * POST /api/stripe/create-checkout-session
 * Create a one-time payment checkout session
 */
router.post(
  '/create-checkout-session',
  authenticateJWT,
  async (req: AuthRequest, res) => {
    const parsed = CreateCheckoutSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);

    const { productId, quantity } = parsed.data;
    const userId = req.user?.id;
    const userEmail = req.user?.email;

    if (!userEmail) {
      return errorResponse(res, 401, 'NO_EMAIL', 'User email is required');
    }

    const product = getProductByPriceId(productId);
    if (!product) {
      return errorResponse(res, 404, 'PRODUCT_NOT_FOUND', 'Product not found');
    }

    const frontendUrl = getFrontendUrl(req);
    const successUrl = `${frontendUrl}/#/payment/success`;
    const cancelUrl = `${frontendUrl}/#/payment/cancel`;

    try {
      const result = await createCheckoutSession({
        productName: product.name,
        unitAmount: product.price, // USD
        customerEmail: userEmail,
        quantity,
        successUrl,
        cancelUrl,
        userId, // Pass userId for tracking
        priceId: productId, // Pass priceId for tracking
        productId: product.productId, // Pass productId for tracking
      });

      return res.json({
        success: true,
        data: {
          sessionId: result.sessionId,
          url: result.url,
        },
      });
    } catch (error: any) {
      console.error('create-checkout-session error:', error);
      return errorResponse(
        res,
        500,
        'STRIPE_ERROR',
        error?.message || 'Failed to create checkout session'
      );
    }
  }
);

/**
 * POST /api/stripe/create-subscription-session
 * Create a subscription checkout session
 */
router.post(
  '/create-subscription-session',
  authenticateJWT,
  async (req: AuthRequest, res) => {
    const parsed = CreateSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);

    const { productId, interval, intervalCount = 1, trialDays } = parsed.data;
    const userId = req.user?.id;
    const userEmail = req.user?.email;

    if (!userEmail) {
      return errorResponse(res, 401, 'NO_EMAIL', 'User email is required');
    }

    const product = getProductByPriceId(productId);
    if (!product) {
      return errorResponse(res, 404, 'PRODUCT_NOT_FOUND', 'Product not found');
    }

    const frontendUrl = getFrontendUrl(req);
    const successUrl = `${frontendUrl}/#/payment/success`;
    const cancelUrl = `${frontendUrl}/#/payment/cancel`;

    try {
      const result = await createSubscriptionSession({
        productName: product.name,
        unitAmount: product.price, // USD
        customerEmail: userEmail,
        interval,
        intervalCount,
        trialDays,
        successUrl,
        cancelUrl,
        userId, // Pass userId for tracking
        priceId: productId, // Pass priceId for tracking
        productId: product.productId, // Pass productId for tracking
      });

      return res.json({
        success: true,
        data: {
          sessionId: result.sessionId,
          url: result.url,
        },
      });
    } catch (error: any) {
      console.error('create-subscription-session error:', error);
      return errorResponse(
        res,
        500,
        'STRIPE_ERROR',
        error?.message || 'Failed to create subscription session'
      );
    }
  }
);

// ==================== Query Routes ====================

/**
 * GET /api/stripe/subscriptions
 * Get all subscriptions for the current user
 */
router.get('/subscriptions', authenticateJWT, async (req: AuthRequest, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return errorResponse(res, 401, 'UNAUTHORIZED', 'User ID is required');
  }

  try {
    const subscriptions = await getSubscriptionsByUserId(userId);
    return res.json({
      success: true,
      data: {
        subscriptions,
        total: subscriptions.length,
      },
    });
  } catch (error: any) {
    console.error('get-subscriptions error:', error);
    return errorResponse(
      res,
      500,
      'DATABASE_ERROR',
      error?.message || 'Failed to fetch subscriptions'
    );
  }
});

/**
 * GET /api/stripe/orders
 * Get all orders for the current user
 */
router.get('/orders', authenticateJWT, async (req: AuthRequest, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return errorResponse(res, 401, 'UNAUTHORIZED', 'User ID is required');
  }

  try {
    const orders = await getOrdersByUserId(userId);
    return res.json({
      success: true,
      data: {
        orders,
        total: orders.length,
      },
    });
  } catch (error: any) {
    console.error('get-orders error:', error);
    return errorResponse(
      res,
      500,
      'DATABASE_ERROR',
      error?.message || 'Failed to fetch orders'
    );
  }
});

/**
 * GET /api/stripe/customer
 * Get Stripe customer information for the current user
 */
router.get('/customer', authenticateJWT, async (req: AuthRequest, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return errorResponse(res, 401, 'UNAUTHORIZED', 'User ID is required');
  }

  try {
    const customer = await getStripeCustomerByUserId(userId);

    if (!customer) {
      return errorResponse(
        res,
        404,
        'CUSTOMER_NOT_FOUND',
        'Stripe customer not found for this user'
      );
    }

    return res.json({
      success: true,
      data: { customer },
    });
  } catch (error: any) {
    console.error('get-customer error:', error);
    return errorResponse(
      res,
      500,
      'DATABASE_ERROR',
      error?.message || 'Failed to fetch customer information'
    );
  }
});

// ==================== Management Routes ====================

/**
 * POST /api/stripe/cancel-subscription
 * Cancel a subscription
 */
router.post(
  '/cancel-subscription',
  authenticateJWT,
  async (req: AuthRequest, res) => {
    const parsed = CancelSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error);

    const { subscriptionId } = parsed.data;
    const userId = req.user?.id;

    if (!userId) {
      return errorResponse(res, 401, 'UNAUTHORIZED', 'User ID is required');
    }

    try {
      // Verify that the subscription belongs to the user
      const subscriptions = await getSubscriptionsByUserId(userId);
      const subscription = subscriptions.find(
        (sub: any) => sub.subscriptionId === subscriptionId
      );

      if (!subscription) {
        return errorResponse(
          res,
          404,
          'SUBSCRIPTION_NOT_FOUND',
          'Subscription not found or does not belong to this user'
        );
      }

      const updated = await cancelSubscription(subscriptionId);

      return res.json({
        success: true,
        data: { subscription: updated },
        message: 'Subscription cancelled successfully',
      });
    } catch (error: any) {
      console.error('cancel-subscription error:', error);
      return errorResponse(
        res,
        500,
        'DATABASE_ERROR',
        error?.message || 'Failed to cancel subscription'
      );
    }
  }
);

export default router;
