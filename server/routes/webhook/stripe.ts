import Stripe from 'stripe';
import { Router } from 'express';
import express from 'express';

import { StandardResponse } from '../../types/response';
import {
  handleCreditPurchasePaymentSuccess,
  handleInvoicePaymentSuccess,
  handleSubscriptionCanceling,
} from '../../services/subscriptionService';
import {
  CreditPurchasePaymentData,
  InvoicePaymentData,
  SubscriptionCancelData,
  SubscriptionProductItem,
} from '../../types/subscriptionTypes';
import mixpanel from '../../services/trackingService';
import { getTierFromPrice } from '../../lib/util';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_KEY as string);

router.post(
  '/',
  express.raw({ type: 'application/json' }),
  async function (request, response: StandardResponse<string>) {
    const sig = request.headers['stripe-signature'];
    console.log('in services.routes.webhook:', sig, request.body);

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        request.body,
        sig as string,
        process.env.STRIPE_ENDPOINT_SECRET as string
      );
    } catch (err: any) {
      console.error("Error in webhook's stripe event:", err);
      response.status(400).json({
        success: false,
        errorMsg: `Webhook Error: ${err as string | Error}.toString()`,
      });
      return;
    }

    let subscription;
    // Handle the event
    switch (event.type) {
      // handle subscription payment success
      case 'invoice.paid': {
        const invoice = event.data.object;
        const accountEmail =
          invoice.subscription_details?.metadata?.accountEmail ||
          invoice.customer_email;
        const tier =
          invoice.subscription_details?.metadata?.tier ||
          getTierFromPrice(invoice.lines.data[0].description as string);
        // Get the actual quantity from the invoice line item
        const quantity = invoice.lines.data[0].quantity || 1;
        
        const invoicePaymentData = {
          evtId: event.id,
          invoiceId: invoice.id,
          amountPaid: invoice.amount_paid,
          amountDue: invoice.amount_due,
          currency: invoice.currency,
          customerEmail: accountEmail,
          customerName: invoice.customer_name,
          stripeCustomerId: invoice.customer as string,
          invoiceUrl: invoice.invoice_pdf,
          subscriptionId: invoice.lines.data[0].subscription as string,
          discount: {
            id: invoice.discount?.id as string,
            name: invoice.discount?.coupon?.name as string,
            percent_off: invoice.discount?.coupon?.percent_off as number,
          },
          productInfo: {
            amount: invoice.amount_paid,
            amountExcludingTax: invoice.amount_paid,
            tier: tier,
            description: invoice.lines.data[0].description,
            interval: invoice.lines.data[0].plan?.interval,
            period: {
              end: invoice.lines.data[0].period.end,
              start: invoice.lines.data[0].period.start,
            },
            seats: quantity, // Use actual quantity from Stripe
          } as SubscriptionProductItem,
          status: invoice.status,
        } as InvoicePaymentData;
        handleInvoicePaymentSuccess(invoicePaymentData);
        // track event
        mixpanel.track('Plan Purchased', {
          distinct_id: accountEmail,
          planType: tier,
        });
        break;
      }
      case 'charge.updated':
        console.log(`strip charge.updated for ${JSON.stringify(event)}.`);
        const {
          id,
          object,
          paid,
          currency,
          refunded,
          status,
          billing_details,
          amount,
          receipt_url,
        } = event.data.object;

        const charge = event.data.object;
        const paymentIntent = charge.payment_intent;

        // Retrieve the payment_intent to get metadata
        const paymentIntentObj = await stripe.paymentIntents.retrieve(
          paymentIntent as string
        );
        const accountEmail =
          paymentIntentObj.metadata?.accountEmail || billing_details.email;

        if (
          object === 'charge' &&
          paid &&
          !refunded &&
          status === 'succeeded'
        ) {
          console.log(
            `strip charge.updated for ${JSON.stringify(billing_details)}.`
          );
          subscription = event.data.object;
          let paymentData = {
            id,
            amount,
            currency,
            paymentMethod: 'card',
            customerEmail: accountEmail,
            customerName: billing_details.name,
            receiptUrl: receipt_url,
            status: status,
          } as CreditPurchasePaymentData;
          handleCreditPurchasePaymentSuccess(paymentData);
          // track event
          mixpanel.track('Credit Purchased', {
            distinct_id: accountEmail,
            amount: amount,
          });
        }
        break;
      case 'customer.subscription.deleted':
        subscription = event.data.object;
        console.log(
          `strip invoice.upcoming for ${JSON.stringify(subscription)}.`
        );

        const customer = await stripe.customers.retrieve(
          subscription.customer as string
        );

        const subscriptionCancelData: SubscriptionCancelData = {
          stripeCustomerId: subscription.customer as string,
          canceledDate: subscription.canceled_at as number,
          currentUser: customer,
          eventId: event.id,
        };
        handleSubscriptionCanceling(subscriptionCancelData);
        break;
      default:
        // Unexpected event type
        console.log(
          `strip unhandled event type ${event.type}: ${JSON.stringify(
            event.data.object
          )}`
        );
        break;
    }

    // Return a 200 response to acknowledge receipt of the event
    response.status(200).json({
      success: true,
      data: `Webhook received and processed: ${event.id}`,
    });
  }
);

export const className = 'stripe';
export const routes = router;
