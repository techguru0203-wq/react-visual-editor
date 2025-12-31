import { useEffect, useState } from 'react';
import {
  CheckCircleFilled,
  CheckCircleTwoTone,
  FireOutlined,
} from '@ant-design/icons';
import {
  Button,
  Divider,
  Flex,
  Segmented,
  Select,
  Tag,
  Typography,
} from 'antd';

import { api_url, TIER_SEAT_LIMITS } from '../../../lib/constants';
import trackEvent from '../../../trackingClient';
import { useCurrentUser } from '../../contexts/currentUserContext';
import { useLanguage } from '../../contexts/languageContext';
import { getHeaders } from '../../util/apiHeaders';
import { CREDITS, getPLANS, Plan } from './PricingPlans.constants';

import './PricingPlans.scss';

async function createCheckoutSession(
  planKey: string,
  term: 'monthly' | 'yearly',
  email: string
) {
  const headers = await getHeaders();
  const response = await fetch(
    `${api_url}/api/subscriptions/create-checkout-session`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ planKey, term, email }),
      credentials: 'include',
    }
  );
  const data = await response.json();
  if (data?.data) {
    window.location.href = data.data;
  } else {
    console.error('Failed to create Stripe session:', data);
  }
}

async function createCreditCheckoutSession(index: number, email: string) {
  const headers = await getHeaders();
  const response = await fetch(
    `${api_url}/api/subscriptions/create-credit-session`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ creditIndex: index, email }),
      credentials: 'include',
    }
  );
  const data = await response.json();
  if (data?.data) {
    window.location.href = data.data;
  } else {
    console.error('Failed to create Stripe credit session:', data);
  }
}

