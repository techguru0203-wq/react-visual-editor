import { RecordStatus, PaymentStatus } from '@prisma/client';
import prisma from '../db/prisma';
import { CREDITS_ACTIONS, REFERRAL_REWARD_CREDITS } from '../lib/constant';
import { sendEmail } from './emailService';
import { referralRewardEarned } from '../lib/emailTemplate';
import dayjs from 'dayjs';

/**
 * Process a referral when a new user signs up
 */
export async function processReferral(
  referrerCode: string,
  newUserId: string,
  newUserEmail: string
): Promise<{ success: boolean; referralId?: string; error?: string }> {
  try {
    // Find the referrer by referral code
    const referrer = await prisma.user.findUnique({
      where: {
        referralCode: referrerCode,
        status: RecordStatus.ACTIVE,
      },
    });

    if (!referrer) {
      return { success: false, error: 'Invalid referral code' };
    }

    // Prevent self-referrals
    if (referrer.id === newUserId) {
      return { success: false, error: 'Users cannot refer themselves' };
    }

    // Check if this user was created recently (within the last 1 minutes)
    // This prevents existing users from gaming the referral system
    // The time window accounts for OAuth flow delays and provides a safety net
    const existingUser = await prisma.user.findUnique({
      where: { id: newUserId },
      select: { createdAt: true },
    });

    if (existingUser) {
      const userAge = Date.now() - existingUser.createdAt.getTime();
      const REFERRAL_WINDOW = 60 * 1000; // 1 minutes - generous window for OAuth flows

      if (userAge > REFERRAL_WINDOW) {
        console.log(
          `Referral rejected: User ${newUserId} was created ${Math.round(
            userAge / 1000 / 60
          )} minutes ago, exceeding ${
            REFERRAL_WINDOW / 1000 / 60
          } minute window`
        );
        return {
          success: false,
          error: 'Cannot create referral for existing users',
        };
      }

      console.log(
        `Referral allowed: User ${newUserId} was created ${Math.round(
          userAge / 1000
        )} seconds ago, within ${REFERRAL_WINDOW / 1000 / 60} minute window`
      );
    }

    // Check if this user was already referred
    const existingReferral = await prisma.referral.findUnique({
      where: { refereeUserId: newUserId },
    });

    if (existingReferral) {
      return { success: false, error: 'User already has a referral' };
    }

    // find the secondary referrer if exists
    const secondaryReferrer = await prisma.referral.findFirst({
      where: { refereeUserId: referrer.id, status: RecordStatus.ACTIVE },
    });

    // Create referral record, award credits, and record credit action in a single transaction
    const referral = await prisma.$transaction(async (tx) => {
      // Create the referral record
      const referralRecord = await tx.referral.create({
        data: {
          referrerUserId: referrer.id,
          refereeUserId: newUserId,
          secondaryReferrerUserId: secondaryReferrer?.referrerUserId,
          referralCode: referrerCode,
          referrerCreditRewardAmount: REFERRAL_REWARD_CREDITS,
          commissionPercentage: 15,
          status: RecordStatus.ACTIVE,
        },
      });

      // Update organization credits
      await tx.organization.update({
        where: { id: referrer.organizationId },
        data: {
          credits: { increment: REFERRAL_REWARD_CREDITS },
        },
      });

      // Record the credit action
      await tx.creditAction.create({
        data: {
          userId: referrer.id,
          organizationId: referrer.organizationId,
          action: CREDITS_ACTIONS.CREDIT_REFERRAL_REWARD,
          amount: REFERRAL_REWARD_CREDITS,
          status: 'success',
          meta: {
            referralId: referralRecord.id,
            referredUserEmail: newUserEmail,
            referralCode: referrerCode,
          },
        },
      });

      return referralRecord;
    });

    // Send email notification to referrer
    await sendEmail({
      email: referrer.email,
      subject: '🎉 You earned a referral reward!',
      body: referralRewardEarned(
        referrer.firstname || referrer.username,
        newUserEmail,
        REFERRAL_REWARD_CREDITS
      ),
    });

    return { success: true, referralId: referral.id };
  } catch (error) {
    console.error('Error processing referral:', error);
    return { success: false, error: 'Failed to process referral' };
  }
}

/**
 * Transform raw database results to referral data format
 */
