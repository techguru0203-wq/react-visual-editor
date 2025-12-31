import { SubscriptionCancelData } from './../types/subscriptionTypes';
import { Prisma, SubscriptionStatus, SubscriptionTier } from '@prisma/client';
import prisma from '../db/prisma';
import { sendEmail } from './emailService';
import {
  CreditPurchasePaymentData,
  InvoicePaymentData,
} from '../types/subscriptionTypes';
import dayjs from 'dayjs';
import { getCreditAmount, getCreditsForSubscription } from '../lib/util';
import {
  CREDITS_ACTIONS,
  PAYMENT_TYPES,
  SubscriptionTierIndex,
} from '../lib/constant';
import {
  accountCancellation,
  creditsRefill,
  errorTemplate,
  referralCommissionEarned,
} from '../lib/emailTemplate';
import { calculateCommissionFromSubscription } from './commissionService';

export async function handleInvoicePaymentSuccess(data: InvoicePaymentData) {
  let user;
  let userError;
  try {
    user = await prisma.user.findUnique({
      where: { email: data.customerEmail },
      include: { organization: true },
    });
  } catch (error) {
    userError = error;
  }
  if (!user || userError) {
    console.error(
      'in services.subscriptionService.handleInvoicePaymentSuccess: user not found for email:',
      data.customerEmail
    );
    await sendEmail({
      email: 'general@omniflow.team',
      subject: 'P0 - User not found for email after invoice.paid',
      body: errorTemplate(JSON.stringify(userError)),
    });
    return;
  }

  const { evtId, customerEmail, status } = data;
  const txn = await prisma.payment.findFirst({
    where: { eventId: evtId, status },
  });
  if (txn) {
    console.log(
      `Invoice.paid event already processed: ${evtId} for ${customerEmail}`
    );
    return;
  }

  let paymentTxn;
  try {
    // const currentPlanLevel = Object.values(SubscriptionTier).indexOf(
    //   data.productInfo.tier as SubscriptionTier
    // );
    // const oldPlanLevel = Object.values(SubscriptionTier).indexOf(
    //   user.subscriptionTier as any
    // );
    // const isUpgrade = currentPlanLevel > oldPlanLevel;

    const isUpgrade =
      SubscriptionTierIndex[data.productInfo.tier.toUpperCase()] >
      SubscriptionTierIndex[user.subscriptionTier.toUpperCase()];

    paymentTxn = await prisma.payment.create({
      data: {
        payerUserId: user.id,
        email: data.customerEmail,
        subscriptionTier: data.productInfo.tier as SubscriptionTier,
        organizationId: user.organizationId,
        seats: data.productInfo.seats,
        amount: data.amountPaid,
        currency: data.currency,
        invoiceId: data.invoiceId,
        invoiceUrl: data.invoiceUrl,
        status: data.status,
        type: PAYMENT_TYPES.SUBSCRIPTION_START,
        eventId: data.evtId,
        meta: {
          interval: data.productInfo.interval,
          amountDue: data.amountDue,
          startAt: data.productInfo.period.start,
          endAt: data.productInfo.period.end,
          stripeCustomerId: data.stripeCustomerId,
          subscriptionId: data.subscriptionId,
          discount: data.discount,
        },
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        subscriptionTier: data.productInfo.tier as SubscriptionTier,
      },
    });

    let credits = isUpgrade
      ? getCreditsForSubscription(
          data.productInfo.tier,
          data.productInfo.interval
        )
      : 0; // If just adding seats, don't add credits
    await prisma.organization.update({
      where: { id: user.organizationId },
      data: {
        subscriptionTier: data.productInfo.tier as SubscriptionTier,
        subscriptionStatus: data.amountPaid
          ? SubscriptionStatus.ACTIVE
          : SubscriptionStatus.TRIAL,
        subscriptionInterval: data.productInfo.interval,
        subscriptionStart: new Date(data.productInfo.period.start * 1000),
        subscriptionEnd: new Date(data.productInfo.period.end * 1000),
        totalSeats: { increment: data.productInfo.seats },
        availableSeats: { increment: data.productInfo.seats },
        stripeCustomerId: data.stripeCustomerId,
        credits: { increment: credits },
        meta: {
          ...(user.organization.meta as Prisma.JsonObject),
          subscriptionId: data.subscriptionId,
          lastPayment: {
            amount: data.amountPaid,
            currency: data.currency,
            invoiceUrl: data.invoiceUrl,
            status: data.status,
            evtId: data.evtId,
            userId: user.id,
          },
        },
      },
    });

    // Only create credit action if tier changed (not just adding seats)
    if (isUpgrade) {
      await prisma.creditAction.create({
        data: {
          userId: user.id,
          organizationId: user.organizationId,
          action: CREDITS_ACTIONS.SUBSCRIPTION_ADD,
          amount: credits,
          status: 'success',
          meta: {
            evtId: data.evtId,
            paymentId: paymentTxn.id,
            amount: data.amountPaid,
          },
        },
      });
    }

    const emailSubject = isUpgrade
      ? 'Account Upgrade Successful'
      : 'Account Downgrade Successful';

    // TODO - disable account upgrade/downgrade email for now
    // await sendEmail({
    //   email: user.email,
    //   subject: emailSubject,
    //   body: accountUpgradeDowngrade(
    //     `${user.firstname.trim() ? user.firstname : user.username}`,
    //     data.productInfo.tier as SubscriptionTier,
    //     isUpgrade
    //   ),
    // });

    // Process referral commission if user was referred
    if (data.amountPaid > 0) {
      try {
        // Find if this user was referred by someone
        const referral = await prisma.referral.findFirst({
          where: {
            refereeUserId: user.id,
          },
          include: {
            referrer: {
              select: {
                email: true,
                firstname: true,
                lastname: true,
              },
            },
          },
        });
        if (referral) {
          try {
            // Use the new function that properly tracks individual subscription payments
            const commission = await calculateCommissionFromSubscription(
              user.id, // refereeUserId
              data.amountPaid, // subscriptionAmount (in cents)
              paymentTxn.id, // subscriptionPaymentId (payment id)
              data.currency || 'USD', // currency
              'subscription', // paymentType
              data.productInfo.interval // subscriptionInterval
            );

            if (commission && commission.success) {
              console.log(
                `Referral commission created: ${commission.commissionId} for subscription by ${user.email}`
              );
              // send email to referrer using the template referralCommissionEarned
              await sendEmail({
                email: referral.referrer.email,
                subject: 'Referral Commission Earned',
                body: referralCommissionEarned(
                  `${referral.referrer.firstname} ${referral.referrer.lastname}`.trim() ||
                    referral.referrer.email,
                  user.email,
                  commission.commissionAmount || 0,
                  data.amountPaid
                ),
              });
            } else {
              console.log(
                `No commission created for ${user.email} - may already exist or no referral found`
              );
            }
          } catch (commissionError) {
            console.error(
              'Error processing referral commission:',
              commissionError
            );
            // Don't fail the main subscription process if commission fails
          }
        }
      } catch (commissionError) {
        console.error('Error processing referral commission:', commissionError);
        // Don't fail the main subscription process if commission fails
      }
    }
  } catch (error) {
    console.error('Error in handleInvoicePaymentSuccess:', error);
    await sendEmail({
      email: 'general@omniflow.team',
      subject: `P0: Error in handleInvoicePaymentSuccess: ${error}`,
      body: errorTemplate(JSON.stringify(data)),
    });
  }
}

