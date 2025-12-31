import prisma from '../db/prisma';
import { CREDITS_ACTIONS } from '../lib/constant';

export interface LogApiUsageInput {
  organizationId: string;
  endpoint: string;
  appLink: string;
  requestSize?: number;
  responseSize?: number;
  creditsUsed?: number;
  statusCode: number;
  duration?: number;
  ipAddress?: string;
  userAgent?: string;
  meta?: any;
}

/**
 * Log API usage for billing and analytics using CreditAction
 */
export async function logApiUsage(input: LogApiUsageInput) {
  try {
    // first find the  admin user for the organization
    const adminUser = await prisma.user.findFirst({
      where: {
        organizationId: input.organizationId,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 1,
    });
    // Create a credit action for API usage
    await prisma.creditAction.create({
      data: {
        organizationId: input.organizationId,
        userId: adminUser?.id as string,
        action: CREDITS_ACTIONS.API_USAGE,
        amount: -Number(input.creditsUsed),
        status: 'success',
        meta: {
          email: adminUser?.email,
          appLink: input.appLink,
          endpoint: input.endpoint,
          requestSize: input.requestSize,
          responseSize: input.responseSize,
          statusCode: input.statusCode,
          duration: input.duration,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          ...input.meta,
        },
      },
    });
  } catch (error) {
    console.error('Error logging API usage:', error);
    // Don't throw - we don't want to break the API call if logging fails
  }
}

/**
 * Get API usage statistics for billing using CreditAction
 */
export async function getBillingUsage(
  organizationId: string,
  startDate: Date,
  endDate: Date
) {
  const usage = await prisma.creditAction.aggregate({
    where: {
      organizationId,
      action: CREDITS_ACTIONS.API_USAGE,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    _sum: {
      amount: true,
    },
    _count: {
      id: true,
    },
  });

  const usageByEndpoint = await prisma.creditAction.groupBy({
    by: ['action'],
    where: {
      organizationId,
      action: CREDITS_ACTIONS.API_USAGE,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    _sum: {
      amount: true,
    },
    _count: {
      id: true,
    },
  });

  return {
    total: usage,
    byEndpoint: usageByEndpoint,
    period: { startDate, endDate },
  };
}

/**
 * Get recent API usage for an organization using CreditAction
 */
export async function getRecentUsage(
  organizationId: string,
  limit: number = 100
) {
  return await prisma.creditAction.findMany({
    where: {
      organizationId,
      action: CREDITS_ACTIONS.API_USAGE,
    },
    include: {
      user: {
        select: {
          username: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });
}
