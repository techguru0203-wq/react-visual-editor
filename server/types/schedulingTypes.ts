import { z } from 'zod';
import {
  DevPlanSchema,
  EpicSchema,
  MilestoneEpicSchema,
  MilestoneSchema,
  PlannedStorySchema,
  PlannedTaskSchema,
  SprintSchema,
  StorySchema,
  TaskSchema,
} from './schedulingSchema';

export type DevPlan = z.infer<typeof DevPlanSchema>;

export type Epic = z.infer<typeof EpicSchema>;
export type Story = z.infer<typeof StorySchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Milestone = z.infer<typeof MilestoneSchema>;
export type MilestoneEpic = z.infer<typeof MilestoneEpicSchema>;
export type Sprint = z.infer<typeof SprintSchema>;
export type PlannedStory = z.infer<typeof PlannedStorySchema>;
export type PlannedTask = z.infer<typeof PlannedTaskSchema>;

export type SchedulingParameters = Readonly<{
  weeksPerSprint: number;
  teamMembers: ReadonlyArray<{
    userId: string;
    specialty: string;
    storyPointsPerSprint: number;
  }>;
  requiredSpecialties: ReadonlyArray<string>;
  chosenDocumentIds: ReadonlyArray<string>;
  sprintStartDate: string;
}>;
