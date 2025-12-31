import { IssueType, Prisma } from '@prisma/client';
import {
  DevPlan,
  Epic,
  Milestone,
  PlannedTask,
  SchedulingParameters,
  Story,
  Task,
} from '../types/schedulingTypes';
import { createMilestonePlanForSprints } from './milestoneService';
import { createSprintPlanForEpics } from './sprintService';
import { DevPlanSchema } from '../types/schedulingSchema';
import { DevPlanMetaSchema } from '../routes/types/devPlanTypes';

export function parseDevPlanContents(
  rawContents: Buffer | null | undefined,
  rawMeta: Prisma.JsonValue | null | undefined
): Readonly<{ devPlan: DevPlan; schedulingParameters: SchedulingParameters }> {
  const contents = rawContents?.length
    ? JSON.parse(rawContents.toString('utf-8'))
    : { epics: [], sprints: [], milestones: [] };
  const devPlan = DevPlanSchema.parse(contents);
  const schedulingParameters = DevPlanMetaSchema.parse(rawMeta);

  return { devPlan, schedulingParameters };
}

export async function recreateDevPlan(
  epics: Epic[],
  parameters: SchedulingParameters
): Promise<DevPlan> {
  validateEpicData(epics);
  console.log('in schedulingService.recreateDevPlan: ', epics.length);
  const sprintPlan = await createSprintPlanForEpics(epics, parameters);
  console.log(
    'in schedulingService.recreateDevPlan: Created sprint plan',
    sprintPlan.length
  );
  // append milestone planning result
  const milestonePlan = createMilestonePlanForSprints(sprintPlan, epics);
  // updateMilestonePlanAssignment(milestonePlan, milestones);
  return {
    epics,
    sprints: sprintPlan,
    milestones: milestonePlan,
  };
}

export function setEpicsDataKeyMapping(epics: ReadonlyArray<Epic>) {
  epics.forEach((epic: Epic, index: number) => {
    epic.type = IssueType.EPIC;
    epic.key = epic.key || `epic:${index + 1}`;
    epic.children.forEach((story: Story, index: number) => {
      story.type = IssueType.STORY;
      story.key = story.key || `${epic.key};story:${index + 1}`;
      story.children.forEach((task: Task, index: number) => {
        task.type = IssueType.TASK;
        task.key = task.key || `${story.key};task:${index + 1}`;
        task.sprintKey = task.sprintKey || '';
      });
    });
  });
}
export function validateEpicData(targets: ReadonlyArray<Epic | Story | Task>) {
  (targets || []).forEach((target) => {
    if ('children' in target && target.children) {
      validateEpicData(target.children); // First process the children
      target.storyPoint = target.children.reduce(
        (result, child) => result + child.storyPoint,
        0
      );
    }
  });
}

function updateMilestonePlanAssignment(
  newMilestones: ReadonlyArray<Milestone>,
  oldMilestones: ReadonlyArray<Milestone>
): void {
  const oldTasks: PlannedTask[] = [];
  oldMilestones.forEach((milestone) => {
    milestone.children.forEach((sprint) => {
      sprint.children.forEach((story) => {
        story.children.forEach((task) => oldTasks.push(task));
      });
    });
  });

  newMilestones.forEach((milestone) => {
    milestone.children.forEach((sprint) => {
      sprint.children.forEach((story) => {
        story.children.forEach((newTask) => {
          const oldTask = oldTasks.find(
            (oldTask) =>
              oldTask.name === newTask.name &&
              oldTask.description === newTask.description
          );
          if (oldTask) {
            newTask.ownerUserId = oldTask.ownerUserId;
          }
        });
      });
    });
  });
}
