import { Department, Prisma, RecordStatus } from '@prisma/client';
import { z } from 'zod';

export const VisibleUsers: Prisma.UserWhereInput = {
  status: {
    in: [RecordStatus.ACTIVE, RecordStatus.PENDING],
  },
};

export type CognitoUserAttributes = Readonly<{
  userId: string;
  email: string;
  organizationId?: string;
  initialTeamIds: ReadonlyArray<string>;
}>;

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
  role?: string;
  createdAt: Date;
  updatedAt: Date;
  subscriptionStatus?: string;
  subscriptionTier?: string;
  referralCode?: string | null;
}>;

export const UserProfileInputSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  email: z.string().email(),
  firstname: z.string(),
  lastname: z.string(),
  username: z.string(),
  department: z.nativeEnum(Department).nullish(),
  specialty: z.string().nullish(),
  velocity: z.number().nullish(),
  jiraId: z.string().nullish(),
  enableProposalGen: z.boolean().nullish(),
  sampleTaskStoryPoint: z.number().nullish(),
  documentGenerateLang: z.string().nullish(),
  referalSource: z.string().nullish(),
  neededHelp: z.string().nullish(),
});

export type InviteUserResponse = Readonly<{
  successfulEmails: string[];
  failedEmails: string[];
}>;

export const UserInviteInputSchema = z.object({
  emails: z.array(z.string()),
  initialTeamId: z.string().nullable().optional(),
});
