// Copying this from /shared for now - we need to set up a proper import
// Webpack will not let me import items from outside of /client/src
export const ErrorMessage = {
  NOT_ENOUGH_CAPACITY_BACKEND: 'NOT_ENOUGH_CAPACITY_BACKEND',
  NOT_ENOUGH_CAPACITY_FRONTEND: 'NOT_ENOUGH_CAPACITY_FRONTEND',
  NOT_ENOUGH_CAPACITY_ANDROID: 'NOT_ENOUGH_CAPACITY_ANDROID',
  NOT_ENOUGH_CAPACITY_IOS: 'NOT_ENOUGH_CAPACITY_IOS',
};

export const SampleTask = `Implement a feature to allow users to update their profile, like the page you are seeing. 

Description: 1) Add a UI form to display user's current profile with firstname, lastname, username. 2) Build backend logic to save the updated info. 3) Redirect the page to home page when done.
Acceptance Criteria: 1) Users can see their current profile information. 2) Users can successfully update their name, and username. 3) Changes are saved to the database.`;

export const getSampleTask = (t: (key: string) => string) =>
  t('app.sampleTask');

export const DefaultSampleTaskStoryPoint = 2;
export const DefaultDocumentGenerateLang = 'en';

export const FREE_PROJECT_LIMIT = 3;

export const STARTER_PLAN_PROJECT_LIMIT_PER_WEEK = 3;

export const SubscriptionTierIndex: Record<string, number> = {
  FREE: -1,
  STARTER: 0,
  PRO: 1,
  BUSINESS: 2,
  ENTERPRISE: 3,
};

// COPIED FROM SERVER llmService/llmUtil.ts
export const GenerationMinimumCredit = 100;
export const USER_MAX_CREDITS_PER_MONTH = 5000;

export const DEFAULT_DOCUMENT_PERMISSION = 'VIEW';
export const DEFAULT_PROJECT_PERMISSION = 'VIEW';

// AI Agent sample inputs (legacy - use getAIAgentIntroMessage instead)
export const AIAgentIntroMessage: Record<string, string> = {
  PRD: `👋 I'm Joy, your AI assistant. To start, you may pick a sample prompt, upload local files, or link other documents to create a PRD below.`,
  PROTOTYPE: `👋 I'm Joy, your AI assistant. To start, you may pick a sample prompt, link other PRDs or chat with me below to create a prototype.`,
  UI_DESIGN: `👋 I'm Joy, your AI assistant. I can help you brainstorm ideas, answer questions, create documents or apps of your need.`,
  TECH_DESIGN: `👋 I'm Joy, your AI assistant. I can help you craft technical design for your product.`,
  DEVELOPMENT_PLAN: `👋 I'm Joy, your AI assistant. I can help you brainstorm ideas, answer questions, create documents or apps of your need.`,
  QA_PLAN: `👋 I'm Joy, your AI assistant. I can help you brainstorm ideas, answer questions, create documents or apps of your need.`,
  RELEASE_PLAN: `👋 I'm Joy, your AI assistant. I can help you brainstorm ideas, answer questions, create documents or apps of your need.`,
  BUSINESS: `👋 I'm Joy, your AI assistant. I can help you brainstorm ideas, answer questions, create documents or apps of your need.`,
  PRODUCT: `👋 I'm Joy, your AI assistant. I can help you create a full-stack product. You can start chatting with me in the chatbox below.`,
  ENGINEERING: `👋 I'm Joy, your AI assistant. I can help you brainstorm ideas, answer questions, create documents or apps of your need.`,
  MARKETING: `👋 I'm Joy, your AI assistant. I can help you brainstorm ideas, answer questions, create documents or apps of your need.`,
  SALES: `👋 I'm Joy, your AI assistant. I can help you brainstorm ideas, answer questions, create documents or apps of your need.`,
  SUPPORT: `👋 I'm Joy, your AI assistant. I can help you brainstorm ideas, answer questions or create documents of your need.`,
  CHAT: `👋 I'm Joy, your AI assistant. I can help you brainstorm ideas, answer questions or discuss anything of your interest.`,
};