function transformReferralData(results: any[]): any[] {
  return results.map((record) => ({
    id: record.id,
    referralId: record.referralId,
    referrer: {
      email: record.referrerEmail,
      firstname: record.referrerFirstname,
      lastname: record.referrerLastname,
    },
    referee: {
      email: record.refereeEmail,
      firstname: record.refereeFirstname,
      lastname: record.refereeLastname,
    },
    referralCreatedAt: record.referralCreatedAt,
    // Subscription data (can be null for users without payments)
    subscriptionId: record.subscriptionId || null,
    subscriptionDate: record.subscriptionDate || null,
    subscriptionTier: record.subscriptionTier || null,
    currency: record.currency || null,
    subscriptionAmount: record.subscriptionAmount || 0,
    commissionAmount: record.commissionAmount || 0,
    commissionStatus: record.commissionStatus || 'NO_PAYMENT',
    referralPaymentId: record.referralPaymentId || null,
  }));
}

/**
 * Group referrals by month and calculate statistics
 */
function groupReferralsByMonth(referrals: any[]): any[] {
  const monthlyGroups = new Map();

  for (const referralRecord of referrals) {
    // Use subscription date for grouping if available, otherwise use referral creation date
    const dateToUse =
      referralRecord.subscriptionDate || referralRecord.referralCreatedAt;
    const monthKey = dayjs(dateToUse.toISOString()).format('YYYY-MM');

    if (!monthlyGroups.has(monthKey)) {
      monthlyGroups.set(monthKey, {
        month: monthKey,
        referrals: [],
        totalReferrals: 0,
        totalSubscriptionAmount: 0,
        totalCommissionEarned: 0,
        pendingCommissions: 0,
        paidCommissions: 0,
        canceledCommissions: 0,
        totalReferralsWithPayments: 0,
      });
    }

    const monthGroup = monthlyGroups.get(monthKey);
    monthGroup.referrals.push(referralRecord);
    monthGroup.totalReferrals += 1;

    // Only add subscription amount if user has made payments
    if (referralRecord.subscriptionAmount > 0) {
      monthGroup.totalSubscriptionAmount += referralRecord.subscriptionAmount;
      monthGroup.totalReferralsWithPayments += 1;
    }

    // Only count commissions if user has payment records
    if (
      referralRecord.commissionStatus &&
      referralRecord.commissionStatus !== 'NO_PAYMENT'
    ) {
      // Only count PAID commissions in totalCommissionEarned, exclude CANCELED
      if (referralRecord.commissionStatus === PaymentStatus.PAID) {
        monthGroup.totalCommissionEarned += referralRecord.commissionAmount;
      }

      if (referralRecord.commissionStatus === PaymentStatus.PENDING) {
        monthGroup.pendingCommissions += 1;
      } else if (referralRecord.commissionStatus === PaymentStatus.PAID) {
        monthGroup.paidCommissions += 1;
      } else if (referralRecord.commissionStatus === PaymentStatus.CANCELED) {
        monthGroup.canceledCommissions += 1;
      }
    }
  }

  // Convert to array and sort by month (newest first)
  return Array.from(monthlyGroups.values()).sort((a, b) =>
    b.month.localeCompare(a.month)
  );
}

