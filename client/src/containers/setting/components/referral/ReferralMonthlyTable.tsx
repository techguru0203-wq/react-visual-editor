import { Card, message, Table, Typography } from 'antd';

import {
  updateCommission,
} from '../../../../common/api/referralApi';
import { useLanguage } from '../../../../common/contexts/languageContext';
import { getMonthlyTableColumns } from './MonthlyTableColumns';
import { getReferralColumns } from './ReferralColumns';
import { ReferralTypes } from './ReferralTypes';

const { Text } = Typography;

interface ReferralMonthlyTableProps {
  monthlyData: ReferralTypes.MonthlyData[];
  setMonthlyData: React.Dispatch<
    React.SetStateAction<ReferralTypes.MonthlyData[]>
  >;
  isSuperAdmin: boolean;
}

export function ReferralMonthlyTable({
  monthlyData,
  setMonthlyData,
  isSuperAdmin,
}: ReferralMonthlyTableProps) {
  const { t } = useLanguage();
  
  // Handler functions for admin actions (only for SUPERADMIN)
  const handleMarkAsPaid = async (record: ReferralTypes.ReferralData) => {
    if (!record.referralPaymentId) {
      message.error('No referral payment ID found for this record');
      return;
    }

    try {
      // Call API to mark commission as paid
      const success = await updateCommission('pay', [record.referralPaymentId]);

      if (success) {
        message.success(
          `Commission marked as PAID for ${record.referee.email}`
        );
        // Update local state to reflect changes
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
      // Call API to cancel commission
      const success = await updateCommission('cancel', [record.referralPaymentId]);

      if (success) {
        message.success(`Commission canceled for ${record.referee.email}`);
        // Update local state to reflect changes
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

  return (
    <Card
      title={t('referral.referralsByMonth')}
      style={{
        marginBottom: '24px',
        marginLeft: '20px',
        marginRight: '20px',
        marginTop: '0px',
      }}
      bodyStyle={{ padding: '8px' }}
      extra={
        <Text type="secondary">
          {t('referral.monthlySummary')}
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
          expandable={{
            expandedRowRender: (record: ReferralTypes.MonthlyData) => {
              // The referrals data is already flattened from the backend
              // Use the referralId if available, otherwise use the id
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
            emptyText: t('referral.noDataFound'),
          }}
        />
      </div>
    </Card>
  );
}