const PlanCard = (props: {
  plan: Plan;
  selectedPlanTerm: string;
  t: (key: string) => string;
}) => {
  const { plan, selectedPlanTerm, t } = props;
  const { user, subscriptionTier, subscriptionStatus } = useCurrentUser();
  const [seats, setSeats] = useState<number>(1);
  const isPlanActive =
    plan.key === subscriptionTier && subscriptionStatus === 'ACTIVE';
  const isAnnuallySelected = selectedPlanTerm === t('pricing.annuallyDiscount');

  // Get max seats from constant
  const maxSeats = TIER_SEAT_LIMITS[plan.key] || 1;

  console.log('isAnnuallySelected', isAnnuallySelected);

  return (
    <Flex
      vertical
      className={isPlanActive ? 'activePlan' : ''}
      style={{ position: 'relative' }}
    >
      <Flex justify="space-between">
        <div>
          <Typography.Text className="heading">
            {plan.title}&nbsp;
          </Typography.Text>
          {plan.title === t('pricing.teams') && !isPlanActive && (
            <Tag color="#5345F3" style={{ display: 'none' }}>
              <FireOutlined /> {t('pricing.popular')}
            </Tag>
          )}
        </div>
        <div>
          <Typography.Text
            className={isAnnuallySelected ? 'strike-price' : 'price'}
            style={{
              color: isAnnuallySelected ? '#8B8D97' : '#5570F1',
              textDecoration: isAnnuallySelected ? 'line-through' : 'none',
            }}
          >
            {plan.price}
          </Typography.Text>
          {isAnnuallySelected && (
            <Typography.Text className="price">
              {plan.annualPrice}
            </Typography.Text>
          )}
        </div>
      </Flex>
      <Flex vertical>
        <Typography.Text
          style={{ fontSize: 12, color: '#8B8D97', margin: '5px 0' }}
        >
          {' '}
          {isAnnuallySelected
            ? plan.subtitleAnnualPlan
            : plan.subtitleMonthlyPlan}
        </Typography.Text>
        <Typography.Text style={{ margin: '5px 0 10px' }}>
          {plan.target}
        </Typography.Text>
      </Flex>
      <Flex vertical>
        <div style={{ marginTop: 10 }}>
          <Button
            type="primary"
            style={{ width: '100%' }}
            disabled={isPlanActive && maxSeats <= 1}
            onClick={async () => {
              console.log('selectPlan', plan.title, 'seats:', seats);
              trackEvent('selectPlan', {
                distinct_id: user.email,
                payload: JSON.stringify({
                  planType: plan.title,
                  seats,
                }),
              });

              await createCheckoutSession(
                plan.key,
                isAnnuallySelected ? 'yearly' : 'monthly',
                user.email
              ); // <-- CHANGED
            }}
          >
            {isPlanActive
              ? maxSeats > 1
                ? `Add seats`
                : t('pricing.currentlySelected')
              : t('pricing.choosePlan').replace('{plan}', plan.title)}
          </Button>
        </div>
        {plan.sections.map((section: any, index: number) => (
          <div key={section.title + index} style={{ marginTop: 0 }}>
            {section.previousTier && (
              <Flex>
                <Typography.Text
                  style={{ fontSize: 12, fontWeight: 700, marginTop: 10 }}
                >
                  {t('pricing.everythingInPlus').replace(
                    '{tier}',
                    section.previousTier
                  )}
                </Typography.Text>
              </Flex>
            )}
            {section.title && (
              <Typography.Text
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  marginTop: 0,
                  display: 'none',
                }}
              >
                {section.title}
              </Typography.Text>
            )}
            <Flex vertical style={{ marginTop: 0 }}>
              {section.features.map((feature: any, index: number) => (
                <Flex
                  key={feature + index}
                  style={{ marginTop: 8 }}
                  align={'flex-start'}
                >
                  <CheckCircleTwoTone twoToneColor={'#5570F1'} />
                  <Typography.Text style={{ fontSize: 12, marginLeft: 5 }}>
                    {feature}
                  </Typography.Text>
                </Flex>
              ))}
            </Flex>
          </div>
        ))}
      </Flex>
      {/* Current Plan Badge - at the bottom */}
      {isPlanActive && (
        <Flex justify="center" style={{ marginTop: 16 }}>
          <Tag
            color="#5345F3"
            style={{
              fontWeight: 600,
              fontSize: 12,
              padding: '4px 12px',
              borderRadius: '12px',
            }}
          >
            <CheckCircleFilled style={{ marginRight: 4 }} />
            {t('pricing.currentPlan')}
          </Tag>
        </Flex>
      )}
    </Flex>
  );
};
export interface UpdateSubscriptionProps {
  email: string;
  source: string;
  destination: string;
  isLowCredits?: boolean; // Add optional flag to indicate if user is low on credits
}
export function UpdateSubscription({
  payload,
}: {
  payload: UpdateSubscriptionProps;
}) {
  const { t } = useLanguage();
  const [selectedPlanTerm, setSelectedPlanTerm] = useState(
    t('pricing.annuallyDiscount')
  );
  const [selectCredit, setSelectCredit] = useState(0);

  const { email, source, destination, isLowCredits = false } = payload;
  useEffect(() => {
    trackEvent('viewPaywall', {
      distinct_id: email,
      payload: JSON.stringify({
        source,
        destination,
      }),
    });
  }, [destination, email, source]); // Add empty dependency array to run only once on mount

  return (
    <>
      {/* Prominent message at the top - only show if user is low on credits */}
      {isLowCredits && (
        <Flex justify="center" style={{ marginBottom: 16 }}>
          <Typography.Text
            style={{
              fontSize: 16,
              color: '#ff4d4f',
              fontWeight: 500,
              textAlign: 'center',
              padding: '12px 16px',
              backgroundColor: '#fff2f0',
              border: '1px solid #ffccc7',
              borderRadius: '6px',
              width: '100%',
            }}
          >
            {t('pricing.runningOutOfCredits')}
          </Typography.Text>
        </Flex>
      )}

      <Flex justify={'center'} style={{ marginTop: 10 }}>
        <Segmented<string>
          block
          style={{ width: '320px' }}
          options={[t('pricing.monthly'), t('pricing.annuallyDiscount')]}
          onChange={(value) => {
            setSelectedPlanTerm(value);
            // track event
            trackEvent('selectPlanTerm', {
              distinct_id: email,
              payload: JSON.stringify({ planTerm: value }),
            });
          }}
          defaultValue={t('pricing.annuallyDiscount')}
        />
      </Flex>

      {/* Early Bird Discount Message */}
      <Flex justify={'center'} style={{ marginTop: 8 }}>
        <Typography.Text
          style={{
            fontSize: 14,
            color: '#d4380d',
            fontWeight: 600,
            textAlign: 'center',
            padding: '8px 12px',
            backgroundColor: '#fff2e8',
            border: '1px solid #ffbb96',
            borderRadius: '6px',
            display: 'none',
          }}
        >
          {/* {t('pricing.earlyBirdDiscount')} */}
        </Typography.Text>
      </Flex>

      <div className={'plans-container'} style={{ marginTop: 10 }}>
        {getPLANS(t).map((plan) => (
          <PlanCard
            key={plan.title}
            plan={plan}
            selectedPlanTerm={selectedPlanTerm}
            t={t}
          />
        ))}
      </div>
      <Divider />
      <Flex
        align="center"
        justify="space-between"
        gap="middle"
        className="pricing-plans-footer"
      >
        <Flex
          align="center"
          justify="flex-start"
          gap="middle"
          className="buy-credit-main"
        >
          {t('pricing.buyMoreCredits')}
          <Flex align="center" justify="flex-start" gap="middle">
            <Select
              defaultValue={{ label: '10,000 - $10', value: 0 }}
              labelInValue
              options={CREDITS}
              onChange={(val) => {
                setSelectCredit(val.value);
                // track event
                trackEvent('selectCredit', {
                  distinct_id: email,
                  payload: JSON.stringify({ credits: val.label }),
                });
              }}
            />
            <Button
              type="primary"
              onClick={async () => {
                trackEvent('buyCredit', {
                  distinct_id: email,
                  payload: JSON.stringify({
                    credits: CREDITS[selectCredit].label,
                  }),
                });

                await createCreditCheckoutSession(selectCredit, email); // <-- CHANGED
              }}
            >
              {t('pricing.buyCredits')}
            </Button>
          </Flex>
        </Flex>
        <p style={{ margin: 0, textAlign: 'center' }}>
          {t('pricing.enterpriseContact')}
          <span style={{ marginLeft: 5 }}>
            {' '}
            <a href={'mailto:general@omniflow.team'}>general@omniflow.team</a>
          </span>
        </p>
      </Flex>
    </>
  );
}