export async function handleCreditPurchasePaymentSuccess(
  data: CreditPurchasePaymentData
) {
  const { id, customerEmail, amount, currency, receiptUrl, status } = data;
  // TODO - move evtId to a separate field and add index for it
  // first check if the event is already processed
  const txn = await prisma.payment.findFirst({
    where: { eventId: id, status },
  });
  if (txn) {
    console.log(
      `Credit purchase payment event already processed: ${id} for ${customerEmail}`
    );
    return;
  }
  let user;
  let userError;
  try {
    user = await prisma.user.findUnique({
      where: { email: customerEmail },
      include: { organization: true },
    });
  } catch (error) {
    userError = error;
  }
  if (!user || userError) {
    console.error(
      'in services.subscriptionService.handleCreditPurchasePaymentSuccess: user not found for email:',
      customerEmail
    );
    await sendEmail({
      email: customerEmail,
      subject: 'P0 - User not found for email after credit purchase',
      body: errorTemplate(JSON.stringify(userError)),
    });
    return;
  }

  let paymentTxn;
  try {
    // First: insert payment info into Payment table
    paymentTxn = await prisma.payment.create({
      data: {
        payerUserId: user.id,
        email: customerEmail,
        subscriptionTier: user.subscriptionTier as SubscriptionTier,
        organizationId: user.organizationId,
        amount,
        currency,
        invoiceId: '',
        invoiceUrl: receiptUrl,
        status,
        type: PAYMENT_TYPES.CREDIT_PURCHASE,
        eventId: id,
      },
    });
    console.log(
      'in handleCreditPurchasePaymentSuccess: payment create success'
    );
    // second: add credits to the organization
    let credits = getCreditAmount(amount);
    await prisma.organization.update({
      where: { id: user.organizationId },
      data: {
        credits: { increment: credits },
        meta: {
          ...(user.organization.meta as Prisma.JsonObject),
          lastPayment: {
            amount,
            currency,
            invoiceUrl: receiptUrl,
            status,
            evtId: id,
            userId: user.id,
          },
        },
      },
    });
    console.log(
      'in handleCreditPurchasePaymentSuccess: org credit update success'
    );
    // third: insert credit history
    await prisma.creditAction.create({
      data: {
        userId: user.id,
        organizationId: user.organizationId,
        action: CREDITS_ACTIONS.CREDIT_PURCHASE,
        amount: credits || 0,
        status: 'success',
        meta: {
          evtId: id,
          amount,
        },
      },
    });
    console.log(
      'in handleCreditPurchasePaymentSuccess: creditAction update success'
    );
    await sendEmail({
      email: user.email,
      subject: 'Congrats! Your Omniflow credits have been refilled.',
      body: creditsRefill(
        `${user.firstname.trim() ? user.firstname : user.username}`
      ),
    });
    console.log('in handleCreditPurchasePaymentSuccess: email send success');
  } catch (error) {
    console.error('Error in handleCreditPurchasePaymentSuccess:', error);
    await sendEmail({
      email: 'general@omniflow.team',
      subject: `P0: Error in handleCreditPurchasePaymentSuccess: ${error}`,
      body: errorTemplate(JSON.stringify(data)),
    });
  }
}

