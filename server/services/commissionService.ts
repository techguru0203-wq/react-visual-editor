import prisma from '../db/prisma';
import { PaymentStatus } from '@prisma/client';
import dayjs from 'dayjs';

/**
 * Get commission statistics for a user
 */
export async function getCommissionStats(userId: string) {
  try {
    // Get all commission payments for this user
    const payments = await prisma.referralPayment.findMany({
      where: { referrerUserId: userId },
      include: {
        referrer: {
          select: {
            email: true,
            firstname: true,
            lastname: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group payments by month
    const monthlyGroups = new Map();

    for (const payment of payments) {
      const monthKey = dayjs(payment.createdAt.toISOString()).format('YYYY-MM');

      if (!monthlyGroups.has(monthKey)) {
        monthlyGroups.set(monthKey, {
          month: monthKey,
          payments: [],
          totalAmount: 0,
          pendingAmount: 0,
          paidAmount: 0,
          canceledAmount: 0,
          pendingCount: 0,
          paidCount: 0,
          canceledCount: 0,
        });
      }

      const monthGroup = monthlyGroups.get(monthKey);
      monthGroup.payments.push(payment);
      monthGroup.totalAmount += payment.amount || 0;

      if (payment.status === PaymentStatus.PENDING) {
        monthGroup.pendingAmount += payment.amount || 0;
        monthGroup.pendingCount += 1;
      } else if (payment.status === PaymentStatus.PAID) {
        monthGroup.paidAmount += payment.amount || 0;
        monthGroup.paidCount += 1;
      } else if (payment.status === PaymentStatus.CANCELED) {
        monthGroup.canceledAmount += payment.amount || 0;
        monthGroup.canceledCount += 1;
      }
    }

    // Convert to array and sort by month (newest first)
    const monthlyData = Array.from(monthlyGroups.values()).sort((a, b) =>
      b.month.localeCompare(a.month)
    );

    // Calculate totals
    const totalEarned = payments.reduce(
      (sum, payment) => sum + (payment.amount || 0),
      0
    );

    const pendingAmount = payments
      .filter((payment) => payment.status === PaymentStatus.PENDING)
      .reduce((sum, payment) => sum + (payment.amount || 0), 0);

    const paidAmount = payments
      .filter((payment) => payment.status === PaymentStatus.PAID)
      .reduce((sum, payment) => sum + (payment.amount || 0), 0);

    return {
      totalEarned,
      pendingAmount,
      paidAmount,
      payments,
      monthlyData,
    };
  } catch (error) {
    console.error('Error getting commission stats:', error);
    throw error;
  }
}

/**
 * Get ALL commission statistics for admin view
 */
export async function getAllCommissionStats() {
  try {
    // Get all commission payments in the system
    const payments = await prisma.referralPayment.findMany({
      include: {
        referrer: {
          select: {
            email: true,
            firstname: true,
            lastname: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group payments by month
    const monthlyGroups = new Map();

    for (const payment of payments) {
      const monthKey = dayjs(payment.createdAt.toISOString()).format('YYYY-MM');

      if (!monthlyGroups.has(monthKey)) {
        monthlyGroups.set(monthKey, {
          month: monthKey,
          payments: [],
          totalAmount: 0,
          pendingAmount: 0,
          paidAmount: 0,
          canceledAmount: 0,
          pendingCount: 0,
          paidCount: 0,
          canceledCount: 0,
        });
      }

      const monthGroup = monthlyGroups.get(monthKey);
      monthGroup.payments.push(payment);
      monthGroup.totalAmount += payment.amount || 0;

      if (payment.status === 'PENDING') {
        monthGroup.pendingAmount += payment.amount || 0;
        monthGroup.pendingCount += 1;
      } else if (payment.status === PaymentStatus.PAID) {
        monthGroup.paidAmount += payment.amount || 0;
        monthGroup.paidCount += 1;
      } else if (payment.status === PaymentStatus.CANCELED) {
        monthGroup.canceledAmount += payment.amount || 0;
        monthGroup.canceledCount += 1;
      }
    }

    // Convert to array and sort by month (newest first)
    const monthlyData = Array.from(monthlyGroups.values()).sort((a, b) =>
      b.month.localeCompare(a.month)
    );

    // Calculate totals across all users
    const totalEarned = payments.reduce(
      (sum, payment) => sum + (payment.amount || 0),
      0
    );

    const pendingAmount = payments
      .filter((payment) => payment.status === 'PENDING')
      .reduce((sum, payment) => sum + (payment.amount || 0), 0);

    const paidAmount = payments
      .filter((payment) => payment.status === PaymentStatus.PAID)
      .reduce((sum, payment) => sum + (payment.amount || 0), 0);

    const canceledAmount = payments
      .filter((payment) => payment.status === PaymentStatus.CANCELED)
      .reduce((sum, payment) => sum + (payment.amount || 0), 0);

    return {
      totalEarned,
      pendingAmount,
      paidAmount,
      canceledAmount,
      payments,
      monthlyData,
    };
  } catch (error) {
    console.error('Error getting all commission stats:', error);
    throw error;
  }
}

/**
 * Update commission payment status (paid or canceled)
 */
export async function updateCommissionStatus(
  params: {
    action: 'pay' | 'cancel' | 'pay-bulk';
    paymentIds: string[];
  }
): Promise<boolean> {
  try {
    const { action, paymentIds } = params;
    
    // Map actions to statuses
    let status: PaymentStatus;
    if (action === 'pay' || action === 'pay-bulk') {
      status = PaymentStatus.PAID;
    } else if (action === 'cancel') {
      status = PaymentStatus.CANCELED;
    } else {
      throw new Error(`Invalid action: ${action}`);
    }
    
    // Update all payment IDs in a single operation
    await prisma.referralPayment.updateMany({
      where: {
        id: { in: paymentIds }
      },
      data: { status }
    });
    
    return true;
  } catch (error) {
    console.error(`Error updating commission(s):`, error);
    return false;
  }
}

/**
 * Calculate and create commission payment when referee makes subscription payment
 */
export async function calculateCommissionFromSubscription(
  refereeUserId: string,
  subscriptionAmount: number,
  subscriptionPaymentId: string,
  currency: string = 'USD',
  paymentType: string = 'subscription',
  subscriptionInterval?: string
) {
  try {
    // Find the referral relationship
    const referral = await prisma.referral.findUnique({
      where: { refereeUserId },
      select: { id: true, referrerUserId: true },
    });

    console.log('Referral lookup result:', referral);

    if (!referral) {
      console.log('No referral found for user:', refereeUserId);
      return;
    }

    // Check if commission already exists for this subscription payment
    const existingCommission = await prisma.referralPayment.findFirst({
      where: {
        referrerUserId: referral.referrerUserId,
        meta: {
          path: ['subscriptionPaymentId'],
          equals: subscriptionPaymentId,
        },
      },
    });

    if (existingCommission) {
      console.log(
        'Commission already exists for subscription payment:',
        subscriptionPaymentId,
        'Commission ID:',
        existingCommission.id
      );
      return {
        success: false,
        error: 'Commission already exists for this subscription payment',
      };
    }

    // Check if we've already given 6 months of commissions to this referee
    const existingCommissions = await prisma.referralPayment.count({
      where: {
        referrerUserId: referral.referrerUserId,
        meta: {
          path: ['referredUserId'],
          equals: refereeUserId,
        },
        status: {
          in: ['PENDING', 'PAID'],
        },
      },
    });

    if (existingCommissions >= 6) {
      console.log(
        'Commission limit reached for user:',
        refereeUserId,
        'Already given:',
        existingCommissions,
        'months of commissions'
      );
      return {
        success: false,
        error:
          'Commission limit reached: Maximum 6 months of commissions already given to this referee',
      };
    }

    // Calculate commission (15% of original amount)
    let commissionAmount = Math.round(subscriptionAmount * 0.15);

    // If subscription is not monthly, divide commission by 2
    if (
      subscriptionInterval &&
      subscriptionInterval.toLowerCase() !== 'month'
    ) {
      commissionAmount = Math.round(commissionAmount / 2);
      console.log(
        'Non-monthly subscription detected. Commission divided by 2. Original:',
        Math.round(subscriptionAmount * 0.15),
        'Final:',
        commissionAmount
      );
    }

    // Get current month in YYYY-MM format
    const currentMonth = new Date().toISOString().slice(0, 7);

    // Create commission record
    const commission = await prisma.referralPayment.create({
      data: {
        referrerUserId: referral.referrerUserId,
        month: currentMonth,
        amount: commissionAmount,
        status: 'PENDING',
        meta: {
          paymentType,
          originalAmount: subscriptionAmount,
          originalCurrency: currency,
          referredUserId: refereeUserId,
          referralId: referral.id,
          subscriptionPaymentId: subscriptionPaymentId,
        },
      },
    });

    return {
      success: true,
      commissionId: commission.id,
      commissionAmount: commissionAmount,
    };
  } catch (error) {
    console.error('Error calculating commission from subscription:', error);
    throw error;
  }
}
