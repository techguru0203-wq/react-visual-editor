import {
  ClockCircleOutlined,
  CloseCircleOutlined,
  DollarOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Card, Col, Row, Statistic, Typography } from 'antd';

import { useLanguage } from '../../../../common/contexts/languageContext';
import { ReferralTypes } from './ReferralTypes';

const { Title, Text } = Typography;

interface ReferralSummaryProps {
  monthlyData: ReferralTypes.MonthlyData[];
  isSuperAdmin: boolean;
}

export function ReferralSummary({
  monthlyData,
  isSuperAdmin,
}: ReferralSummaryProps) {
  const { t } = useLanguage();
  
  // Calculate summary statistics from monthly data
  const totalReferrals = monthlyData.reduce(
    (sum: number, month: ReferralTypes.MonthlyData) =>
      sum + month.totalReferrals,
    0
  );

  // Only count PAID commissions in total earnings, not PENDING ones
  const totalCommissionEarned = monthlyData.reduce(
    (sum: number, month: ReferralTypes.MonthlyData) =>
      sum + month.totalCommissionEarned,
    0
  );

  // Count pending commissions separately
  const pendingCommissions = monthlyData.reduce(
    (sum: number, month: ReferralTypes.MonthlyData) =>
      sum + month.pendingCommissions,
    0
  );
  const canceledCommissions = monthlyData.reduce(
    (sum: number, month: ReferralTypes.MonthlyData) =>
      sum + month.canceledCommissions,
    0
  );

  return (
    <>
      <Title
        level={2}
        style={{ marginLeft: '20px', marginTop: '10px', marginBottom: '8px' }}
      >
        {t('referral.dashboard')}
        {isSuperAdmin && (
          <span
            style={{
              fontSize: '10px',
              color: '#faad14',
              marginLeft: '6px',
              fontWeight: 'normal',
            }}
          >
            {t('referral.adminView')}
          </span>
        )}
      </Title>
      <Text
        type="secondary"
        style={{ marginLeft: '20px', marginBottom: '10px', display: 'block' }}
      >
        {isSuperAdmin
          ? t('referral.trackAllUsers')
          : t('referral.trackYourReferrals')}
      </Text>

      {/* Summary Statistics */}
      <Row
        gutter={[16, 16]}
        style={{
          marginTop: '0px',
          marginBottom: '15px',
          marginLeft: '20px',
          marginRight: '20px',
        }}
      >
        <Col xs={24} sm={12} lg={6}>
          <Card bodyStyle={{ padding: '16px' }}>
            <Statistic
              title={t('referral.paidReferral')}
              value={totalReferrals}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bodyStyle={{ padding: '16px' }}>
            <Statistic
              title={t('referral.canceledCommissions')}
              value={canceledCommissions}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bodyStyle={{ padding: '16px' }}>
            <Statistic
              title={t('referral.commissionEarned')}
              value={(totalCommissionEarned / 100).toFixed(2)}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bodyStyle={{ padding: '16px' }}>
            <Statistic
              title={t('referral.pendingCommissions')}
              value={pendingCommissions}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}