export async function getReferralStats(userId: string) {
  try {
    // Single database transaction to get all data efficiently
    const [referrals, referralPayments] = await prisma.$transaction([
      // Query 1: Get referrals with user data - only ACTIVE referrals
      prisma.referral.findMany({
        where: {
          referrerUserId: userId,
          status: 'ACTIVE', // Only get ACTIVE referrals
        },
        include: {
          referrer: {
            select: {
              email: true,
              firstname: true,
              lastname: true,
            },
          },
          referee: {
            select: {
              email: true,
              firstname: true,
              lastname: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),

      // Query 2: Get all referral payments for this referrer
      prisma.referralPayment.findMany({
        where: {
          referrerUserId: userId,
          meta: {
            path: ['paymentType'],
            equals: 'subscription',
          },
        },
      }),
    ]);

    // Transform to match expected format
    const transformedResults = referrals.flatMap((referral) => {
      // Find referral payments for this referee
      const refereePayments = referralPayments.filter(
        (rp) => (rp.meta as any)?.referredUserId === referral.refereeUserId
      );

      // If no referral payments, create one record with null values
      if (refereePayments.length === 0) {
        return [
          {
            id: `referral-${referral.id}`,
            referralId: referral.id,
            referrerEmail: referral.referrer.email,
            referrerFirstname: referral.referrer.firstname,
            referrerLastname: referral.referrer.lastname,
            refereeEmail: referral.referee.email,
            refereeFirstname: referral.referee.firstname,
            refereeLastname: referral.referee.lastname,
            referralCreatedAt: referral.createdAt,
            subscriptionId: null,
            subscriptionDate: null as any, // Leave empty for users who haven't subscribed
            subscriptionTier: null,
            currency: null,
            subscriptionAmount: null,
            commissionAmount: null,
            commissionStatus: null as any, // Leave empty for users who haven't subscribed
            referralPaymentId: null,
          },
        ];
      }

      // If there are referral payments, create a record for each payment
      return refereePayments.map((rp) => {
        const meta = rp.meta as any;
        return {
          id: `referral-${referral.id}-${rp.id}`,
          referralId: referral.id,
          referrerEmail: referral.referrer.email,
          referrerFirstname: referral.referrer.firstname,
          referrerLastname: referral.referrer.lastname,
          refereeEmail: referral.referee.email,
          refereeFirstname: referral.referee.firstname,
          refereeLastname: referral.referee.lastname,
          referralCreatedAt: referral.createdAt,
          subscriptionId: meta?.subscriptionPaymentId || null,
          subscriptionDate: rp.createdAt || null,
          subscriptionTier: meta?.subscriptionTier || null,
          currency: meta?.originalCurrency || null,
          subscriptionAmount: meta?.originalAmount || null,
          commissionAmount: rp.amount || null,
          commissionStatus: rp.status || null,
          referralPaymentId: rp.id || null,
        };
      });
    });

    if (transformedResults.length === 0) {
      return {
        totalReferrals: 0,
        referrals: [],
        monthlyData: [],
        totalCommissionEarned: 0,
      };
    }

    // Transform and group the data
    const paymentRecords = transformReferralData(transformedResults);
    const monthlyData = groupReferralsByMonth(paymentRecords);

    // Get total commission earned from ReferralPayment table
    const totalCommission = await prisma.referralPayment.aggregate({
      where: {
        referrerUserId: userId,
        status: PaymentStatus.PAID,
      },
      _sum: { amount: true },
    });

    return {
      totalReferrals: paymentRecords.length,
      referrals: paymentRecords,
      monthlyData: monthlyData,
      totalCommissionEarned: totalCommission._sum.amount || 0,
    };
  } catch (error) {
    console.error('Error getting referral stats:', error);
    throw error;
  }
}

/**
 * Get ALL referral statistics for admin view
 */
export async function getAllReferralStats() {
  try {
    // Single database transaction to get all data efficiently
    const [referrals, referralPayments] = await prisma.$transaction([
      // Query 1: Get ALL referrals with user data (no userId filter for admin)
      prisma.referral.findMany({
        where: {
          status: RecordStatus.ACTIVE,
        },
        include: {
          referrer: {
            select: {
              email: true,
              firstname: true,
              lastname: true,
            },
          },
          referee: {
            select: {
              email: true,
              firstname: true,
              lastname: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),

      // Query 2: Get all referral payments for all referrers
      prisma.referralPayment.findMany({
        where: {
          meta: {
            path: ['paymentType'],
            equals: 'subscription',
          },
        },
      }),
    ]);

    // Transform to match expected format
    const transformedResults = referrals.flatMap((referral) => {
      // Find referral payments for this referee
      const refereePayments = referralPayments.filter(
        (rp) => (rp.meta as any)?.referredUserId === referral.refereeUserId
      );

      // If no referral payments, create one record with null values
      if (refereePayments.length === 0) {
        return [
          {
            id: `admin-${referral.id}`,
            referralId: referral.id,
            referrerEmail: referral.referrer.email,
            referrerFirstname: referral.referrer.firstname,
            referrerLastname: referral.referrer.lastname,
            refereeEmail: referral.referee.email,
            refereeFirstname: referral.referee.firstname,
            refereeLastname: referral.referee.lastname,
            referralCreatedAt: referral.createdAt,
            subscriptionId: null,
            subscriptionDate: null as any, // Leave empty for users who haven't subscribed
            subscriptionTier: null,
            currency: null,
            subscriptionAmount: null,
            commissionAmount: null,
            commissionStatus: null as any, // Leave empty for users who haven't subscribed
            referralPaymentId: null,
          },
        ];
      }

      // If there are referral payments, create a record for each payment
      return refereePayments.map((rp) => {
        const meta = rp.meta as any;
        return {
          id: `admin-${referral.id}-${rp.id}`,
          referralId: referral.id,
          referrerEmail: referral.referrer.email,
          referrerFirstname: referral.referrer.firstname,
          referrerLastname: referral.referrer.lastname,
          refereeEmail: referral.referee.email,
          refereeFirstname: referral.referee.firstname,
          refereeLastname: referral.referee.lastname,
          referralCreatedAt: referral.createdAt,
          subscriptionId: meta?.subscriptionPaymentId || null,
          subscriptionDate: rp.createdAt || null,
          subscriptionTier: meta?.subscriptionTier || null,
          currency: meta?.originalCurrency || null,
          subscriptionAmount: meta?.originalAmount || null,
          commissionAmount: rp.amount || null,
          commissionStatus: rp.status || null,
          referralPaymentId: rp.id || null,
        };
      });
    });

    if (transformedResults.length === 0) {
      return {
        totalReferrals: 0,
        referrals: [],
        monthlyData: [],
        totalCommissionEarned: 0,
      };
    }

    // Transform and group the data
    const paymentRecords = transformReferralData(transformedResults);
    const monthlyData = groupReferralsByMonth(paymentRecords);

    // Get total commission earned across all users
    const totalCommission = await prisma.referralPayment.aggregate({
      where: {
        status: PaymentStatus.PAID,
      },
      _sum: { amount: true },
    });

    return {
      totalReferrals: paymentRecords.length,
      referrals: paymentRecords,
      monthlyData: monthlyData,
      totalCommissionEarned: totalCommission._sum.amount || 0,
    };
  } catch (error) {
    console.error('Error getting all referral stats:', error);
    throw error;
  }
}

/**
 * Get ALL secondary referral statistics for admin view
 * Shows all secondary referrals across all users for SUPERADMIN
 */
export async function getAllSecondaryReferralStats() {
  try {
    // Get all secondary referrals (referrals that have a secondaryReferrerUserId set)
    const allSecondaryReferrals = await prisma.referral.findMany({
      where: {
        status: RecordStatus.ACTIVE,
        secondaryReferrerUserId: {
          not: null, // Only get referrals that have a secondary referrer
        },
      },
      include: {
        referrer: {
          select: {
            id: true,
            email: true,
            firstname: true,
            lastname: true,
            subscriptionTier: true,
            subscriptionStatus: true,
            createdAt: true,
          },
        },
        referee: {
          select: {
            id: true,
            email: true,
            firstname: true,
            lastname: true,
            subscriptionTier: true,
            subscriptionStatus: true,
            createdAt: true,
          },
        },
        secondaryReferrer: {
          select: {
            id: true,
            email: true,
            firstname: true,
            lastname: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (allSecondaryReferrals.length === 0) {
      return {
        monthlyCommissions: [],
        totalCommissionEarned: 0,
        hasPermission: true,
      };
    }

    // Get subscription payments for all secondary referrals
    const secondaryReferralIds = allSecondaryReferrals.map(
      (ref) => ref.referee.id
    );

    // Get payments for secondary referrals that are active and less than 6 months old
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const payments = await prisma.payment.findMany({
      where: {
        payerUserId: {
          in: secondaryReferralIds,
        },
        status: 'paid',
        createdAt: { gte: sixMonthsAgo },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Group by month and calculate commissions
    const monthlyCommissions = new Map<
      string,
      {
        month: string;
        totalCommission: number;
        referralCount: number;
        referrals: Array<{
          id: string;
          referralId: string;
          referrer: {
            email: string;
            firstname: string;
            lastname: string;
          };
          referee: {
            email: string;
            firstname: string;
            lastname: string;
          };
          referralCreatedAt: string;
          subscriptionId: string | null;
          subscriptionDate: string | null;
          subscriptionTier: string | null;
          currency: string | null;
          subscriptionAmount: number;
          commissionAmount: number;
          commissionStatus: string;
          referralPaymentId: string | null;
        }>;
      }
    >();

    // Process all secondary referrals, including those without payments
    for (const secondaryReferral of allSecondaryReferrals) {
      // Find payments for this secondary referral
      const referralPayments = payments.filter(
        (payment) => payment.payerUserId === secondaryReferral.referee.id
      );

      if (referralPayments.length === 0) {
        // No payments yet, but still show the secondary referral
        const monthKey = dayjs(secondaryReferral.createdAt).format('YYYY-MM');

        if (!monthlyCommissions.has(monthKey)) {
          monthlyCommissions.set(monthKey, {
            month: monthKey,
            totalCommission: 0,
            referralCount: 0,
            referrals: [],
          });
        }

        const monthData = monthlyCommissions.get(monthKey)!;
        monthData.referralCount += 1;
        monthData.referrals.push({
          id: `secondary-${secondaryReferral.id}`,
          referralId: secondaryReferral.id,
          referrer: {
            email: secondaryReferral.secondaryReferrer?.email || 'N/A',
            firstname: secondaryReferral.secondaryReferrer?.firstname || 'N/A',
            lastname: secondaryReferral.secondaryReferrer?.lastname || 'N/A',
          },
          referee: {
            email: secondaryReferral.referee.email,
            firstname: secondaryReferral.referee.firstname,
            lastname: secondaryReferral.referee.lastname,
          },
          referralCreatedAt: secondaryReferral.createdAt.toISOString(),
          subscriptionId: null, // No subscription yet
          subscriptionDate: null, // No subscription yet
          subscriptionTier: null, // No subscription yet
          currency: null, // No subscription yet
          subscriptionAmount: 0, // No payment yet
          commissionAmount: 0, // No commission yet
          commissionStatus: 'NO_PAYMENT', // No subscription yet
          referralPaymentId: null, // No payment yet
        });
      } else {
        // Process each payment for this secondary referral
        for (const payment of referralPayments) {
          // Calculate 5% commission
          const commissionAmount = Math.round(payment.amount * 0.05);
          const monthKey = dayjs(payment.createdAt).format('YYYY-MM');

          if (!monthlyCommissions.has(monthKey)) {
            monthlyCommissions.set(monthKey, {
              month: monthKey,
              totalCommission: 0,
              referralCount: 0,
              referrals: [],
            });
          }

          const monthData = monthlyCommissions.get(monthKey)!;
          monthData.totalCommission += commissionAmount;
          monthData.referralCount += 1;
          monthData.referrals.push({
            id: `secondary-${secondaryReferral.id}-${payment.id}`,
            referralId: secondaryReferral.id,
            referrer: {
              email: secondaryReferral.secondaryReferrer?.email || 'N/A',
              firstname:
                secondaryReferral.secondaryReferrer?.firstname || 'N/A',
              lastname: secondaryReferral.secondaryReferrer?.lastname || 'N/A',
            },
            referee: {
              email: secondaryReferral.referee.email,
              firstname: secondaryReferral.referee.firstname,
              lastname: secondaryReferral.referee.lastname,
            },
            referralCreatedAt: secondaryReferral.createdAt.toISOString(),
            subscriptionId: payment.id, // Use payment ID as subscription ID
            subscriptionDate: payment.createdAt.toISOString(),
            subscriptionTier: 'PRO', // Assume PRO tier for paid subscriptions
            currency: 'USD', // Default currency
            subscriptionAmount: payment.amount,
            commissionAmount: commissionAmount,
            commissionStatus: 'PAID', // Secondary referrals are always considered paid
            referralPaymentId: payment.id,
          });
        }
      }
    }

    // Convert to array and sort by month (newest first)
    const monthlyCommissionsArray = Array.from(
      monthlyCommissions.values()
    ).sort((a, b) => b.month.localeCompare(a.month));

    // Calculate total commission earned
    const totalCommissionEarned = monthlyCommissionsArray.reduce(
      (sum, month) => sum + month.totalCommission,
      0
    );

    return {
      monthlyCommissions: monthlyCommissionsArray,
      totalCommissionEarned,
      hasPermission: true,
    };
  } catch (error) {
    console.error('Error getting all secondary referral stats:', error);
    throw error;
  }
}

/**
 * Get monthly commissions for users with second degree referrals
 * Only shows commissions for active secondary referrals who have been active for less than 6 months
 * Commission is 5% of subscription payment for each month
 */
export async function getMonthlyCommissionsForSecondaryReferrals(
  userId: string
) {
  try {
    // Get user to check if they have hasSecondaryReferral permission
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        meta: true,
        hasSecondaryReferred: {
          where: { status: RecordStatus.ACTIVE },
          include: {
            referee: {
              select: {
                id: true,
                email: true,
                firstname: true,
                lastname: true,
                subscriptionTier: true,
                subscriptionStatus: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is superadmin or has hasSecondaryReferral permission
    const isSuperAdmin = user.role === 'SUPERADMIN';
    const hasSecondaryReferralPermission =
      (user.meta as any)?.hasSecondaryReferral === true;

    console.log('Permission check for user:', {
      userId,
      role: user.role,
      isSuperAdmin,
      meta: user.meta,
      hasSecondaryReferralPermission,
    });

    if (!isSuperAdmin && !hasSecondaryReferralPermission) {
      console.log('User does not have permission for secondary referrals');
      return {
        monthlyCommissions: [],
        totalCommissionEarned: 0,
        hasPermission: false,
      };
    }

    console.log('User has permission for secondary referrals');

    // Debug: Let's also check the user's direct referrals to see if they have any
    const userDirectReferrals = await prisma.referral.findMany({
      where: {
        referrerUserId: userId,
        status: RecordStatus.ACTIVE,
      },
      include: {
        referee: {
          select: {
            email: true,
            firstname: true,
            lastname: true,
          },
        },
      },
    });

    console.log('User direct referrals:', userDirectReferrals.length);
    userDirectReferrals.forEach((ref, index) => {
      console.log(`Direct Referral ${index + 1}:`, {
        refereeEmail: ref.referee.email,
        refereeName: `${ref.referee.firstname} ${ref.referee.lastname}`,
        createdAt: ref.createdAt,
        secondaryReferrerUserId: ref.secondaryReferrerUserId,
      });
    });

    // Get all secondary referrals (users referred by the user's direct referrals)
    // Instead of using user.hasSecondaryReferred, let's find referrals made by the user's direct referrals
    const directReferralUserIds = userDirectReferrals.map(
      (ref) => ref.refereeUserId
    );

    const secondaryReferrals = await prisma.referral.findMany({
      where: {
        referrerUserId: {
          in: directReferralUserIds,
        },
        status: RecordStatus.ACTIVE,
      },
      include: {
        referrer: {
          select: {
            id: true,
            email: true,
            firstname: true,
            lastname: true,
          },
        },
        referee: {
          select: {
            id: true,
            email: true,
            firstname: true,
            lastname: true,
            subscriptionTier: true,
            subscriptionStatus: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(
      'Found secondary referrals (referrals made by direct referrals):',
      secondaryReferrals.length,
      'referrals'
    );
    secondaryReferrals.forEach((ref, index) => {
      console.log(`Secondary Referral ${index + 1}:`, {
        refereeEmail: ref.referee.email,
        refereeName: `${ref.referee.firstname} ${ref.referee.lastname}`,
        referrerEmail: ref.referrer.email,
        referrerName: `${ref.referrer.firstname} ${ref.referrer.lastname}`,
        createdAt: ref.createdAt,
      });
    });

    if (secondaryReferrals.length === 0) {
      return {
        monthlyCommissions: [],
        totalCommissionEarned: 0,
        hasPermission: true,
      };
    }

    // Get subscription payments for secondary referrals
    const secondaryReferralIds = secondaryReferrals.map(
      (ref) => ref.referee.id
    );

    // Get payments for secondary referrals that are active and less than 6 months old
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const payments = await prisma.payment.findMany({
      where: {
        payerUserId: { in: secondaryReferralIds },
        status: 'paid',
        createdAt: { gte: sixMonthsAgo },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log('Found payments for secondary referrals:', payments.length);
    payments.forEach((payment, index) => {
      console.log(`Payment ${index + 1}:`, {
        payerUserId: payment.payerUserId,
        amount: payment.amount,
        status: payment.status,
        createdAt: payment.createdAt,
      });
    });

    // Group by month and calculate commissions
    const monthlyCommissions = new Map<
      string,
      {
        month: string;
        totalCommission: number;
        referralCount: number;
        referrals: Array<{
          id: string;
          referralId: string;
          referrer: {
            email: string;
            firstname: string;
            lastname: string;
          };
          referee: {
            email: string;
            firstname: string;
            lastname: string;
          };
          referralCreatedAt: string;
          subscriptionId: string | null;
          subscriptionDate: string | null;
          subscriptionTier: string | null;
          currency: string | null;
          subscriptionAmount: number;
          commissionAmount: number;
          commissionStatus: string;
          referralPaymentId: string | null;
        }>;
      }
    >();

    // Process all secondary referrals, including those without payments
    for (const secondaryReferral of secondaryReferrals) {
      // Find payments for this secondary referral
      const referralPayments = payments.filter(
        (payment) => payment.payerUserId === secondaryReferral.referee.id
      );

      if (referralPayments.length === 0) {
        // No payments yet, but still show the secondary referral
        const monthKey = dayjs(secondaryReferral.createdAt).format('YYYY-MM');

        if (!monthlyCommissions.has(monthKey)) {
          monthlyCommissions.set(monthKey, {
            month: monthKey,
            totalCommission: 0,
            referralCount: 0,
            referrals: [],
          });
        }

        const monthData = monthlyCommissions.get(monthKey)!;
        monthData.referralCount += 1;
        monthData.referrals.push({
          id: `secondary-${secondaryReferral.id}`,
          referralId: secondaryReferral.id,
          referrer: {
            email: secondaryReferral.referrer.email,
            firstname: secondaryReferral.referrer.firstname,
            lastname: secondaryReferral.referrer.lastname,
          },
          referee: {
            email: secondaryReferral.referee.email,
            firstname: secondaryReferral.referee.firstname,
            lastname: secondaryReferral.referee.lastname,
          },
          referralCreatedAt: secondaryReferral.createdAt.toISOString(),
          subscriptionId: null, // No subscription yet
          subscriptionDate: null, // No subscription yet
          subscriptionTier: null, // No subscription yet
          currency: null, // No subscription yet
          subscriptionAmount: 0, // No payment yet
          commissionAmount: 0, // No commission yet
          commissionStatus: 'NO_PAYMENT', // No subscription yet
          referralPaymentId: null, // No payment yet
        });
      } else {
        // Process each payment for this secondary referral
        for (const payment of referralPayments) {
          // Calculate 5% commission
          const commissionAmount = Math.round(payment.amount * 0.05);
          const monthKey = dayjs(payment.createdAt).format('YYYY-MM');

          if (!monthlyCommissions.has(monthKey)) {
            monthlyCommissions.set(monthKey, {
              month: monthKey,
              totalCommission: 0,
              referralCount: 0,
              referrals: [],
            });
          }

          const monthData = monthlyCommissions.get(monthKey)!;
          monthData.totalCommission += commissionAmount;
          monthData.referralCount += 1;
          monthData.referrals.push({
            id: `secondary-${secondaryReferral.id}-${payment.id}`,
            referralId: secondaryReferral.id,
            referrer: {
              email: secondaryReferral.referrer.email,
              firstname: secondaryReferral.referrer.firstname,
              lastname: secondaryReferral.referrer.lastname,
            },
            referee: {
              email: secondaryReferral.referee.email,
              firstname: secondaryReferral.referee.firstname,
              lastname: secondaryReferral.referee.lastname,
            },
            referralCreatedAt: secondaryReferral.createdAt.toISOString(),
            subscriptionId: payment.id, // Use payment ID as subscription ID
            subscriptionDate: payment.createdAt.toISOString(),
            subscriptionTier: 'PRO', // Assume PRO tier for paid subscriptions
            currency: 'USD', // Default currency
            subscriptionAmount: payment.amount,
            commissionAmount: commissionAmount,
            commissionStatus: 'PAID', // Secondary referrals are always considered paid
            referralPaymentId: payment.id,
          });
        }
      }
    }

    // Convert to array and sort by month (newest first)
    const monthlyCommissionsArray = Array.from(
      monthlyCommissions.values()
    ).sort((a, b) => b.month.localeCompare(a.month));

    // Calculate total commission earned
    const totalCommissionEarned = monthlyCommissionsArray.reduce(
      (sum, month) => sum + month.totalCommission,
      0
    );

    console.log('Final result for individual user:', {
      monthlyCommissionsCount: monthlyCommissionsArray.length,
      totalCommissionEarned,
      hasPermission: true,
    });

    return {
      monthlyCommissions: monthlyCommissionsArray,
      totalCommissionEarned,
      hasPermission: true,
    };
  } catch (error) {
    console.error(
      'Error getting monthly commissions for secondary referrals:',
      error
    );
    throw error;
  }
}
