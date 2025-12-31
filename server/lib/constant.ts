import { DOCTYPE, SubscriptionTier } from '@prisma/client';

export const SuperAdminCompanyId = 'superAdminCompany';

export const corsOptions = {
  origin: process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '',
  methods: 'GET,PUT,POST,DELETE,OPTIONS',
  allowedHeaders: 'Content-Type,Content-Length,Authorization',
  exposedHeaders: 'Content-Type,Authorization,Content-Length',
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

// copied to /client/src/containers/documents/types/documentTypes.ts
export const DocumentTypeNameMapping: Record<string, Record<string, string>> = {
  PRD: {
    type: DOCTYPE.PRD,
    name: 'PRD',
  },
  UI_DESIGN: {
    type: DOCTYPE.UI_DESIGN,
    name: 'UI/UX Design',
  },
  PROTOTYPE: {
    type: DOCTYPE.PROTOTYPE,
    name: 'Prototype',
  },
  TECH_DESIGN: {
    type: DOCTYPE.TECH_DESIGN,
    name: 'Tech Design',
  },
  DEVELOPMENT_PLAN: {
    type: DOCTYPE.DEVELOPMENT_PLAN,
    name: 'Development Plan',
  },
  QA_PLAN: {
    type: DOCTYPE.QA_PLAN,
    name: 'QA & Test Plan',
  },
  RELEASE_PLAN: {
    type: DOCTYPE.RELEASE_PLAN,
    name: 'Release Plan',
  },
  PROPOSAL: {
    type: DOCTYPE.PROPOSAL,
    name: 'Business Proposal',
  },
  BUSINESS: {
    type: DOCTYPE.BUSINESS,
    name: 'Business',
  },
  PRODUCT: {
    type: DOCTYPE.PRODUCT,
    name: 'Product',
  },
  ENGINEERING: {
    type: DOCTYPE.ENGINEERING,
    name: 'Engineering',
  },
  MARKETING: {
    type: DOCTYPE.MARKETING,
    name: 'Marketing Plan',
  },
  SALES: {
    type: DOCTYPE.SALES,
    name: 'Sales Document',
  },
  SUPPORT: {
    type: DOCTYPE.SUPPORT,
    name: 'Customer Support',
  },
  // OTHER: {
  //   type: DOCTYPE.OTHER,
  //   name: 'Other',
  // },
};

export enum Specialization {
  PRODUCT_MANAGEMENT = 'Product Management',
  UI_DESIGN = 'UI Design',
  FRONTEND_ENGINEER = 'Frontend Engineer',
  BACKEND_ENGINEER = 'Backend Engineer',
  FULLSTACK_ENGINEER = 'Fullstack Engineer',
  INFRA_ENGINEER = 'Infra Engineer',
  DATA_ENGINEER = 'Data Engineer',
  ML_ENGINEER = 'ML Engineer',
  DATA_SCIENTIST = 'Data Scientist',
  QA_ENGINEER = 'QA Engineer',
  RELEASE_ENGINEER = 'Release Engineer',
  MOBILE_ENGINEER_IOS = 'Mobile Engineer - iOS',
  MOBILE_ENGINEER_ANDROID = 'Mobile Engineer - Android',
  OTHERS = 'Others',
}

export enum PricingTier {
  STARTER = 0,
  PRO_MONTHLY = 28800,
  PRO_YEARLY = 29900,
  BUSINESS_MONTHLY = 4900,
  BUSINESS_YEARLY = 49900,
  ENTERPRISE_MONTHLY = 10000,
  ENTERPRISE_YEARLY = 100000,
}

export const USER_SIGN_UP_CREDITS = 5000;
export const REFERRAL_REWARD_CREDITS = 1000;

export const USER_REFILL_CREDITS_PER_DAY = 2500;
export const USER_MAX_CREDITS_PER_MONTH = 5000;
export const GenerationMinimumCredit = 100;

export const CREDITS_FOR_SUBSCRIPTION: Readonly<
  Record<string, Record<string, number>>
> = {
  MONTHLY: {
    FREE: 0,
    STARTER: 20000,
    PRO: 75000,
    BUSINESS: 200000,
  },
  YEARLY: {
    FREE: 0,
    STARTER: 240000,
    PRO: 900000,
    BUSINESS: 2400000,
  },
};

export const SubscriptionTierIndex: Record<string, number> = {
  FREE: -1,
  STARTER: 0,
  PRO: 1,
  BUSINESS: 2,
  ENTERPRISE: 3,
};

export const CREDITS_ACTIONS: Record<string, string> = {
  SUBSCRIPTION_ADD: 'subscription_add',
  CREDIT_PURCHASE: 'credit_purchase',
  CREDIT_CONSUME: 'credit_consume',
  CREDIT_INVITER_REWARD: 'credit_inviter_reward',
  CREDIT_REFILL: 'credit_refill',
  CREDIT_REFERRAL_REWARD: 'credit_referral_reward',
  API_USAGE: 'api_usage',
};

export const PAYMENT_TYPES: Record<string, string> = {
  SUBSCRIPTION_START: 'subscription_start',
  CREDIT_PURCHASE: 'credit_purchase',
};

export const CreditAmountMapping: Record<string, number> = {
  '1000': 10000,
  '3000': 40000,
  '6000': 100000,
};

interface Language {
  code: string;
  name: string;
  nativeName: string;
}
export const LANGUAGES: Language[] = [
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans' },
  { code: 'sq', name: 'Albanian', nativeName: 'Shqip' },
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'hy', name: 'Armenian', nativeName: 'Հայերեն' },
  { code: 'az', name: 'Azerbaijani', nativeName: 'Azərbaycanca' },
  { code: 'eu', name: 'Basque', nativeName: 'Euskara' },
  { code: 'be', name: 'Belarusian', nativeName: 'Беларуская' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'bs', name: 'Bosnian', nativeName: 'Bosanski' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български' },
  { code: 'ca', name: 'Catalan', nativeName: 'Català' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文' },
  { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'et', name: 'Estonian', nativeName: 'Eesti' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'gl', name: 'Galician', nativeName: 'Galego' },
  { code: 'ka', name: 'Georgian', nativeName: 'ქართული' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar' },
  { code: 'is', name: 'Icelandic', nativeName: 'Íslenska' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'ga', name: 'Irish', nativeName: 'Gaeilge' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'kk', name: 'Kazakh', nativeName: 'Қазақша' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'lv', name: 'Latvian', nativeName: 'Latviešu' },
  { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių' },
  { code: 'mk', name: 'Macedonian', nativeName: 'Македонски' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'mt', name: 'Maltese', nativeName: 'Malti' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'mn', name: 'Mongolian', nativeName: 'Монгол' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'sr', name: 'Serbian', nativeName: 'Српски' },
  { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina' },
  { code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'cy', name: 'Welsh', nativeName: 'Cymraeg' },
  { code: 'xh', name: 'Xhosa', nativeName: 'isiXhosa' },
  { code: 'yi', name: 'Yiddish', nativeName: 'ייִדיש' },
  { code: 'zu', name: 'Zulu', nativeName: 'isiZulu' },
];

// used for user sign up initial velocity
export const DEFAULT_DEV_VELOCITY = 10;

// used for user sign up inviter confirmation
export const OMNIFLOW_INVITER_EMAIL = 'privatebeta@omniflow.team';
export const OMNIFLOW_INVITEE_MAX_COUNT = 5;
export const OMNIFLOW_INVITE_USER_CREDIT_AWARD = 200;

// plans

export const planNamesMap: Record<SubscriptionTier, string> = {
  FREE: 'Free',
  STARTER: 'Performance',
  PRO: 'Teams',
  BUSINESS: 'Scale',
  ENTERPRISE: 'Enterprise',
};

export const BITBUCKET_REDIRECT_URI =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : 'https://app.omniflow.team';

// Conversion type constants
export const PROTOTYPE_TYPE_FRONTEND = 'frontend';
export const PRODUCT_TYPE_FULLSTACK = 'fullstack';

export enum DBTYPES {
  SUPABASE = 'SUPABASE',
  NEON = 'NEON',
  POSTGRESQL = 'POSTGRESQL',
  MYSQL = 'MYSQL',
}

// Email constants
export const GENERAL_EMAIL = 'general@omniflow.team';

// Image analysis model
export const IMAGE_ANALYSIS_MODEL = 'gpt-4o-mini';

// LLM Logging Configuration
// Set ENABLE_LLM_LOGGING=true in .env to enable LLM debug logs
// By default, LLM logs are disabled to reduce console noise
export const ENABLE_LLM_LOGGING = process.env.ENABLE_LLM_LOGGING === 'true';
