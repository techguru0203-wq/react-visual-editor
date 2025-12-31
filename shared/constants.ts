export const ErrorMessage = {
  NOT_ENOUGH_CAPACITY_BACKEND: 'NOT_ENOUGH_CAPACITY_BACKEND',
  NOT_ENOUGH_CAPACITY_FRONTEND: 'NOT_ENOUGH_CAPACITY_FRONTEND',
  NOT_ENOUGH_CAPACITY_ANDROID: 'NOT_ENOUGH_CAPACITY_ANDROID',
  NOT_ENOUGH_CAPACITY_IOS: 'NOT_ENOUGH_CAPACITY_IOS',
  NOT_ENOUGH_CAPACITY_QA: 'NOT_ENOUGH_CAPACITY_QA',
  NOT_ENOUGH_CAPACITY_INFRA: 'NOT_ENOUGH_CAPACITY_INFRA',
  NOT_ENOUGH_CAPACITY_ML: 'NOT_ENOUGH_CAPACITY_ML',
  NOT_ENOUGH_CAPACITY_DATA: 'NOT_ENOUGH_CAPACITY_DATA',
};

export const SampleTask = `Implement a feature to allow users to update their profile, like the page you are seeing. 

Description: 1) Add a UI form to display user's current profile with firstname, lastname, username. 2) Build backend logic to save the updated info. 3) Redirect the page to home page when done.
Acceptance Criteria: 1) Users can see their current profile information. 2) Users can successfully update their name, and username. 3) Changes are saved to the database.`;

interface Map {
  [key: string]: string | undefined;
}

export const SpecialtyToIssueType: Map = {
  PRODUCT_MANAGEMENT: 'Product',
  UI_DESIGN: 'UI/UX',
  FULLSTACK_ENGINEER: 'Fullstack',
  FRONTEND_ENGINEER: 'Frontend',
  BACKEND_ENGINEER: 'Backend',
  MOBILE_ENGINEER_IOS: 'iOS',
  MOBILE_ENGINEER_ANDROID: 'Android',
  MOBILE_ENGINEER_WINDOWS: 'Windows',
  INFRA_ENGINEER: 'Infra',
  QA_ENGINEER: 'QA',
  ML_ENGINEER: 'ML',
  DATA_ENGINEER: 'DE',
  RELEASE_ENGINEER: 'Release',
  DATA_SCIENTIST: 'DS',
};

export const CLIENT_BASE_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : 'https://app.omniflow.team';

export const SERVER_BASE_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:9000'
    : 'https://app.omniflow.team';

export const DefaultSampleTaskStoryPoint = 2;
export const DefaultStoryPointsPerSprint = 10;
export const DefaultWeeksPerSprint = 2;

export const MessageLimit = 10;

// Claude Sonnet 4 pricing
export const CLAUDE_SONNET_4_PROMPT_PRICE = 3.0; // $3.00 per 1M tokens
export const CLAUDE_SONNET_4_CACHE_WRITE_PRICE = 3.75; // $3.75 per 1M tokens
export const CLAUDE_SONNET_4_CACHE_READ_PRICE = 0.3; // $0.30 per 1M tokens
export const CLAUDE_SONNET_4_COMPLETION_PRICE = 15.0; // $15.00 per 1M tokens

// Claude Sonnet 4.5 pricing
export const CLAUDE_SONNET_4_5_PROMPT_PRICE = 3.0; // $3.00 per 1M tokens
export const CLAUDE_SONNET_4_5_CACHE_WRITE_PRICE = 3.75; // $3.75 per 1M tokens
export const CLAUDE_SONNET_4_5_CACHE_READ_PRICE = 0.3; // $0.30 per 1M tokens
export const CLAUDE_SONNET_4_5_COMPLETION_PRICE = 15.0; // $15.00 per 1M tokens

export const GPT4O_MINI_PROMPT_PRICE = 0.15; // $0.15 per 1M tokens
export const GPT4O_MINI_CACHE_READ_PRICE = 0.075; // $0.075 per 1M tokens
export const GPT4O_MINI_COMPLETION_PRICE = 0.6; // $0.6 per 1M tokens

export const GPT4O_PROMPT_PRICE = 2.5; // $2.50 per 1M tokens
export const GPT4O_COMPLETION_PRICE = 10.0; // $10.00 per 1M tokens

export const WHISPER_COMPLETION_PRICE = 1.0; // $1 per 1M tokens, 1 second = 100 tokens

export const GEMINI_FLASH_PROMPT_PRICE = 0.3; // $0.3 per 1M tokens
export const GEMINI_FLASH_COMPLETION_PRICE = 2.5; // $2.5 per 1M tokens

export const GEMINI_PRO_PROMPT_PRICE = 1.25; // $1.25 per 1M tokens
export const GEMINI_PRO_COMPLETION_PRICE = 10; // $10per 1M tokens

export const GPT_5_PROMPT_PRICE = 1.25; // $1.25 per 1M tokens
export const GPT_5_COMPLETION_PRICE = 10; // $10 per 1M tokens

// deduct credits:
// 1 credit = $0.001 / 2  -> 50% margin
// 1 credit = $0.001 / 2.5  -> 60% margin
// 1 credit = $0.001 / 3  -> 67% margin
// 1 credit = $0.001 / 4  -> 75% margin
export const OmniflowCreditToCostConversion = 0.001 / 2;

// Reserved system environment variable names
export const RESERVED_ENV_VAR_NAMES = [
  'DATABASE_URL',
  'JWT_SECRET',
  'LLM_MODEL_NAME',
  'OMNIFLOW_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'EMAIL_PROVIDER',
  'EMAIL_HOST',
  'EMAIL_PORT',
  'EMAIL_SECURE',
  'EMAIL_USER',
  'EMAIL_PASSWORD',
  'EMAIL_FROM',
  'ADMIN_EMAIL',
  'SENDGRID_API_KEY',
  'MAILGUN_API_KEY',
  'MAILGUN_DOMAIN',
  'RESEND_API_KEY',
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'FRONTEND_URL',
] as const;
