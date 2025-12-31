import { SUBSCRIPTIONTIERS } from '../../../lib/constants';

type TranslationFunction = (key: string) => string;

const BASE_PRICES = {
  FREE: 0,
  STARTER: 25,
  PROFESSIONAL: 75,
  BUSINESS: 200,
};

const YEARLY_DISCOUNT = 0.9;

const getFormattedPrice = (
  amount: number,
  t: TranslationFunction,
  periodKey: string = 'pricing.period'
) => {
  const period = t(periodKey);
  // Format to 1 decimal place, but remove trailing .0 for whole numbers
  const roundedAmount =
    amount % 1 === 0 ? amount.toString() : amount.toFixed(1);
  return `$${roundedAmount}${period}`;
};

const formatSubtitle = (tier: number) => ``;

type Section = {
  previousTier?: string;
  title?: string;
  features: string[];
};

export type Plan = {
  title: string;
  key: string;
  target: string;
  monthlyUrl?: string;
  yearlyUrl?: string;
  price?: string;
  annualPrice?: string;
  subtitleMonthlyPlan: string;
  subtitleAnnualPlan: string;
  isCurrentPlan: boolean;
  sections: Section[];
};

export const getPLANS = (t: TranslationFunction): Plan[] => [
  // {
  //   title: 'Free',
  //   key: SUBSCRIPTIONTIERS.FREE,
  //   target: 'For Individuals to Try Out Omniflow',
  //   price: getFormattedPrice(BASE_PRICES.FREE),
  //   annualPrice: getFormattedPrice(BASE_PRICES.FREE * YEARLY_DISCOUNT),
  //   subtitleMonthlyPlan: formatSubtitle(BASE_PRICES.FREE),
  //   subtitleAnnualPlan: formatSubtitle(BASE_PRICES.FREE * YEARLY_DISCOUNT),
  //   isCurrentPlan: false,
  //   sections: [
  //     {
  //       features: ['5,000 credits', '3 Projects'],
  //     },
  //     {
  //       title: 'Planner',
  //       features: [
  //         'AI Generated Requirements/Apps/Prototypes',
  //         'Document Import/Export/Sharing',
  //         'Custom Project Workflow',
  //       ],
  //     },
  //     {
  //       title: 'Builder',
  //       features: [],
  //     },
  //   ],
  // },
  {
    title: t('pricing.performance'),
    key: SUBSCRIPTIONTIERS.STARTER,
    target: t('pricing.forIndividualsToShip'),
    price: getFormattedPrice(
      BASE_PRICES.STARTER,
      t,
      'pricing.periodPerformance'
    ),
    annualPrice: getFormattedPrice(
      BASE_PRICES.STARTER * YEARLY_DISCOUNT,
      t,
      'pricing.periodPerformance'
    ),
    subtitleMonthlyPlan: formatSubtitle(BASE_PRICES.STARTER),
    subtitleAnnualPlan: formatSubtitle(BASE_PRICES.STARTER * YEARLY_DISCOUNT),
    isCurrentPlan: false,
    sections: [
      {
        previousTier: t('pricing.everythingInFree'),
        features: [
          t('pricing.creditsPerMonth20k'),
          t('pricing.unlimitedProjects'),
          t('pricing.customDomain'),
          t('pricing.fullStack'),
          t('pricing.githubBitbucketSync'),
          t('pricing.authFileStoragePaymentEmail'),
          t('pricing.builtInAIGeneration'),
          t('pricing.publishAndHost'),
        ],
      },
    ],
  },
  {
    title: t('pricing.teams'),
    key: SUBSCRIPTIONTIERS.PROFESSIONAL,
    target: t('pricing.forTeamsToBoost'),
    price: getFormattedPrice(BASE_PRICES.PROFESSIONAL, t),
    annualPrice: getFormattedPrice(
      BASE_PRICES.PROFESSIONAL * YEARLY_DISCOUNT,
      t
    ),
    subtitleMonthlyPlan: formatSubtitle(BASE_PRICES.PROFESSIONAL),
    subtitleAnnualPlan: formatSubtitle(
      BASE_PRICES.PROFESSIONAL * YEARLY_DISCOUNT
    ),
    isCurrentPlan: false,
    sections: [
      {
        previousTier: t('pricing.everythingInPerformance'),
        features: [
          t('pricing.creditsPerMonth75k'),
          t('pricing.teamInvitation'),
          t('pricing.customDesignLanguage'),
          t('pricing.liveCodeEditing'),
          t('pricing.databaseSnapshot'),
          t('pricing.jiraIntegration'),
          t('pricing.centralizedBilling'),
          t('pricing.upTo20Users'),
        ],
      },
    ],
  },
  {
    title: t('pricing.scale'),
    key: SUBSCRIPTIONTIERS.BUSINESS,
    target: t('pricing.forLargeTeamsToTransform'),
    monthlyUrl: process.env.REACT_APP_STRIPE_BUSINESS_MONTHLY_URL,
    yearlyUrl: process.env.REACT_APP_STRIPE_BUSINESS_YEARLY_URL,
    price: getFormattedPrice(BASE_PRICES.BUSINESS, t),
    annualPrice: getFormattedPrice(BASE_PRICES.BUSINESS * YEARLY_DISCOUNT, t),
    subtitleMonthlyPlan: formatSubtitle(BASE_PRICES.BUSINESS),
    subtitleAnnualPlan: formatSubtitle(BASE_PRICES.BUSINESS * YEARLY_DISCOUNT),
    isCurrentPlan: false,
    sections: [
      {
        previousTier: t('pricing.everythingInTeams'),
        features: [
          t('pricing.creditsPerMonth200k'),
          t('pricing.prioritySupport'),
          t('pricing.customIntegration'),
          t('pricing.viewBuildAndRuntimeLogs'),
          t('pricing.knowledgeBase'),
          t('pricing.customTechStack'),
          t('pricing.upTo100Users'),
        ],
      },
    ],
  },
];

export type CREDIT = {
  label: string;
  value: number;
  url?: string;
};

export const CREDITS: CREDIT[] = [
  {
    label: '10,000 - $10',
    value: 0,
    url: process.env.REACT_APP_STRIPE_OMNIFLOW_CREDITS_10K,
  },
  {
    label: '40,000 - $30',
    value: 1,
    url: process.env.REACT_APP_STRIPE_OMNIFLOW_CREDITS_40K,
  },
  {
    label: '100,000 - $60',
    value: 2,
    url: process.env.REACT_APP_STRIPE_OMNIFLOW_CREDITS_100K,
  },
];
