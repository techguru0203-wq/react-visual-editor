import { IssueType, WorkPlanType } from '@prisma/client';
import { z } from 'zod';

export const TaskSchema = z.object({
  key: z.string().nullable().optional().describe('Key of the task'),
  name: z.string().describe('Name of the task'),
  description: z.string().nullable().optional().describe('Description of the task'),
  type: z
    .string()
    .transform(() => IssueType.TASK as string)
    .describe('Type of task'),
  storyPoint: z.number().describe('Total story points of the task'),
  sprintKey: z.string().nullable().optional().describe('Key of the sprint'),
});

export const PlannedTaskSchema = TaskSchema.extend({
  startDate: z.string().describe('Start date of the task'),
  endDate: z.string().describe('End date of the task'),
  ownerUserId: z.string().describe('User ID of the task owner'),
}).describe(
  'an issue for this user story that assigned to this sprint for this user '
);

export const StorySchema = z.object({
  key: z.string().nullable().optional().describe('Key of the story'),
  name: z.string().describe('Name of the user story'),
  description: z.string().nullable().optional().describe('Description of the user story'),
  type: z
    .string()
    .transform(() => IssueType.STORY as string)
    .describe('Type of story'),
  storyPoint: z
    .number()
    .describe('Total story points for all tasks in this story'),
  children: z
    .array(TaskSchema)
    .describe('Tasks break down for this user story'),
});

export const PlannedStorySchema = StorySchema.extend({
  storyPoint: z
    .number()
    .describe('Story points of the user story completed in this sprint'),
  totalStoryPoint: z.number().describe('Total story points of the user story'),
  startDate: z.string().describe('Start date of the user story'),
  endDate: z.string().describe('End date of the user story'),
  epic: z.string().describe('Name of the epic the user story belongs to'),
  children: z
    .array(PlannedTaskSchema)
    .describe(
      'Issues for the user story assigned for this user story in this sprint'
    ),
});

export const EpicSchema = z.object({
  key: z.string().nullable().optional().describe('Key of the epic'),
  name: z.string().describe('Name of the epic'),
  type: z
    .string()
    .transform(() => IssueType.EPIC as string)
    .describe('Type of the epic'),
  storyPoint: z
    .number()
    .describe(
      'Total story points of the epic as sum of story points for all user stories in the epic'
    ),
  children: z.array(StorySchema).describe('All user stories for this epic'),
});

export const MilestoneEpicSchema = EpicSchema.omit({ children: true }).extend({
  storyPoint: z
    .number()
    .describe('Story points of the epic completed in this milestone'),
  prevStoryPoint: z
    .number()
    .nullable().optional()
    .describe('Story points of this epic completed in all previous milestones'),
  totalStoryPoint: z
    .number()
    .nullable().optional()
    .describe('Total story points of the epic'),
  startDate: z.string().describe('Start date of the epic'),
  endDate: z.string().describe('End date of the epic'),
});

export const SprintSchema = z
  .object({
    key: z.string().describe('Key of the sprint'),
    name: z.string().describe('Name of the sprint'),
    type: z.string().default(WorkPlanType.SPRINT).describe('Type of sprint'),
    storyPoint: z.number().describe('Total story points of the sprint'),
    startDate: z.string().describe('Start date of the sprint'),
    endDate: z.string().describe('End date of the sprint'),
    children: z
      .array(PlannedStorySchema)
      .describe('User Stories assigned for the sprint'),
  })
  .describe('One Sprint info');

export const MilestoneSchema = z
  .object({
    key: z.string().describe('Key of the milestone'),
    name: z.string().describe('Name of the milestone'),
    type: z
      .string()
      .default(WorkPlanType.MILESTONE)
      .describe('Type of milestone'),
    storyPoint: z
      .number()
      .describe(
        'Total story points of the milestone as sum as story points of all sprints in the milestone'
      ),
    startDate: z.string().describe('Start date of the milestone'),
    endDate: z.string().describe('End date of the milestone'),
    epics: z
      .array(MilestoneEpicSchema)
      .describe('Epics completed for the milestone'),
    children: z.array(SprintSchema).describe('Sprints for the milestone'),
  })
  .describe('One Milestone info for the project');

export const DevPlanSchema = z.object({
  epics: z.array(EpicSchema).describe('All epics for this project'),
  sprints: z.array(SprintSchema),
  milestones: z.array(MilestoneSchema).describe('Milestones for this project'),
});
