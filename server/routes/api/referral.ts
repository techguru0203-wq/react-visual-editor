import { Router } from 'express';
import { userProfileRequestHandler } from '../../lib/util';
import {
  processReferral,
  getReferralStats,
  getAllReferralStats,
  getMonthlyCommissionsForSecondaryReferrals,
  getAllSecondaryReferralStats,
} from '../../services/referralService';
import {
  getCommissionStats,
  getAllCommissionStats,
  updateCommissionStatus,
} from '../../services/commissionService';

const router = Router();

// Apply userProfileRequestHandler to all routes
router.use(userProfileRequestHandler);

/**
 * POST /api/referral/process
 * Process a referral when a new user signs up
 */
router.post('/process', async (request, response) => {
  try {
    const { referrerCode, newUserId, newUserEmail } = request.body;

    if (!referrerCode || !newUserId || !newUserEmail) {
      return response.status(400).json({
        success: false,
        errorMsg:
          'Missing required fields: referrerCode, newUserId, newUserEmail',
      });
    }

    const result = await processReferral(referrerCode, newUserId, newUserEmail);

    if (result.success) {
      response.status(200).json({
        success: true,
        data: {
          message: 'Referral processed successfully',
          referralId: result.referralId,
        },
      });
    } else {
      response.status(400).json({
        success: false,
        errorMsg: result.error || 'Failed to process referral',
      });
    }
  } catch (error) {
    console.error('Error processing referral:', error);
    response.status(500).json({
      success: false,
      errorMsg: 'Failed to process referral',
    });
  }
});

/**
 * GET /api/referral/stats
 * Get referral statistics - user's own stats or all stats for SUPERADMIN
 */
router.get('/stats', async (request: any, response) => {
  try {
    const currentUser = response.locals.currentUser;
    if (!currentUser) {
      return response.status(401).json({
        success: false,
        errorMsg: 'User not authenticated',
      });
    }

    let stats;

    // If user is SUPERADMIN, get all referral stats, otherwise get user's own stats
    if (currentUser.role === 'SUPERADMIN') {
      stats = await getAllReferralStats();
    } else {
      const userId = currentUser.userId;
      stats = await getReferralStats(userId);
    }

    response.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error getting referral stats:', error);
    response.status(500).json({
      success: false,
      errorMsg: 'Failed to get referral statistics',
    });
  }
});

/**
 * GET /api/referral/first-degree-stats
 * Get 1st degree referral statistics for the current user only
 * For SUPERADMIN users, shows all referral statistics across all users
 */
router.get('/first-degree-stats', async (request: any, response) => {
  try {
    const currentUser = response.locals.currentUser;
    if (!currentUser) {
      return response.status(401).json({
        success: false,
        errorMsg: 'User not authenticated',
      });
    }

    let stats;

    // If user is SUPERADMIN, get all referral stats, otherwise get user's own stats
    if (currentUser.role === 'SUPERADMIN') {
      stats = await getAllReferralStats();
    } else {
      const userId = currentUser.userId;
      stats = await getReferralStats(userId);
    }

    response.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error getting first degree referral stats:', error);
    response.status(500).json({
      success: false,
      errorMsg: 'Failed to get first degree referral statistics',
    });
  }
});

/**
 * GET /api/referral/commission
 * Get commission statistics - user's own stats or all stats for SUPERADMIN
 */
router.get('/commission', async (request: any, response) => {
  try {
    const currentUser = response.locals.currentUser;
    if (!currentUser) {
      return response.status(401).json({
        success: false,
        errorMsg: 'User not authenticated',
      });
    }

    let stats;

    // If user is SUPERADMIN, get all commission stats, otherwise get user's own stats
    if (currentUser.role === 'SUPERADMIN') {
      stats = await getAllCommissionStats();
    } else {
      const userId = currentUser.userId;
      stats = await getCommissionStats(userId);
    }

    response.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error getting commission stats:', error);
    response.status(500).json({
      success: false,
      errorMsg: 'Failed to get commission statistics',
    });
  }
});