// AI Agent intro messages with internationalization support
export const getAIAgentIntroMessage = (
  docType: string,
  t: (key: string) => string
): string => {
  const keyMap: Record<string, string> = {
    PRD: 'aiAgent.prd',
    PROTOTYPE: 'aiAgent.prototype',
    UI_DESIGN: 'aiAgent.uiDesign',
    TECH_DESIGN: 'aiAgent.techDesign',
    DEVELOPMENT_PLAN: 'aiAgent.developmentPlan',
    QA_PLAN: 'aiAgent.qaPlan',
    RELEASE_PLAN: 'aiAgent.releasePlan',
    BUSINESS: 'aiAgent.business',
    PRODUCT: 'aiAgent.product',
    ENGINEERING: 'aiAgent.engineering',
    MARKETING: 'aiAgent.marketing',
    SALES: 'aiAgent.sales',
    SUPPORT: 'aiAgent.support',
    CHAT: 'aiAgent.chat',
  };

  const translationKey = keyMap[docType];
  return translationKey
    ? t(translationKey)
    : AIAgentIntroMessage[docType] || t('aiAgent.uiDesign');
};

// AI Agent sample inputs (legacy - use getAIAgentSampleInputs instead)
export const AIAgentSampleInputs: Record<string, string[]> = {
  PRD: ['Build a web app that...', 'Add a feature that...'],
  PROTOTYPE: ['Build a web app that...', 'Add a feature that...'],

  UI_DESIGN: [
    'We want to support all key feature requirements defined in the selected Omniflow PRD document. Please create a UI design wireframe for it.',
  ],
  TECH_DESIGN: [
    'We want to support all key feature requirements defined in the selected Omniflow PRD document. Please use microservices architecture, and modern stack such as ReactJS, NodeJS, and LLM models. Please help us write a technical design.',
    // 'We want to build slack integration to the Omniflow app. Can you create an architecture how to do it?',
  ],
  DEVELOPMENT_PLAN: [],
  QA_PLAN: [
    'Please create a QA test plan for the selected product requirement document.',
  ],
  RELEASE_PLAN: [
    'Please create a release plan based on the selected product requirement document.',
  ],
  BUSINESS: [],
  PRODUCT: [],
  ENGINEERING: [],
  MARKETING: [],
  SALES: [],
  SUPPORT: [],
  CHAT: [
    'I would like to build a new AI app to automate my product development life cycle. Can you share some tips on it?',
    'I want to start a project to achieve SOC 2 Compliance for our product. How can I go about doing that?',
  ],
};

// AI Agent sample inputs with internationalization support
export const getAIAgentSampleInputs = (
  docType: string,
  t: (key: string) => string
): string[] => {
  const sampleInputMap: Record<string, string[]> = {
    PRD: [
      t('samplePrompts.prd.buildWebApp'),
      t('samplePrompts.prd.addFeature'),
    ],
    PROTOTYPE: [
      t('samplePrompts.prototype.buildWebApp'),
      t('samplePrompts.prototype.addFeature'),
    ],
    UI_DESIGN: [t('samplePrompts.uiDesign.createWireframe')],
    TECH_DESIGN: [t('samplePrompts.techDesign.createTechnicalDesign')],
    DEVELOPMENT_PLAN: [],
    QA_PLAN: [t('samplePrompts.qaPlan.createTestPlan')],
    RELEASE_PLAN: [t('samplePrompts.releasePlan.createReleasePlan')],
    BUSINESS: [],
    PRODUCT: [],
    ENGINEERING: [],
    MARKETING: [],
    SALES: [],
    SUPPORT: [],
    CHAT: [
      t('samplePrompts.chat.buildAIApp'),
      t('samplePrompts.chat.soc2Compliance'),
    ],
  };

  return sampleInputMap[docType] || AIAgentSampleInputs[docType] || [];
};

export const viewOnlyMessage = 'You are currently in View Only mode';

export const getViewOnlyMessage = (t: (key: string) => string) =>
  t('app.viewOnlyMode');

