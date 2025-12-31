import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { Button } from 'antd';

import { SUBSCRIPTIONTIERSDISPLAYNAME } from '../../../../lib/constants';
import { ReferralTypes } from './ReferralTypes';

interface ReferralColumnsProps {
  isSuperAdmin: boolean;
  handleMarkAsPaid: (record: ReferralTypes.ReferralData) => Promise<void>;
  handleCancelPayment: (record: ReferralTypes.ReferralData) => Promise<void>;
  t: (key: string) => string;
}

export const getReferralColumns = ({
  isSuperAdmin,
  handleMarkAsPaid,
  handleCancelPayment,
  t,
}: ReferralColumnsProps) => {
  return [
    // Add Referrer column for SUPERADMIN users
    ...(isSuperAdmin
      ? [
          {
            title: <span style={{ fontWeight: 'normal' }}>{t('referral.referrer')}</span>,
            key: 'referrer',
            width: 220,
            fixed: 'left' as const,
            render: (record: ReferralTypes.ReferralData) => (
              <div>
                <div>{record.referrer?.email || 'Unknown'}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {record.referrer?.firstname || ''}{' '}
                  {record.referrer?.lastname || ''}
                </div>
              </div>
            ),
          },
        ]
      : []),
    {
      title: <span style={{ fontWeight: 'normal' }}>{t('referral.referredUser')}</span>,
      key: 'referee',
      width: 220,
      render: (record: ReferralTypes.ReferralData) => (
        <div>
          <div>{record.referee.email}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.referee.firstname} {record.referee.lastname}
          </div>
        </div>
      ),
    },
    {
      title: <span style={{ fontWeight: 'normal' }}>{t('referral.signupDate')}</span>,
      key: 'referralCreatedAt',
      width: 120,
      render: (record: ReferralTypes.ReferralData) =>
        new Date(record.referralCreatedAt).toLocaleDateString(),
    },
    {
      title: <span style={{ fontWeight: 'normal' }}>{t('referral.subscriptionDate')}</span>,
      key: 'subscriptionDate',
      width: 140,
      render: (record: ReferralTypes.ReferralData) =>
        record.subscriptionDate
          ? new Date(record.subscriptionDate).toLocaleDateString()
          : t('referral.noSubscription'),
    },
    {
      title: <span style={{ fontWeight: 'normal' }}>{t('referral.amount')}</span>,
      key: 'subscriptionAmount',
      width: 160,
      render: (record: ReferralTypes.ReferralData) => {
        if (record.subscriptionAmount > 0 && record.currency) {
          return (
            <span style={{ color: '#52c41a', fontWeight: 'normal' }}>
              {(record.subscriptionAmount / 100).toFixed(2)} $ (
              {record.subscriptionTier
                ? SUBSCRIPTIONTIERSDISPLAYNAME[record.subscriptionTier] ||
                  record.subscriptionTier
                : 'Free'}
              )
            </span>
          );
        } else {
          return <span style={{ color: '#d9d9d9' }}>{t('referral.noPayment')}</span>;
        }
      },
    },
    {
      title: <span style={{ fontWeight: 'normal' }}>{t('referral.commission')}</span>,
      key: 'commissionAmount',
      width: 120,
      render: (record: ReferralTypes.ReferralData) =>
        record.commissionAmount > 0 ? (
          <span style={{ color: '#52c41a', fontWeight: 'normal' }}>
            $ {(record.commissionAmount / 100).toFixed(2)}
          </span>
        ) : (
          <span style={{ color: '#d9d9d9' }}>{t('referral.noCommission')}</span>
        ),
    },
    // Only show Status column for non-SUPERADMIN users
    ...(isSuperAdmin
      ? []
      : [
          {
            title: <span style={{ fontWeight: 'normal' }}>{t('referral.status')}</span>,
            key: 'commissionStatus',
            width: 120,
            render: (record: ReferralTypes.ReferralData) => {
              const statusConfig = {
                PENDING: { color: '#faad14', icon: '⏳' },
                PAID: { color: '#52c41a', icon: '✅' },
                CANCELED: { color: '#ff4d4f', icon: '❌' },
                NO_PAYMENT: { color: '#d9d9d9', icon: '' },
                NO_PAYMENTS: { color: '#d9d9d9', icon: '' },
              };

              const config =
                statusConfig[
                  record.commissionStatus as keyof typeof statusConfig
                ] || statusConfig.NO_PAYMENT;

              return (
                <span style={{ color: config.color, fontWeight: 'normal' }}>
                  {config.icon}
                  {record.commissionStatus === 'NO_PAYMENT'
                    ? t('referral.noPaymentStatus')
                    : record.commissionStatus}
                </span>
              );
            },
          },
        ]),
    ...(isSuperAdmin
      ? [
          {
            title: <span style={{ fontWeight: 'normal' }}>{t('referral.actions')}</span>,
            key: 'actions',
            width: 140,
            fixed: 'right' as const,
            render: (record: ReferralTypes.ReferralData) => {
              // Show action buttons for PENDING commissions that have payment IDs
              if (
                record.commissionStatus === 'PENDING' &&
                record.referralPaymentId
              ) {
                return (
                  <div
                    style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}
                  >
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckCircleOutlined />}
                      onClick={() => handleMarkAsPaid(record)}
                      style={{
                        backgroundColor: '#52c41a',
                        borderColor: '#52c41a',
                        fontSize: '11px',
                        height: '28px',
                        padding: '0 8px',
                      }}
                    >
                      {t('referral.markPaid')}
                    </Button>

                    <Button
                      danger
                      size="small"
                      icon={<CloseCircleOutlined />}
                      onClick={() => handleCancelPayment(record)}
                      style={{
                        fontSize: '11px',
                        height: '28px',
                        padding: '0 8px',
                      }}
                    >
                      {t('referral.cancel')}
                    </Button>
                  </div>
                );
              }

              // Show status messages for other cases
              if (record.commissionStatus === 'PAID') {
                return (
                  <span style={{ color: '#52c41a', fontSize: '12px' }}>
                    {t('referral.alreadyPaid')}
                  </span>
                );
              }

              if (record.commissionStatus === 'CANCELED') {
                return (
                  <span style={{ color: '#ff4d4f', fontSize: '12px' }}>
                    {t('referral.alreadyCanceled')}
                  </span>
                );
              }

              if (record.commissionStatus === 'NO_PAYMENTS') {
                return <span style={{ color: '#d9d9d9' }}>{t('referral.noPayments')}</span>;
              }

              if (record.commissionStatus === 'NO_PAYMENT') {
                return <span style={{ color: '#d9d9d9' }}>{t('referral.noPaymentYet')}</span>;
              }

              return <span style={{ color: '#999' }}>-</span>;
            },
          },
        ]
      : []),
  ];
};