// Unified commission update endpoint
router.post('/commission/update', async (request: any, response) => {
  try {
    const currentUser = response.locals.currentUser;
    if (!currentUser) {
      return response.status(401).json({
        success: false,
        errorMsg: 'User not authenticated',
      });
    }

    // Only SUPERADMIN can update commission statuses
    if (currentUser.role !== 'SUPERADMIN') {
      return response.status(401).json({
        success: false,
        errorMsg: 'User not authorized to access this resource',
      });
    }

    const { action, paymentIds } = request.body;

    if (!action || !paymentIds) {
      return response.status(400).json({
        success: false,
        errorMsg: 'Missing required fields: action and paymentIds',
      });
    }

    if (!['pay', 'cancel', 'pay-bulk'].includes(action)) {
      return response.status(400).json({
        success: false,
        errorMsg: 'Invalid action. Must be one of: pay, cancel, pay-bulk',
      });
    }

    // Ensure paymentIds is always an array
    if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
      return response.status(400).json({
        success: false,
        errorMsg: 'paymentIds must be a non-empty array',
      });
    }

    const success = await updateCommissionStatus({
      action: action as 'pay' | 'cancel' | 'pay-bulk',
      paymentIds,
    });

    if (success) {
      const actionText =
        action === 'pay' || action === 'pay-bulk' ? 'paid' : 'canceled';
      const count = paymentIds.length;

      response.status(200).json({
        success: true,
        data: {
          message: `Commission(s) ${actionText} successfully`,
          count,
          action,
        },
      });
    } else {
      response.status(400).json({
        success: false,
        errorMsg: `Failed to ${action} commission(s)`,
      });
    }
  } catch (error) {
    console.error(`Error updating commission status:`, error);
    response.status(500).json({
      success: false,
      errorMsg: 'Failed to update commission status',
    });
  }
});

/**
 * GET /api/referral/secondary-stats
 * Get secondary referral statistics for the current user
 * For SUPERADMIN users, shows all secondary referral statistics across all users
 * Only accessible to SUPERADMIN or users with hasSecondaryReferral permission
 */
router.get('/secondary-stats', async (request: any, response) => {
  try {
    const currentUser = response.locals.currentUser;
    if (!currentUser) {
      return response.status(401).json({
        success: false,
        errorMsg: 'User not authenticated',
      });
    }

    let secondaryStats;

    // If user is SUPERADMIN, get all secondary referral stats, otherwise get user's own stats
    if (currentUser.role === 'SUPERADMIN') {
      secondaryStats = await getAllSecondaryReferralStats();
    } else {
      const userId = currentUser.userId;
      secondaryStats = await getMonthlyCommissionsForSecondaryReferrals(userId);
    }

    response.status(200).json({
      success: true,
      data: secondaryStats,
    });
  } catch (error) {
    console.error('Error getting secondary referral stats:', error);
    response.status(500).json({
      success: false,
      errorMsg: 'Failed to get secondary referral statistics',
    });
  }
});

/**
 * GET /api/referral/monthly-commissions
 * Get monthly commissions for users with second degree referrals
 * Only accessible to SUPERADMIN or users with hasSecondaryReferral permission
 * @deprecated Use /api/referral/secondary-stats instead
 */
router.get('/monthly-commissions', async (request: any, response) => {
  try {
    const currentUser = response.locals.currentUser;
    if (!currentUser) {
      return response.status(401).json({
        success: false,
        errorMsg: 'User not authenticated',
      });
    }

    const userId = currentUser.userId;
    const monthlyCommissions = await getMonthlyCommissionsForSecondaryReferrals(
      userId
    );

    response.status(200).json({
      success: true,
      data: monthlyCommissions,
    });
  } catch (error) {
    console.error('Error getting monthly commissions:', error);
    response.status(500).json({
      success: false,
      errorMsg: 'Failed to get monthly commissions',
    });
  }
});

export default router;

// Add required exports for the route loader
module.exports = {
  routes: router,
  className: 'referral',
};
