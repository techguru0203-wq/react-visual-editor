import dayjs from 'dayjs';
import { EpicSprintMap } from './types';
import prisma from '../db/prisma';

import {
  IssueType,
  WorkPlanType,
  WorkPlanStatus,
  WorkPlan,
} from '@prisma/client';
import {
  Epic,
  Milestone,
  MilestoneEpic,
  Sprint,
} from '../types/schedulingTypes';

export function createMilestonePlanForSprints(
  sprints: ReadonlyArray<Sprint>,
  epics: ReadonlyArray<Epic>
): Milestone[] {
  const epicsSprintsMaps: EpicSprintMap = getEpicsSprintsMaps(sprints, epics);
  const milestones = getMilestonsForEpics(epicsSprintsMaps);
  console.log(
    'in server.services.milestoneService.createMilestonePlanForSprints: milestones:',
    JSON.stringify(milestones)
  );
  const result = dedupeSprintForMilestones(milestones, epics);
  console.log(
    'in server.services.milestoneService.createMilestonePlanForSprints.after.dedupe: milestones:',
    JSON.stringify(result)
  );
  return result;
}

function getEpicsSprintsMaps(
  sprints: ReadonlyArray<Sprint>,
  epics: ReadonlyArray<Epic>
): EpicSprintMap {
  let epicsSprintsMaps: EpicSprintMap = {};
  sprints.forEach((sprint) => {
    sprint.children.forEach((userStory) => {
      let epicName = userStory.epic;
      let epic = epicsSprintsMaps[epicName];
      if (!epic) {
        let epicKey = epics.find((e) => e.name === epicName)?.key;
        epicsSprintsMaps[epicName] = {
          key: epicKey,
          name: epicName,
          sprints: [sprint],
          storyPoint: userStory.storyPoint,
          startDate: userStory.startDate,
          endDate: userStory.endDate,
        };
      } else {
        epic.sprints.push(sprint);
        epic.storyPoint += userStory.storyPoint;
        epic.startDate =
          dayjs(userStory.startDate) > dayjs(epic.startDate)
            ? epic.startDate
            : userStory.startDate;
        epic.endDate =
          dayjs(userStory.endDate) > dayjs(epic.endDate)
            ? userStory.endDate
            : epic.endDate;
      }
    });
  });
  return epicsSprintsMaps;
}

function getMilestonsForEpics(epicsSprintsMaps: EpicSprintMap): Milestone[] {
  const milestones: Milestone[] = [];
  for (const epicName in epicsSprintsMaps) {
    if (Object.prototype.hasOwnProperty.call(epicsSprintsMaps, epicName)) {
      const epic = epicsSprintsMaps[epicName];
      let milestoneLength: number = milestones.length;
      let currentMilestone = milestones[milestoneLength - 1];
      if (
        !currentMilestone ||
        dayjs(epic.endDate).diff(currentMilestone.endDate, 'day') >= 14
      ) {
        milestones.push({
          key: `milestone:${milestoneLength + 1}`,
          name: 'Milestone ' + (milestoneLength + 1),
          storyPoint: epic.storyPoint,
          startDate: epic.startDate,
          endDate: epic.endDate,
          type: WorkPlanType.MILESTONE,
          epics: [
            {
              key: epic.key,
              name: epicName,
              storyPoint: epic.storyPoint,
              totalStoryPoint: epic.storyPoint,
              startDate: epic.startDate,
              endDate: epic.endDate,
              type: IssueType.EPIC,
            },
          ],
          children: epic.sprints,
        });
      } else {
        currentMilestone.epics.push({
          key: epic.key,
          name: epicName,
          storyPoint: epic.storyPoint,
          totalStoryPoint: epic.storyPoint,
          startDate: epic.startDate,
          endDate: epic.endDate,
          type: IssueType.EPIC,
        });
        currentMilestone.storyPoint += epic.storyPoint;
        currentMilestone.endDate = epic.endDate;
        currentMilestone.children = [
          ...new Set(currentMilestone.children.concat(epic.sprints)),
        ];
      }
    }
  }
  return milestones;
}

function dedupeSprintForMilestones(
  milestones: Milestone[],
  allEpics: ReadonlyArray<Epic>
): Milestone[] {
  const assignedSpints: Sprint[] = [];
  // One sprint can only be assigned to one milestone in timeline
  milestones.forEach((milestone) => {
    milestone.children = milestone.children.filter((sprint) => {
      if (assignedSpints.includes(sprint)) {
        return false;
      } else {
        assignedSpints.push(sprint);
        return true;
      }
    });
  });
  // now update epic and story points for each milestone
  const epicsCompletedStoryPointsInMilestones: Record<string, number> = {};
  milestones.forEach((milestone) => {
    const milestoneEpics: MilestoneEpic[] = [];
    milestone.children.sort(
      (a, b) => dayjs(a.startDate).unix() - dayjs(b.startDate).unix()
    );
    milestone.children.forEach((sprint) => {
      sprint.children.forEach((userStory) => {
        const epicName = userStory.epic;
        const epicWrapper = allEpics.find((e) => e.name === epicName);
        const milestoneEpic = milestoneEpics.find((e) => e.name === epicName);
        if (milestoneEpic) {
          // epic is already included in the milestone from another sprint
          milestoneEpic.storyPoint += userStory.storyPoint;
          milestoneEpic.startDate =
            dayjs(userStory.startDate) > dayjs(milestoneEpic.startDate)
              ? milestoneEpic.startDate
              : userStory.startDate;
          milestoneEpic.endDate =
            dayjs(userStory.endDate) > dayjs(milestoneEpic.endDate)
              ? userStory.endDate
              : milestoneEpic.endDate;
        } else {
          // epic is not included in the milestone yet
          milestoneEpics.push({
            key: epicWrapper?.key,
            name: epicName,
            storyPoint: userStory.storyPoint,
            prevStoryPoint:
              epicsCompletedStoryPointsInMilestones[epicName] || 0,
            totalStoryPoint: epicWrapper?.storyPoint,
            startDate: userStory.startDate,
            endDate: userStory.endDate,
            type: IssueType.EPIC,
          });
        }
      });
    });
    milestone.epics = [...milestoneEpics].sort(
      (a, b) => dayjs(a.startDate).unix() - dayjs(b.startDate).unix()
    );
    milestone.storyPoint = milestoneEpics.reduce((accu, epic) => {
      return accu + epic.storyPoint;
    }, 0);
    // update epicsCompletedStoryPointsInMilestones for cumulatively completed story points per epic
    milestoneEpics.forEach((epic) => {
      if (!epicsCompletedStoryPointsInMilestones[epic.name]) {
        epicsCompletedStoryPointsInMilestones[epic.name] = epic.storyPoint;
      } else {
        epicsCompletedStoryPointsInMilestones[epic.name] += epic.storyPoint;
      }
    });
  });
  return milestones;
}

export async function getMilestonesForProject(
  projectId: string
): Promise<WorkPlan[]> {
  return await prisma.workPlan.findMany({
    where: {
      projectId: projectId,
      type: WorkPlanType.MILESTONE,
      status: { not: WorkPlanStatus.CANCELED },
    },
  });
}
