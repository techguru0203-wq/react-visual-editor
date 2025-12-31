import { DOCTYPE, Document, Project } from '@prisma/client';
import { z } from 'zod';

import {
  DevPlanSchema,
  EpicSchema,
  MilestoneSchema,
  PlannedStorySchema,
  PlannedTaskSchema,
  SprintSchema,
  StorySchema,
  TaskSchema,
} from './devPlanSchemas';

// Copied from /server/routes/types/devPlanTypes.ts
export type DevPlan = z.infer<typeof DevPlanSchema>;
export type Epic = z.infer<typeof EpicSchema>;
export type Story = z.infer<typeof StorySchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Milestone = z.infer<typeof MilestoneSchema>;
export type Sprint = z.infer<typeof SprintSchema>;
export type PlannedStory = z.infer<typeof PlannedStorySchema>;
export type PlannedTask = z.infer<typeof PlannedTaskSchema>;

export type DevPlanTeamMember = Readonly<{
  userId: string;
  specialty: string;
  storyPointsPerSprint: number;
}>;

export type DevPlanSpecialty = Readonly<{
  id: string;
  name: string;
  displayName: string;
}>;

export type DevPlanOutput = Readonly<
  Omit<Document, 'type' | 'meta'> &
    DevPlan & {
      type: typeof DOCTYPE.DEVELOPMENT_PLAN;
      project: Project;
      requiredSpecialties: ReadonlyArray<string>;
      chosenDocumentIds: ReadonlyArray<string>;
      weeksPerSprint: number;
      teamMembers: ReadonlyArray<DevPlanTeamMember>;
      sprintStartDate: string;
      contents?: string;
      meta?: {
        history?: string;
      };
    }
>;

// End copied code

export type DevPlanInput = DevPlan &
  Readonly<{
    weeksPerSprint: number;
    teamMembers: ReadonlyArray<DevPlanTeamMember>;
    regenerateMilestones: boolean;
    publishPlan: boolean;
  }>;

export type UpdateDevPlanArgs = DevPlanInput &
  Readonly<{
    devPlanId: string;
  }>;
