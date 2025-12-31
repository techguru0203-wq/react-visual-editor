export namespace ReferralTypes {
  export interface MonthlyData {
    month: string;
    referrals: ReferralData[];
    totalReferrals: number;
    totalSubscriptionAmount: number;
    totalCommissionEarned: number;
    pendingCommissions: number;
    paidCommissions: number;
    canceledCommissions: number;
    totalReferralsWithPayments: number;
  }

  export interface ReferralData {
    id: string;
    referralId?: string; // Original referral ID for reference
    referrer?: {
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
    subscriptionId: string | null; // Used for row key in nested table
    subscriptionDate: string | null;
    subscriptionTier: string | null;
    currency: string | null;
    subscriptionAmount: number;
    commissionAmount: number;
    commissionStatus: string;
    referralPaymentId: string | null; // This is the ID from referralPayments table
  }

  // Types for monthly commissions from second degree referrals
  export interface MonthlyCommissionData {
    month: string;
    totalCommission: number;
    referralCount: number;
    referrals: SecondaryReferralCommission[];
  }

  export interface SecondaryReferralCommission {
    refereeEmail: string;
    refereeName: string;
    subscriptionAmount: number;
    commissionAmount: number;
    paymentDate: string;
  }

  export interface MonthlyCommissionsResponse {
    monthlyCommissions: MonthlyCommissionData[];
    totalCommissionEarned: number;
    hasPermission: boolean;
  }
}