export async function handleSubscriptionCanceling(
  data: SubscriptionCancelData
) {
  const { stripeCustomerId, canceledDate, eventId, currentUser } = data;
  let user;
  let org;
  let orgError;
  try {
    user = await prisma.user.findUnique({
      where: { id: currentUser.email },
    });
    org = await prisma.organization.findUnique({
      where: { stripeCustomerId },
    });
  } catch (error) {
    orgError = error;
  }
  if (!org || orgError) {
    console.error(
      'in services.subscriptionService.handleSubscriptionCanceling: org not found for stripeCustomerId:',
      stripeCustomerId
    );
    await sendEmail({
      email: 'general@omniflow.team',
      subject: 'P0 - Org not found for email after subscription canceled',
      body: errorTemplate(JSON.stringify(orgError)),
    });
    return;
  }

  try {
    let isSubscriptionOverDue = dayjs(canceledDate * 1000).isAfter(
      org.subscriptionEnd
    );
    // First: update organization subscription info
    let orgMeta = org.meta as Prisma.JsonObject;
    await prisma.organization.update({
      where: { id: org.id },
      data: {
        subscriptionStatus: isSubscriptionOverDue
          ? SubscriptionStatus.CANCELED
          : SubscriptionStatus.CANCELED_YET_ACTIVE,
        subscriptionTier: SubscriptionTier.FREE,
        meta: {
          ...orgMeta,
          canceledDate,
          canceledEventId: eventId,
        },
      },
    });
    // second: disable all users in the organization
    await prisma.user.updateMany({
      where: { organizationId: org.id },
      data: {
        subscriptionStatus: isSubscriptionOverDue
          ? SubscriptionStatus.CANCELED
          : SubscriptionStatus.CANCELED_YET_ACTIVE,
        subscriptionTier: SubscriptionTier.FREE,
      },
    });

    if (user) {
      await sendEmail({
        email: user.email,
        subject: 'Your subscription has been cancelled',
        body: accountCancellation(
          `${user.firstname.trim() ? user.firstname : user.username}`,
          new Date().toDateString()
        ),
      });
    }
  } catch (error) {
    console.error(
      'in services.subscriptionService.handleSubscriptionCanceling.error:',
      stripeCustomerId,
      error
    );

    await sendEmail({
      email: 'general@omniflow.team',
      subject: 'P0 - Org handleSubscriptionCanceling failure',
      body: errorTemplate(JSON.stringify(error)),
    });
  }
}
