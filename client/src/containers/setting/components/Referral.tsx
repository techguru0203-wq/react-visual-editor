import { useEffect, useRef, useState } from 'react';
import { Alert, Spin } from 'antd';

import { getReferralStats } from '../../../common/api/referralApi';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import { FirstDegreeReferralsTable } from './referral/FirstDegreeReferralsTable';
import { ReferralSummary } from './referral/ReferralSummary';
import { ReferralTypes } from './referral/ReferralTypes';
import { SecondaryReferralCommissionsTable } from './referral/SecondaryReferralCommissionsTable';

export default function Referral() {
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const [monthlyData, setMonthlyData] = useState<ReferralTypes.MonthlyData[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasShownNoDataMessage = useRef(false);

  // Check if user is SUPERADMIN
  const isSuperAdmin = user.role === 'SUPERADMIN';

  // Check if user has permission to view secondary referrals
  const canViewSecondaryReferrals =
    isSuperAdmin || user.meta?.hasSecondaryReferral === true;

  useEffect(() => {
    const loadReferralData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load referral stats
        const referralStats = await getReferralStats();

        // Handle referral data - check if it exists and has the expected structure
        if (
          referralStats &&
          referralStats.monthlyData &&
          Array.isArray(referralStats.monthlyData)
        ) {
          console.log('Monthly referral data:', referralStats.monthlyData);
          setMonthlyData(referralStats.monthlyData);
        } else {
          console.log(
            'No monthly referral data available or unexpected structure:',
            referralStats
          );
          setMonthlyData([]);
        }
        // If no data is available, show a message (only once)
        if (
          !hasShownNoDataMessage.current &&
          (!referralStats ||
            !referralStats.referrals ||
            referralStats.referrals.length === 0)
        ) {
          hasShownNoDataMessage.current = true;
        }
      } catch (err) {
        console.error('Error loading referral data:', err);
        setError(t('referral.failedToLoad'));
      } finally {
        setLoading(false);
      }
    };

    loadReferralData();
  }, [t]); // Add t dependency since it's used in the function

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '20px' }}>{t('referral.loadingData')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message={t('referral.errorLoading')}
        description={error}
        type="error"
        showIcon
        style={{ margin: '20px' }}
      />
    );
  }

  return (
    <div
      style={{
        padding: '0px',
        margin: '0px',
        width: '100%',
        maxWidth: '100%',
        minHeight: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <ReferralSummary monthlyData={monthlyData} isSuperAdmin={isSuperAdmin} />
      <FirstDegreeReferralsTable isSuperAdmin={isSuperAdmin} />
      {canViewSecondaryReferrals && (
        <SecondaryReferralCommissionsTable isSuperAdmin={isSuperAdmin} />
      )}
    </div>
  );
}
