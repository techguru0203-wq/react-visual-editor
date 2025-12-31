import { useEffect, useRef, useState } from 'react';
import { SubscriptionStatus, SubscriptionTier } from '@prisma/client';
import { Alert, Button, Card, Flex, Popconfirm, Typography } from 'antd';
import Paragraph from 'antd/es/typography/Paragraph';
import Title from 'antd/es/typography/Title';
import dayjs from 'dayjs';

import { useAppModal } from '../../../common/components/AppModal';
import { useCurrentUser } from '../../../common/contexts/currentUserContext';
import { useLanguage } from '../../../common/contexts/languageContext';
import { getOutOfCreditTitle } from '../../../common/util/app';
import {
  GenerationMinimumCredit,
  SUBSCRIPTIONTIERSDISPLAYNAME,
} from '../../../lib/constants';
import trackEvent from '../../../trackingClient';
import { useCancelSubscriptionMutation } from '../hooks/useCancelSubscriptionMutation';
import { SubscriptionStatusType } from '../types/subscriptionTypes';
import CreditList from './CreditList';

import './Billing.scss';

export function Billing() {
  const [errorMsg, setErrorMsg] = useState<string>();
  const [successMsg, setSuccessMsg] = useState<string>();
  const { showAppModal } = useAppModal();
  const { user, isAdmin, organization } = useCurrentUser();
  const { t } = useLanguage();
  const subscriptionEnd = organization.subscriptionEnd;
  console.log('subscriptionEnd: ', subscriptionEnd);
  const {
    subscriptionTier,
    subscriptionStatus, //
  } = useCurrentUser();

  const isSubscriptionActive = subscriptionStatus === 'ACTIVE';
  const isFreeSubscription = subscriptionTier === SubscriptionTier.FREE;

  const cancelSubscriptionMutation = useCancelSubscriptionMutation({
    onSuccess: (data) => {
      setSuccessMsg(t('billing.subscriptionCancelled'));
      window.location.reload();
    },
    onError(error) {
      console.error(error.toString());
      setErrorMsg(t('billing.cancellationFailed') + error.toString());
    },
  });

  const updatePlan = (credits: boolean = false) => {
    showAppModal({
      type: credits ? 'purchaseCredits' : 'updateSubscription',
      payload: {
        email: user.email,
        source: 'billing',
        destination: credits ? 'buyCredits' : 'upgradePlan',
        isLowCredits: false, // User is not necessarily low on credits, just wants to change plan
      },
    });
    // track event
    // trackEvent(credits ? 'buyCredits' : 'upgradePlan', {
    //   distinct_id: user.email,
    //   payload: {
    //     currentPlan: subscriptionTier,
    //     currentStatus: subscriptionStatus,
    //   },
    // });
  };

  const prevCreditsRef = useRef<number | undefined>(organization.credits);

  useEffect(() => {
    if (
      typeof prevCreditsRef.current === 'number' &&
      organization.credits !== prevCreditsRef.current
    ) {
      console.log('Credits changed, reloading...');
      window.location.reload();
    }
    prevCreditsRef.current = organization.credits;
  }, [organization.credits]);

  return (
    <div style={{ width: '100%' }} className="billing-page">
      <Typography.Title level={4} className="main-heading">
        {t('billing.title')}
      </Typography.Title>
      <div>
        {errorMsg && (
          <Alert type="error" message={errorMsg} style={{ marginBottom: 16 }} />
        )}
        {successMsg && (
          <Alert
            type="success"
            message={successMsg}
            style={{ marginBottom: 16 }}
          />
        )}
      </div>
      <Card>
        {!isFreeSubscription ? (
          <>
            <Typography>
              <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
                {t('billing.subscriptionPlan')}
              </Title>
              <Paragraph>
                {t('billing.currentPlan')}: {SUBSCRIPTIONTIERSDISPLAYNAME[subscriptionTier]} (
                {SubscriptionStatusType[subscriptionStatus!]})
              </Paragraph>
              {subscriptionStatus ===
                SubscriptionStatus.CANCELED_YET_ACTIVE && (
                <Paragraph>
                  {t('billing.planWillStop')}{' '}
                  {dayjs(subscriptionEnd).format('MM/DD/YYYY')}
                </Paragraph>
              )}
              <Paragraph>
                {t('billing.totalSeats')}: {organization.totalSeats || 0}
              </Paragraph>
              <Paragraph>
                {t('billing.remainingSeats')}: {organization.availableSeats || 0}
              </Paragraph>
            </Typography>

            <Flex gap="small" wrap>
              <Button type="primary" onClick={() => updatePlan()}>
                {isSubscriptionActive ? t('billing.changePlan') : t('billing.choosePlan')}
              </Button>
              {!isFreeSubscription && isAdmin && (
                <Popconfirm
                  title={t('billing.cancelPlan')}
                  description={t('billing.cancelConfirm')}
                  onConfirm={(e) => {
                    cancelSubscriptionMutation.mutate();
                    // track event
                    trackEvent('cancelPlan', {
                      distinct_id: user.email,
                      payload: JSON.stringify({
                        currentPlan: subscriptionTier,
                        currentStatus: subscriptionStatus,
                      }),
                    });
                  }}
                  okText={t('billing.yes')}
                  cancelText={t('billing.no')}
                  disabled={
                    subscriptionStatus ===
                    SubscriptionStatus.CANCELED_YET_ACTIVE
                  }
                >
                  <Button
                    disabled={
                      subscriptionStatus ===
                      SubscriptionStatus.CANCELED_YET_ACTIVE
                    }
                  >
                    {t('billing.cancelPlan')}
                  </Button>
                </Popconfirm>
              )}
            </Flex>
          </>
        ) : (
          <>
            <Typography>
              <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
                {t('billing.choosePlanTitle')}
              </Title>
              <Paragraph>{t('billing.freePlan')}</Paragraph>
            </Typography>
            <Button type="primary" onClick={() => updatePlan()}>
              {t('billing.upgradePlan')}
            </Button>
          </>
        )}
      </Card>
      <Card>
        <Typography>
          <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
            {t('billing.credits')}
          </Title>
          <Paragraph>
            {t('billing.currentBalance')}: {organization.credits || 0}
          </Paragraph>
          <Paragraph>
            {(organization.credits ?? 0) <= GenerationMinimumCredit && (
              <div>{getOutOfCreditTitle(organization, t)}</div>
            )}
          </Paragraph>
          <Button
            type="primary"
            onClick={() => {
              updatePlan(true);
            }}
          >
            {t('billing.purchaseCredits')}
          </Button>
        </Typography>
        <br />
        <Paragraph>{t('billing.creditHistory')}</Paragraph>
        <CreditList />
      </Card>
    </div>
  );
}
