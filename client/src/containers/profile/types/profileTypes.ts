import {
  Department,
  Organization,
  Prisma,
  RecordStatus,
  User,
} from '@prisma/client';

// Copied from /server/routes/types/userTypes.ts
export type UserProfile = Readonly<{
  id: string;
  organizationId: string;
  email: string;
  firstname: string;
  lastname: string;
  username: string;
  department?: Department | null;
  specialty?: string | null;
  velocity?: number | null;
  status: RecordStatus;
  meta: Prisma.JsonValue;
  jiraEnabled: boolean;
  isAdmin: boolean;
  isReferralEnabled: boolean;
  role?: string;
  createdAt: Date;
  updatedAt: Date;
  subscriptionStatus: string;
  subscriptionTier: string;
  referralCode?: string | null;
  organization?: Partial<Organization> & { users: ReadonlyArray<User> };
}>;

export type UserProfileInput = Omit<
  UserProfile,
  | 'pending'
  | 'status'
  | 'meta'
  | 'createdAt'
  | 'updatedAt'
  | 'jiraEnabled'
  | 'isAdmin'
> & {
  jiraId?: string | null;
  enableProposalGen?: boolean | null;
  sampleTaskStoryPoint?: number | null;
  documentGenerateLang?: string | null;
  referalSource?: string | null;
  neededHelp?: string | null;
  language?: string | null;
};

// copied from /server/routes/types/userTypes.ts
export type InviteUserResponse = Readonly<{
  successfulEmails: string[];
  failedEmails: string[];
}>;

export type InviteUserInput = Readonly<{
  emails: string[];
  initialTeamId?: string;
}>;

export enum Specialization {
  PRODUCT_MANAGEMENT = 'Product Management',
  UI_DESIGN = 'UI Design',
  FRONTEND_ENGINEER = 'Frontend Engineer',
  BACKEND_ENGINEER = 'Backend Engineer',
  FULLSTACK_ENGINEER = 'Fullstack Engineer',
  MOBILE_ENGINEER_IOS = 'Mobile Engineer - iOS',
  MOBILE_ENGINEER_ANDROID = 'Mobile Engineer - Android',
  INFRA_ENGINEER = 'Infra Engineer',
  QA_ENGINEER = 'QA Engineer',
  ML_ENGINEER = 'ML Engineer',
  DATA_ENGINEER = 'Data Engineer',
  OTHERS = 'Others',
  /***
   * The following specializations are not yet implemented in the client/server. We will add them later.
   */
  // INFRA_ENGINEER = 'Infra Engineer',
  // DATA_ENGINEER = 'Data Engineer',
  // ML_ENGINEER = 'ML Engineer',
  // DATA_SCIENTIST = 'Data Scientist',
  // QA_ENGINEER = 'QA Engineer',
  // RELEASE_ENGINEER = 'Release Engineer',
}
