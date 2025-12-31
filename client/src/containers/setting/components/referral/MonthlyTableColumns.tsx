import { Button, message } from 'antd';

import { updateCommission } from '../../../../common/api/referralApi';
import { ReferralTypes } from './ReferralTypes';

interface MonthlyTableColumnsProps {
  isSuperAdmin: boolean;
  setMonthlyData: React.Dispatch<
    React.SetStateAction<ReferralTypes.MonthlyData[]>
  >;
  t: (key: string) => string;
}

export const getMonthlyTableColumns = ({
  isSuperAdmin,
  setMonthlyData,
  t,
}: MonthlyTableColumnsProps) => {
  // Handler function for paying all commissions in a month
  const handlePayAllInMonth = async (monthData: ReferralTypes.MonthlyData) => {
    // Get all pending payments in this month
    const pendingPayments = monthData.referrals.filter(
      (referral) =>
        referral.commissionStatus === 'PENDING' && referral.referralPaymentId
    );

    if (pendingPayments.length === 0) {
      message.info('No pending payments found in this month');
      return;
    }

    try {
      // Mark all pending payments as paid
      const paymentIds = pendingPayments
        .map((payment) => payment.referralPaymentId)
        .filter((id): id is string => id !== null);

      if (paymentIds.length === 0) {
        message.info('No valid payment IDs found');
        return;
      }

      const success = await updateCommission('pay-bulk', paymentIds);

      if (success) {
        message.success(
          `Successfully marked ${paymentIds.length} payments as PAID for ${monthData.month}`
        );
        // Update local state to reflect changes
        setMonthlyData((prevData) =>
          prevData.map((month) =>
            month.month === monthData.month
              ? {
                  ...month,
                  referrals: month.referrals.map((ref) =>
                    paymentIds.includes(ref.referralPaymentId || '')
                      ? { ...ref, commissionStatus: 'PAID' }
                      : ref
                  ),
                  pendingCommissions: 0, // All pending payments in this month are now paid
                  paidCommissions: month.paidCommissions + paymentIds.length,
                  totalCommissionEarned: month.referrals.reduce(
                    (sum, ref) =>
                      paymentIds.includes(ref.referralPaymentId || '')
                        ? sum + ref.commissionAmount
                        : ref.commissionStatus === 'PAID'
                          ? sum + ref.commissionAmount
                          : sum,
                    0
                  ),
                }
              : month
          )
        );
      } else {
        message.warning(
          `Failed to mark payments as PAID for ${monthData.month}`
        );
      }
    } catch (error) {
      console.error('Error marking all payments as paid:', error);
      message.error('Error marking payments as paid');
    }
  };

  return [
    {
      title: (
        <span style={{ fontWeight: 'normal' }}>{t('monthlyTable.month')}</span>
      ),
      dataIndex: 'month',
      key: 'month',
      width: 180,
      fixed: 'left' as const,
      render: (month: string) => (
        <span style={{ fontWeight: 'normal', fontSize: '16px' }}>
          {new Date(month + '-15').toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
          })}
        </span>
      ),
    },
    {
      title: (
        <span style={{ fontWeight: 'normal' }}>
          {t('monthlyTable.paidReferral')}
        </span>
      ),
      dataIndex: 'totalReferrals',
      key: 'totalReferrals',
      width: 140,
      render: (total: number) => (
        <span style={{ color: '#1890ff', fontWeight: 'normal' }}>{total}</span>
      ),
    },
    {
      title: (
        <span style={{ fontWeight: 'normal' }}>
          {t('monthlyTable.totalCommission')}
        </span>
      ),
      dataIndex: 'totalCommissionEarned',
      key: 'totalCommissionEarned',
      width: 180,
      render: (amount: number) => (
        <span style={{ color: '#722ed1', fontWeight: 'normal' }}>
          $ {(amount / 100).toFixed(2)}
        </span>
      ),
    },
    {
      title: (
        <span style={{ fontWeight: 'normal' }}>
          {t('monthlyTable.pending')}
        </span>
      ),
      dataIndex: 'pendingCommissions',
      key: 'pendingCommissions',
      width: 120,
      render: (count: number) => (
        <span style={{ color: '#faad14', fontWeight: 'normal' }}>{count}</span>
      ),
    },
    {
      title: (
        <span style={{ fontWeight: 'normal' }}>{t('monthlyTable.paid')}</span>
      ),
      dataIndex: 'paidCommissions',
      key: 'paidCommissions',
      width: 120,
      render: (count: number) => (
        <span style={{ color: '#52c41a', fontWeight: 'normal' }}>{count}</span>
      ),
    },
    {
      title: (
        <span style={{ fontWeight: 'normal' }}>
          {t('monthlyTable.canceled')}
        </span>
      ),
      dataIndex: 'canceledCommissions',
      key: 'canceledCommissions',
      width: 120,
      render: (count: number) => (
        <span style={{ color: '#ff4d4f', fontWeight: 'normal' }}>{count}</span>
      ),
    },
    {
      title: (
        <span style={{ fontWeight: 'normal' }}>{t('monthlyTable.status')}</span>
      ),
      key: 'monthStatus',
      width: 140,
      render: (record: ReferralTypes.MonthlyData) => {
        const isComplete = record.pendingCommissions === 0;
        return (
          <span
            style={{
              color: isComplete ? '#52c41a' : '#faad14',
              fontWeight: 'normal',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {isComplete
              ? t('monthlyTable.complete')
              : t('monthlyTable.pendingStatus')}
          </span>
        );
      },
    },
    ...(isSuperAdmin
      ? [
          {
            title: (
              <span style={{ fontWeight: 'normal' }}>
                {t('monthlyTable.actions')}
              </span>
            ),
            key: 'actions',
            width: 160,
            fixed: 'right' as const,
            render: (_: any, record: ReferralTypes.MonthlyData) => {
              const pendingCount = record.pendingCommissions;
              return (
                <Button
                  type="primary"
                  size="small"
                  onClick={() => handlePayAllInMonth(record)}
                  disabled={pendingCount === 0}
                  style={{
                    backgroundColor: pendingCount > 0 ? '#52c41a' : '#d9d9d9',
                    borderColor: pendingCount > 0 ? '#52c41a' : '#d9d9d9',
                  }}
                >
                  {t('monthlyTable.payAll').replace(
                    '{count}',
                    pendingCount.toString()
                  )}
                </Button>
              );
            },
          },
        ]
      : []),
  ];
};
