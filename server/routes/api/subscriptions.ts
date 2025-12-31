import { Request } from 'express';
import { ProfileResponse } from '../../types/response';
import { userProfileRequestHandler } from '../../lib/util';
import { UserProfile } from '../types/userTypes';
import Stripe from 'stripe';
import prisma from '../../db/prisma';
import { Prisma, SubscriptionTier } from '@prisma/client';
import { accountCancellation } from '../../lib/emailTemplate';
import { sendEmail } from '../../services/emailService';
import { CLIENT_BASE_URL } from '../../../shared/constants';

const router = require('express').Router();
router.use(userProfileRequestHandler);

// Initialize the Stripe client with your secret key
const stripe = new Stripe(process.env.STRIPE_KEY as string, {
  apiVersion: '2025-09-30.clover' as any, // Ensure to use the latest API version
});

router.post(
  '/cancel',
  async function (req: Request, res: ProfileResponse<Partial<UserProfile>>) {
    const currentUser = res.locals.currentUser;
    console.log(
      'in server.routes.api.subscriptions.cancel.start:',
      currentUser?.organizationId
    );

    let result;
    try {
      // first: find org
      let org = await prisma.organization.findUnique({
        where: { id: currentUser.organizationId },
      });
      if (!org) {
        throw new Error(
          `Organization not found for user ${currentUser.userId}, org ${currentUser.organizationId}`
        );
      }
      let orgMeta = org.meta as Prisma.JsonObject;
      if (!orgMeta?.subscriptionId) {
        throw new Error(`Subscription not found for org ${org.id}`);
      }
      // Cancel the subscription
      const canceledSubscription = await stripe.subscriptions.cancel(
        orgMeta.subscriptionId as string
      );

      // Log the result
      console.log(
        'in server.routes.api.subscriptions.cancel.success:',
        `user ${currentUser.userId}, org ${org.id} canceled successfully.`
      );

      await sendEmail({
        email: currentUser.email,
        subject: 'Your subscription has been cancelled',
        body: accountCancellation(
          currentUser.firstname?.trim()
            ? currentUser.firstname
            : currentUser.userName,
          new Date().toDateString()
        ),
      });
      res.status(201).json({ success: true, data: currentUser });
    } catch (err) {
      console.error('in server.api.subscriptions.cancel.failure:', err);
      res.status(500).json({
        success: false,
        errorMsg: JSON.stringify(err),
      });
    }
  }
);

type Tier = keyof typeof STRIPE_PRICE_IDS;
type BillingCycle = 'MONTHLY' | 'YEARLY';

// Seat limits for each tier
const TIER_SEAT_LIMITS: Record<SubscriptionTier, number> = {
  [SubscriptionTier.FREE]: 1,
  [SubscriptionTier.STARTER]: 1,
  [SubscriptionTier.PRO]: 20,
  [SubscriptionTier.BUSINESS]: 100,
  [SubscriptionTier.ENTERPRISE]: 1000000,
};

// Price ID map for each tier & billing cycle
const STRIPE_PRICE_IDS = {
  // FREE: {
  //   MONTHLY: process.env.STRIPE_FREE_MONTHLY_PRICE_ID, // create a price on Stripe and copy the price id
  //   YEARLY: process.env.STRIPE_FREE_MONTHLY_PRICE_ID,
  // },
  STARTER: {
    // Performance
    MONTHLY: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID,
    YEARLY: process.env.STRIPE_STARTER_YEARLY_PRICE_ID,
  },
  PRO: {
    // Teams
    MONTHLY: process.env.STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID,
    YEARLY: process.env.STRIPE_PROFESSIONAL_YEARLY_PRICE_ID,
  },
  BUSINESS: {
    MONTHLY: process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID,
    YEARLY: process.env.STRIPE_BUSINESS_YEARLY_PRICE_ID,
  },
};

router.post(
  '/create-checkout-session',
  async function (req: Request, res: ProfileResponse<string>) {
    const { planKey, term, email, seats = 1 } = req.body;
    const tier = planKey?.toUpperCase() as Tier;
    const billingCycle = term?.toUpperCase() as BillingCycle;
    const priceId = STRIPE_PRICE_IDS[tier][billingCycle];
    
    // Get maximum seats from constant based on tier
    const maxSeats = TIER_SEAT_LIMITS[tier as SubscriptionTier] || 1;
    
    console.log('priceId:', priceId, 'seats:', seats, 'maxSeats:', maxSeats);

    try {
      // Build line item configuration based on whether seats are adjustable
      const lineItem: any = {
        price: priceId,
        quantity: seats,
      };
      
      // Only add adjustable_quantity if enabled (for multi-seat plans)
      if (maxSeats > 1) {
        lineItem.adjustable_quantity = {
          enabled: true,
          minimum: 1,
          maximum: maxSeats,
        };
      }
      
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [lineItem],
        success_url: `${CLIENT_BASE_URL}/billing`,
        cancel_url: `${CLIENT_BASE_URL}/billing`,
        // customer_email: email,
        subscription_data: {
          metadata: {
            tier,
            billingCycle,
            accountEmail: email,
            seats: seats.toString(),
          },
        },
      });

      res.status(200).json({ success: true, data: session.url || '' });
    } catch (err: any) {
      console.error('Error creating Stripe session:', err);
      res.status(500).json({
        success: false,
        errorMsg: 'Internal server error',
      });
    }
  }
);

const STRIPE_CREDIT_PRICE_IDS = [
  process.env.STRIPE_OMNIFLOW_CREDITS_10K, // 10k credits
  process.env.STRIPE_OMNIFLOW_CREDITS_40K, // 40k
  process.env.STRIPE_OMNIFLOW_CREDITS_100K, // 100k
];

router.post(
  '/create-credit-session',
  async function (req: Request, res: ProfileResponse<string>) {
    const { creditIndex, email } = req.body;
    const priceId = STRIPE_CREDIT_PRICE_IDS[creditIndex];

    if (!priceId) {
      return res.status(400).json({
        success: false,
        errorMsg: 'Invalid credit index',
      });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${CLIENT_BASE_URL}/billing`,
        cancel_url: `${CLIENT_BASE_URL}/billing`,
        // customer_email: email,
        payment_intent_data: {
          metadata: {
            accountEmail: email,
          },
        },
      });

      res.json({
        success: true,
        data: session.url || '',
      });
    } catch (err: any) {
      console.error('Error creating Stripe credit session:', err);
      res.status(500).json({
        success: false,
        errorMsg: 'Internal server error',
      });
    }
  }
);

module.exports = {
  className: 'subscriptions',
  routes: router,
};