// Translate status values
export const translateStatusValue = (
  status: string,
  t: (key: string) => string
): string => {
  const statusKey = `status.${status.toLowerCase()}`;
  return t(statusKey) !== statusKey ? t(statusKey) : status;
};

// Translate issue/project status values specifically
export const translateIssueStatus = (
  status: string,
  t: (key: string) => string
): string => {
  const statusMap: Record<string, string> = {
    CREATED: t('status.created'),
    STARTED: t('status.started'),
    COMPLETED: t('status.completed'),
    CANCELED: t('status.canceled'),
    INREVIEW: t('status.inreview'),
    APPROVED: t('status.approved'),
    GENERATING: t('status.generating'),
    OVERWRITTEN: t('status.overwritten'),
    ACTIVE: t('status.active'),
    INACTIVE: t('status.inactive'),
  };

  return statusMap[status] || status;
};

// Get translated issue status options for dropdowns
export const getIssueStatusOptions = (t: (key: string) => string) => [
  {
    value: 'CREATED',
    label: t('status.created'),
  },
  {
    value: 'STARTED',
    label: t('status.started'),
  },
  {
    value: 'INREVIEW',
    label: t('status.inreview'),
  },
  {
    value: 'APPROVED',
    label: t('status.approved'),
  },
  {
    value: 'COMPLETED',
    label: t('status.completed'),
  },
  {
    value: 'CANCELED',
    label: t('status.canceled'),
  },
];

// Translate project plan status values
export const translateProjectPlanStatus = (
  status: string,
  t: (key: string) => string
): string => {
  const statusMap: Record<string, string> = {
    'Not Started': t('status.notStarted'),
    'In Progress': t('status.inProgress'),
    Published: t('status.published'),
  };

  return statusMap[status] || status;
};

// Translate project access levels
export const translateProjectAccess = (
  access: string,
  t: (key: string) => string
): string => {
  const accessMap: Record<string, string> = {
    SELF: t('project.self'),
    ORGANIZATION: t('project.organization'),
    TEAM: t('project.team'),
  };

  return accessMap[access] || access;
};

// Get translated project access options for dropdowns
export const getProjectAccessOptions = (t: (key: string) => string) => [
  {
    value: 'SELF',
    label: t('project.self'),
  },
  {
    value: 'ORGANIZATION',
    label: t('project.organization'),
  },
  {
    value: 'TEAM',
    label: t('project.team'),
  },
];

// Translate status messages from backend
export const translateStatusMessage = (
  statusKey: string,
  t: (key: string) => string
): string => {
  // Handle direct status keys that are sent from backend
  if (statusKey === 'deploying.app' || statusKey === 'polishing.app') {
    return t(statusKey);
  }

  // Handle dynamic document deployment status
  if (statusKey.startsWith('deploying.document.')) {
    return t(statusKey);
  }

  // Handle other status messages sent from backend
  if (
    statusKey === 'Deployment complete' ||
    statusKey === 'Deployment failed. Please check the logs and try again.' ||
    statusKey === 'Build error. Please retry.'
  ) {
    return t(statusKey);
  }

  // Handle dynamic deployment failed messages with retry count
  if (
    statusKey.includes(
      'Deployment failed. Analyzing errors and attempting fix...'
    )
  ) {
    // For now, return the English message as it contains dynamic retry count
    return statusKey;
  }

  // Fallback to original message
  return statusKey;
};

// Organizations allowed for full-stack app generation
export const ORGANIZATION_IDS_FOR_FULLSTACK_GEN = [
  // 'willyCo',
  // 'willyCompany',
  'cm9uc38gj004amv1mq5a1x1cq', // psyflow
  'a47a8a0a-a66a-4903-8497-3dd5bf14c471', // Zixiao Organization
  'cmcdmeqpc001a2wts520shocd', // Gohealth
];

// Prototype conversion type constants
// Conversion type constants
export const PROTOTYPE_TYPE_FRONTEND = 'frontend';
export const PRODUCT_TYPE_FULLSTACK = 'fullstack';
export const S3_PUBLIC_ASSET = 'public_asset';

// Reserved system environment variable names (copied from shared/constants.ts)
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
