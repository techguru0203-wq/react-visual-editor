import { Access, IssueStatus, TemplateAccess } from '@prisma/client';

const api_base_url: Record<string, string> = {
  local: 'http://localhost:9000',
  prod: '',
};

export const api_url =
  process.env.NODE_ENV === 'development'
    ? api_base_url.local
    : api_base_url.prod;

export const workplanStatus = [
  {
    value: 'CREATED',
    label: 'Created',
  },
  {
    value: 'STARTED',
    label: 'Started',
  },
  {
    value: 'COMPLETED',
    label: 'Completed',
  },
];
export const issueStatus = [
  {
    value: 'CREATED',
    label: 'Created',
  },
  {
    value: 'STARTED',
    label: 'Started',
  },
  {
    value: 'INREVIEW',
    label: 'Code Review',
  },
  {
    value: 'APPROVED',
    label: 'QA',
  },
  {
    value: 'COMPLETED',
    label: 'Completed',
  },
  {
    value: 'CANCELED',
    label: 'Canceled',
  },
];

export const DatabaseType = {
  SUPABASE: 'supabase',
  NEON: 'neon',
};

export const issueStatusToEnum: { [key: string]: IssueStatus } = {
  CREATED: IssueStatus.CREATED,
  STARTED: IssueStatus.STARTED,
  INREVIEW: IssueStatus.INREVIEW,
  APPROVED: IssueStatus.APPROVED,
  COMPLETED: IssueStatus.COMPLETED,
  CANCELED: IssueStatus.CANCELED,
};

export const DEFAULT_QUERY_STALE_TIME = 60000;

export const GenerationMinimumCredit = 100;
export const USER_MAX_CREDITS_PER_MONTH = 5000;

export const COLORS = {
  PRIMARY: '#5345F3',
  GRAY: '#8B8D97',
  ICON_GRAY: '#000000e0',
  LIGHT_GRAY: '#F3F3F3',
  PURPLE: '#5428BD',
  LIGHT_PINK: '#F5EBFF',
  WHITE: '#FFF',
  COLOR_ANTD_BORDER: '#D9D9D9',
  YELLOW: '#FDDA0D',
};

export const SUBSCRIPTIONTIERS = {
  FREE: 'FREE',
  STARTER: 'STARTER',
  PROFESSIONAL: 'PRO',
  BUSINESS: 'BUSINESS',
  ENTERPRISE: 'ENTERPRISE',
};

// Seat limits for each subscription tier
export const TIER_SEAT_LIMITS: Record<string, number> = {
  [SUBSCRIPTIONTIERS.FREE]: 1,
  [SUBSCRIPTIONTIERS.STARTER]: 1,
  [SUBSCRIPTIONTIERS.PROFESSIONAL]: 20,
  [SUBSCRIPTIONTIERS.BUSINESS]: 100,
  [SUBSCRIPTIONTIERS.ENTERPRISE]: 1000000,
};

export const SUBSCRIPTIONTIERSDISPLAYNAME: Record<string, string> = {
  FREE: 'Free',
  STARTER: 'Performance',
  PRO: 'Teams',
  BUSINESS: 'Scale',
  ENTERPRISE: 'ENTERPRISE',
};

export const SUBSCRIPTIONSTATUS = {
  ACTIVE: 'ACTIVE',
  CANCELED: 'CANCELED',
  PAST_DUE: 'PAST_DUE',
  UNPAID: 'UNPAID',
};

export const documentPermissionTypes = [
  {
    value: 'VIEW',
    label: 'View',
  },
  {
    value: 'EDIT',
    label: 'Edit',
  },
];

export const documentPermissionOptions = [
  {
    value: 'VIEW',
    label: 'View',
  },
  {
    value: 'EDIT',
    label: 'Edit',
  },
];

export const projectPermissionTypes = [
  {
    value: 'VIEW',
    label: 'View',
  },
  {
    value: 'EDIT',
    label: 'Edit',
  },
];

export const projectPermissionOptions = [
  {
    value: 'VIEW',
    label: 'View',
  },
  {
    value: 'EDIT',
    label: 'Edit',
  },
];

export const generalAccessOptions = Object.values(Access).map((value) => {
  return {
    value,
    label: value.toLocaleLowerCase(),
  };
});

export const templateAccessOptions = Object.values(Access).map((value) => {
  return {
    value,
    label: value.toLocaleLowerCase(),
  };
});

export const DEFAULT_DOCUMENT_ACCESS = TemplateAccess.SELF;
export const DEFAULT_PROJECT_ACCESS = TemplateAccess.SELF;

export const DEFAULT_PAGE_LIMIT = 18;

export const GenerateDocTypeToEventNameMap: Record<string, string> = {
  PRD: 'generatePRD',
  PROTOTYPE: 'generatePrototype',
  PRODUCT: 'generateProduct',
  TECH_DESIGN: 'generateTechDesign',
  DEVELOPMENT_PLAN: 'generateDevPlan',
  QA_PLAN: 'generateQAPlan',
  RELEASE_PLAN: 'generateReleasePlan',
};

export const UpdateDocTypeToEventNameMap: Record<string, string> = {
  PRD: 'updatePRD',
  PROTOTYPE: 'updatePrototype',
  PRODUCT: 'updateProduct',
  TECH_DESIGN: 'updateTechDesign',
  DEVELOPMENT_PLAN: 'updateDevPlan',
  QA_PLAN: 'updateQAPlan',
  RELEASE_PLAN: 'updateReleasePlan',
};
