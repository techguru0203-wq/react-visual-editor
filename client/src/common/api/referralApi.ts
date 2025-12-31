import { api_url } from '../../lib/constants';
import { getHeaders } from '../util/apiHeaders';

/**
 * Get referral statistics for the current user (admin view - all users for SUPERADMIN)
 */
export async function getReferralStats() {
  try {
    const response = await fetch(`${api_url}/api/referral/stats`, {
      method: 'GET',
      headers: await getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to get referral stats');
    }

    const data = await response.json();

    if (data.success) {
      return data.data;
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    console.error('Error getting referral stats:', error);
    throw error;
  }
}

/**
 * Get 1st degree referral statistics for the current user only
 */
export async function getFirstDegreeReferralStats() {
  try {
    const response = await fetch(`${api_url}/api/referral/first-degree-stats`, {
      method: 'GET',
      headers: await getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to get first degree referral stats');
    }

    const data = await response.json();

    if (data.success) {
      return data.data;
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    console.error('Error getting first degree referral stats:', error);
    throw error;
  }
}

/**
 * Get commission statistics for the current user
 */
export async function getCommissionStats() {
  try {
    const response = await fetch(`${api_url}/api/referral/commission`, {
      method: 'GET',
      headers: await getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to get commission stats');
    }

    const data = await response.json();

    if (data.success) {
      return data.data;
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    console.error('Error getting commission stats:', error);
    throw error;
  }
}

/**
 * Get secondary referral statistics for the current user
 */
export async function getSecondaryReferralStats() {
  try {
    const response = await fetch(`${api_url}/api/referral/secondary-stats`, {
      method: 'GET',
      headers: await getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to get secondary referral stats');
    }

    const data = await response.json();

    if (data.success) {
      return data.data;
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    console.error('Error getting secondary referral stats:', error);
    throw error;
  }
}

/**
 * Update commission status (pay, cancel, or bulk pay)
 */
export async function updateCommission(
  action: 'pay' | 'cancel' | 'pay-bulk',
  paymentIds: string[]
) {
  try {
    // Use a single unified endpoint
    const response = await fetch(`${api_url}/api/referral/commission/update`, {
      method: 'POST',
      headers: await getHeaders(),
      body: JSON.stringify({
        action,
        paymentIds,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to ${action} commission(s)`);
    }

    const data = await response.json();

    // Handle different response formats
    if (action === 'pay-bulk') {
      return data.success ? data.data : false;
    }

    return data.success;
  } catch (error) {
    console.error(`Error ${action}ing commission(s):`, error);
    throw error;
  }
}
