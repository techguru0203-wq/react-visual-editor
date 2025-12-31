import { useEffect, useState } from 'react';
import { Alert, Card, Table, Typography } from 'antd';

import { getSecondaryReferralStats } from '../../../../common/api/referralApi';
import { useLanguage } from '../../../../common/contexts/languageContext';
import { getMonthlyTableColumns } from './MonthlyTableColumns';
import { getReferralColumns } from './ReferralColumns';
import { ReferralTypes } from './ReferralTypes';

const { Text } = Typography;

interface SecondaryReferralCommissionsTableProps {
  isSuperAdmin: boolean;
}

export function SecondaryReferralCommissionsTable({
  isSuperAdmin,
}: SecondaryReferralCommissionsTableProps) {
  const { t } = useLanguage();
  const [monthlyData, setMonthlyData] = useState<ReferralTypes.MonthlyData[]>(
    []
  );
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMonthlyCommissions = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await getSecondaryReferralStats();
        console.log('Secondary referral stats response:', response);

        if (response.hasPermission) {
          // The backend now returns data in MonthlyData format directly
          const transformedData: ReferralTypes.MonthlyData[] =
            response.monthlyCommissions.map((monthData: any) => ({
              month: monthData.month,
              referrals: monthData.referrals,
              totalReferrals: monthData.referralCount,
              totalSubscriptionAmount: monthData.referrals.reduce(
                (sum: number, ref: any) => sum + ref.subscriptionAmount,
                0
              ),
              totalCommissionEarned: monthData.totalCommission,
              pendingCommissions: monthData.referrals.filter(
                (ref: any) => ref.commissionStatus === 'PENDING'
              ).length,
              paidCommissions: monthData.referrals.filter(
                (ref: any) => ref.commissionStatus === 'PAID'
              ).length,
              canceledCommissions: monthData.referrals.filter(
                (ref: any) => ref.commissionStatus === 'CANCELED'
              ).length,
              totalReferralsWithPayments: monthData.referrals.filter(
                (ref: any) => ref.subscriptionAmount > 0
              ).length,
            }));

          setMonthlyData(transformedData);
          setHasPermission(true);
        } else {
          setHasPermission(false);
        }
      } catch (err) {
        console.error('Error loading monthly commissions:', err);
        setError(
          'Failed to load monthly commissions data. Please try again later.'
        );
      } finally {
        setLoading(false);
      }
    };

    loadMonthlyCommissions();
  }, []);

  // Show error if there was an error loading data
  if (error) {
    return (
      <Alert
        message="Error Loading Monthly Commissions"
        description={error}
        type="error"
        showIcon
        style={{ margin: '20px' }}
      />
    );
  }

  // Don't render anything if user doesn't have permission (after API call)
  if (!loading && !hasPermission) {
    return null;
  }

  // Get monthly table columns (same as 1st degree referrals)
  const monthlyTableColumns = getMonthlyTableColumns({
    isSuperAdmin: false, // Secondary referrals don't have admin actions
    setMonthlyData: setMonthlyData,
    t,
  });

  // Get referral columns (same as 1st degree referrals)
  const referralColumns = getReferralColumns({
    isSuperAdmin: false, // Secondary referrals don't have admin actions
    handleMarkAsPaid: async () => {}, // No admin actions for secondary referrals
    handleCancelPayment: async () => {}, // No admin actions for secondary referrals
    t,
  });

  return (
    <Card
      title="Second Degree Referrals by Month"
      style={{
        marginBottom: '24px',
        marginLeft: '20px',
        marginRight: '20px',
        marginTop: '0px',
      }}
      bodyStyle={{ padding: '8px' }}
      extra={
        <Text type="secondary">
          Monthly summary of your second-degree referrals
        </Text>
      }
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
              `${range[0]}-${range[1]} of ${total} months`,
          }}
          locale={{
            emptyText: 'No secondary referral data found.',
          }}
        />
      </div>
    </Card>
  );
}
