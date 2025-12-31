import {
  Document,
  Issue,
  IssueStatus,
  IssueType,
  Prisma,
  Project,
  User,
  WorkPlan,
} from '@prisma/client';
import { DevPlan } from '../../types/schedulingTypes';
import { z } from 'zod';
import { DevPlanSchema } from '../../types/schedulingSchema';

export const VisibleIssues: Prisma.IssueWhereInput = {
  OR: [
    {
      type: IssueType.BUILDABLE,
      status: { not: { in: [IssueStatus.OVERWRITTEN] } },
    },
    {
      type: { not: IssueType.BUILDABLE },
      status: { not: IssueStatus.OVERWRITTEN },
    },
  ],
};

export const IssueOutputInclude = {
  documents: true,
  owner: true,
  parentIssue: true,
  project: true,
  workPlan: true,
} satisfies Prisma.IssueInclude;
export type IssueOutput = Prisma.IssueGetPayload<{
  include: typeof IssueOutputInclude;
}>;

export type IssueSuggestionOutput = Readonly<{
  newDevPlan: DevPlan;
  oldDevPlan: DevPlan;
  deliveryImpact: any; // TODO: Add delivery impact typing
  devPlanDocId?: string | null;
}>;

// TODO: These should be split into separate APIs in future
export const AddAndPublishIssueInputSchema = z.discriminatedUnion('target', [
  z.object({
    target: z.literal('backlog'),
    projectId: z.string(),
    issueName: z.string(),
  }),
  z.object({
    target: z.literal('milestone'),
    projectId: z.string(),
    devPlanDocId: z.string(),
    devPlan: DevPlanSchema,
  }),
]);
export type AddAndPublishIssueInput = z.infer<
  typeof AddAndPublishIssueInputSchema
>;

export type IssueChangeHistoryOutput = Prisma.IssueChangeHistoryGetPayload<{}>;
