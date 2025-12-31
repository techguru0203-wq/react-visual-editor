import { useEffect, useState } from 'react';
import { Card, message, Table, Typography } from 'antd';

import {
  getFirstDegreeReferralStats,
  updateCommission,
} from '../../../../common/api/referralApi';
import { useLanguage } from '../../../../common/contexts/languageContext';
import { getMonthlyTableColumns } from './MonthlyTableColumns';
import { getReferralColumns } from './ReferralColumns';
import { ReferralTypes } from './ReferralTypes';

const { Text } = Typography;

interface FirstDegreeReferralsTableProps {
  isSuperAdmin: boolean;
}

export function FirstDegreeReferralsTable({
  isSuperAdmin,
}: FirstDegreeReferralsTableProps) {
  const { t } = useLanguage();
  const [monthlyData, setMonthlyData] = useState<ReferralTypes.MonthlyData[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFirstDegreeReferralData = async () => {
      try {
        setLoading(true);
        setError(null);

        const referralStats = await getFirstDegreeReferralStats();

        if (
          referralStats &&
          referralStats.monthlyData &&
          Array.isArray(referralStats.monthlyData)
        ) {
          setMonthlyData(referralStats.monthlyData);
        } else {
          setMonthlyData([]);
        }
      } catch (err) {
        console.error('Error loading first degree referral data:', err);
        setError(
          'Failed to load first degree referral data. Please try again later.'
        );
      } finally {
        setLoading(false);
      }
    };

    loadFirstDegreeReferralData();
  }, []);

  // Handler functions for admin actions (only for SUPERADMIN)
  const handleMarkAsPaid = async (record: ReferralTypes.ReferralData) => {
    if (!record.referralPaymentId) {
      message.error('No referral payment ID found for this record');
      return;
    }

    try {
      const success = await updateCommission('pay', [record.referralPaymentId]);

      if (success) {
        message.success(
          `Commission marked as PAID for ${record.referee.email}`
        );
        setMonthlyData((prevData) =>
          prevData.map((month) => ({
            ...month,
            referrals: month.referrals.map((ref) =>
              ref.referralPaymentId === record.referralPaymentId
                ? { ...ref, commissionStatus: 'PAID' }
                : ref
            ),
            pendingCommissions: month.referrals.filter((ref) =>
              ref.referralPaymentId === record.referralPaymentId
                ? false
                : ref.commissionStatus === 'PENDING'
            ).length,
            paidCommissions: month.referrals.filter((ref) =>
              ref.referralPaymentId === record.referralPaymentId
                ? true
                : ref.commissionStatus === 'PAID'
            ).length,
            totalCommissionEarned: month.referrals.reduce(
              (sum, ref) =>
                ref.referralPaymentId === record.referralPaymentId
                  ? sum + ref.commissionAmount
                  : ref.commissionStatus === 'PAID'
                    ? sum + ref.commissionAmount
                    : sum,
              0
            ),
          }))
        );
      } else {
        message.error('Failed to update commission status');
      }
    } catch (error) {
      console.error('Error updating commission status:', error);
      message.error('Error updating commission status');
    }
  };

  const handleCancelPayment = async (record: ReferralTypes.ReferralData) => {
    if (!record.referralPaymentId) {
      message.error('No referral payment ID found for this record');
      return;
    }

    try {
      const success = await updateCommission('cancel', [
        record.referralPaymentId,
      ]);

      if (success) {
        message.success(`Commission canceled for ${record.referee.email}`);
        setMonthlyData((prevData) =>
          prevData.map((month) => ({
            ...month,
            referrals: month.referrals.map((ref) =>
              ref.referralPaymentId === record.referralPaymentId
                ? { ...ref, commissionStatus: 'CANCELED' }
                : ref
            ),
            pendingCommissions: month.referrals.filter((ref) =>
              ref.referralPaymentId === record.referralPaymentId
                ? false
                : ref.commissionStatus === 'PENDING'
            ).length,
            canceledCommissions: month.referrals.filter((ref) =>
              ref.referralPaymentId === record.referralPaymentId
                ? true
                : ref.commissionStatus === 'CANCELED'
            ).length,
          }))
        );
      } else {
        message.error('Failed to cancel commission');
      }
    } catch (error) {
      console.error('Error canceling commission:', error);
      message.error('Error canceling commission');
    }
  };

  // Get referral columns with handlers
  const referralColumns = getReferralColumns({
    isSuperAdmin,
    handleMarkAsPaid,
    handleCancelPayment,
    t,
  });

  // Get monthly table columns
  const monthlyTableColumns = getMonthlyTableColumns({
    isSuperAdmin,
    setMonthlyData,
    t,
  });

  if (error) {
    return (
      <Card
        title={t('referral.directReferralsByMonth')}
        style={{
          marginBottom: '24px',
          marginLeft: '20px',
          marginRight: '20px',
          marginTop: '0px',
        }}
        bodyStyle={{ padding: '8px' }}
      >
        <div style={{ textAlign: 'center', padding: '20px', color: '#ff4d4f' }}>
          {error}
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={t('referral.directReferralsByMonth')}
      style={{
        marginBottom: '24px',
        marginLeft: '20px',
        marginRight: '20px',
        marginTop: '0px',
      }}
      bodyStyle={{ padding: '8px' }}
      extra={<Text type="secondary">{t('referral.directMonthlySummary')}</Text>}
    >
      <div style={{ overflow: 'auto', width: '100%' }}>
        <Table
          dataSource={monthlyData}
          style={{ width: '100%', fontSize: '14px', minWidth: '100%' }}
          size="middle"
          scroll={{ x: 'max-content' }}
          columns={monthlyTableColumns}
          loading={loading}
          expandable={{
            expandedRowRender: (record: ReferralTypes.MonthlyData) => {
              const referralsWithIds = record.referrals.map(
                (referral: ReferralTypes.ReferralData) => ({
                  ...referral,
                  referralId: referral.referralId || referral.id,
                  referralCreatedAt: referral.referralCreatedAt,
                })
              );

              return (
                <Table
                  dataSource={referralsWithIds}
                  columns={referralColumns}
                  rowKey={(record) =>
                    `${record.referralId}-${
                      record.subscriptionId || 'no-subscription'
                    }`
                  }
                  pagination={false}
                  size="middle"
                  scroll={{ x: 'max-content' }}
                  style={{ width: '100%', fontSize: '13px' }}
                />
              );
            },
          }}
          rowKey="month"
          pagination={{
            pageSize: 12,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              t('referral.monthsRangeOfTotal')
                .replace('{range[0]}', range[0].toString())
                .replace('{range[1]}', range[1].toString())
                .replace('{total}', total.toString()),
          }}
          locale={{
            emptyText: t('referral.noDirectReferralData'),
          }}
        />
      </div>
    </Card>
  );
}
