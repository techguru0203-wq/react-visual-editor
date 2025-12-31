import dayjs from 'dayjs';
import { ITeamSprintCapacity, ITeammateCapacity } from './types';
import _ from 'lodash';
import {
  WorkPlanType,
  WorkPlanStatus,
  WorkPlan,
  IssueType,
} from '@prisma/client';
import prisma from '../db/prisma';
import { Epic, SchedulingParameters, Sprint } from '../types/schedulingTypes';
import { getTaskTypeFromSpecialtyName } from '../lib/util';

export async function createSprintPlanForEpics(
  epics: ReadonlyArray<Epic>,
  parameters: SchedulingParameters
): Promise<Sprint[]> {
  let teamCapacityPerSprint = getTeamCapacityPerSprint(parameters.teamMembers);
  let totalSprints = getTotalSprints(teamCapacityPerSprint, epics);
  let sprintCapacities: ITeamSprintCapacity[] = [];
  _.range(totalSprints).forEach((i) => {
    sprintCapacities.push(_.cloneDeep(teamCapacityPerSprint));
  });
  let sprintDuration = parameters.weeksPerSprint * 7;
  let sprints: Sprint[] = sprintCapacities.map((sc, index) => {
    return {
      key: 'sprint:' + (index + 1),
      name: 'Sprint ' + (index + 1),
      storyPoint: 0,
      type: WorkPlanType.SPRINT,
      startDate: dayjs(parameters.sprintStartDate)
        .add(index * sprintDuration + (index === 0 ? 0 : 1), 'day')
        .format('MM/DD/YYYY'),
      endDate: dayjs(parameters.sprintStartDate)
        .add((index + 1) * sprintDuration, 'day')
        .format('MM/DD/YYYY'),
      children: [],
    };
  });
  console.log(
    'in server.services.sprintService.createSprintPlanForEpics: startDate:',
    parameters.sprintStartDate,
    parameters.weeksPerSprint,
    JSON.stringify(sprints)
  );
  // now start assigning tasks to sprints
  // first: we need to assign pre-assigned tasks to sprints - from user added tasks in execution or already WIP tasks
  /* TODO -- DISABLED FOR NOW - NEED TO REVISIT for SCENARIO SIMULATION
  epics.forEach((epic, epicIndex) => {
    epic.key = epic.key || `epic:${epicIndex + 1}`;
    epic.children.forEach((story, storyIndex) => {
      story.key = story.key || `${epic.key};story:${storyIndex + 1}`;
      story.children.forEach((task, taskIndex) => {
        if (!task.sprintKey) {
          return;
        }
        console.log(
          'in server.services.sprintService.createSprintPlanForEpics.preAssigned:',
          task.key,
          task.sprintKey
        );
        task.key = task.key || `${story.key};task:${taskIndex + 1}`;
        // first: find out which sprint and user has enough capacity for this task
        let assignedSprintIndex, assignedUser;
        let sprintNumber = parseInt(
          task.sprintKey?.replace('sprint:', '') as string
        );
        while (!assignedUser && sprintNumber < sprints.length) {
          [assignedSprintIndex, assignedUser] =
            findAssignedSprintAndUserForTask(task, sprintCapacities);
          if (!assignedUser) {
            console.log(
              'in server.services.sprintService.createSprintPlanForEpics.preAssigned.nextSprint:',
              task.key,
              sprintNumber
            );
            sprintNumber++;
            task.sprintKey = 'sprint:' + sprintNumber;
          }
        }
        // second: we will insert task to the right sprint and user
        if (!assignedUser) {
          console.error(
            'in server.services.sprintService.createSprintPlanForEpics.preAssigned.failure:',
            task.key
          );
          return;
        } else {
          console.log(
            'in server.services.sprintService.createSprintPlanForEpics.preAssigned.success:',
            task.key,
            assignedSprintIndex
          );
        }
        let sprint = sprints[assignedSprintIndex as number];
        assignTaskToSprint({ sprint, task, story, epic, assignedUser });
      });
    });
  });
*/
  // second: we then assign non pre-assigned tasks to sprints - from epics
  epics.forEach((epic, epicIndex) => {
    epic.key = epic.key || `epic:${epicIndex + 1}`;
    epic.children.forEach((story, storyIndex) => {
      story.key = story.key || `${epic.key};story:${storyIndex + 1}`;
      story.children.forEach((task, taskIndex) => {
        if (task.sprintKey) {
          // TODO - This line below was added to handle already assigned tasks to sprints
          // This introduces a bug where a task from LLM would sometimes has a "sprintKey" tag therefore the assignment will be skipped
          // leading to a task not being assigned to any sprint, and sprints and milestones are all empty.
          // Line 114 below was added to reset sprintKey for tasks already assigned tasks to sprints
          // This will have to be fixed when we are working on Scenario simulation
          //return;
          console.log(
            'in server.services.sprintService.createSprintPlanForEpics.preAssigned:',
            task.key,
            task.sprintKey
          );
          task.sprintKey = '';
        }
        task.type = IssueType.TASK;
        task.key = task.key || `${story.key};task:${taskIndex + 1}`;
        // first: find out which sprint and user has enough capacity for this task
        console.log(
          'in server.services.sprintService.createSprintPlanForEpics.Unassigned:',
          task.key
        );
        let assignedSprintIndex, assignedUser;
        [assignedSprintIndex, assignedUser] = findAssignedSprintAndUserForTask(
          task,
          sprintCapacities
        );
        // second: we will insert task to the right sprint and user
        if (!assignedUser) {
          console.error(
            "in server.services.sprintService.createSprintPlanForEpics.Unassigned.failure: can't find sprint and user for task:",
            task.key
          );
          return;
        } else {
          console.log(
            'in server.services.sprintService.createSprintPlanForEpics.unAssigned.success:',
            task.key,
            assignedSprintIndex
          );
        }
        let sprint = sprints[assignedSprintIndex as number];
        assignTaskToSprint({ sprint, task, story, epic, assignedUser });
      });
    });
  });
  console.log(
    'in server.services.sprintService.createSprintPlanForEpics: sprints:',
    JSON.stringify(sprints)
  );
  // trim unused sprints
  for (let i = 0; i < sprints.length; i++) {
    let s = sprints[i];
    if (s.children.length === 0) {
      sprints.splice(i, 1);
      i--;
    }
  }
  return sprints;
}

function getTeamCapacityPerSprint(
  teamMembers: SchedulingParameters['teamMembers']
): ITeamSprintCapacity {
  const teamCapacity: ITeammateCapacity[] = teamMembers.map((t) => ({
    userId: t.userId,
    skill: t.specialty,
    totalCapacity: t.storyPointsPerSprint,
    remainingCapacity: t.storyPointsPerSprint,
  }));

  const teamCapacityInSprint: ITeamSprintCapacity = teamCapacity.reduce(
    (accu: ITeamSprintCapacity, tc: ITeammateCapacity) => {
      const skill = tc.skill;
      const capacity = accu.remainingCapacity.get(skill) ?? 0;
      if (skill === 'FULLSTACK_ENGINEER') {
        // allocate fullstack capacity to frontend and backend
        accu.remainingCapacity.set(
          'Frontend',
          tc.remainingCapacity * 0.5 +
            (accu.remainingCapacity.get('Frontend') ?? 0)
        );
        accu.remainingCapacity.set(
          'Backend',
          tc.remainingCapacity * 0.5 +
            (accu.remainingCapacity.get('Backend') ?? 0)
        );
      } else {
        accu.remainingCapacity.set(
          getTaskTypeFromSpecialtyName(skill),
          tc.remainingCapacity + capacity
        );
      }
      return accu;
    },
    {
      remainingCapacity: new Map<string, number>(),
      teammates: teamCapacity,
    }
  );

  console.log(
    'in server.sprintService.getTeamCapacityPerSprint:',
    teamCapacityInSprint
  );
  return teamCapacityInSprint;
}

function findAssignedSprintAndUserForTask(
  task: any,
  sprintCapacities: ITeamSprintCapacity[]
): [number | undefined, ITeammateCapacity | undefined] {
  let { name, storyPoint, sprintKey, ownerUserId } = task;
  let taskAssigned = false;
  let assignedSprintIndex;
  let assignedUser;
  for (let i = 0; i < sprintCapacities.length; i++) {
    let sprintCapacity = sprintCapacities[i];
    if (sprintKey && parseInt(sprintKey.replace('sprint:', '')) !== i + 1) {
      console.log(
        "in server.services.sprintService.findAssignedSprintAndUserForTask: sprintKey doesn't match:",
        sprintKey,
        i + 1
      );
      // TODO - This line below was pass a task that was previously assigned to a sprint already for WIP tasks.
      // It is de-prioritized for now as we are not dealing with scenario simulation for WIP tasks.
      // This is also related to line 103 above.
      // continue;
    }
    // write a regex to extract the string between '[' and ']' from the task name
    const taskSkillType = name.match(/\[(.*?)\]/)[1];
    const capacity = sprintCapacity.remainingCapacity.get(taskSkillType);
    if (capacity && capacity >= storyPoint) {
      for (let j = 0; j < sprintCapacity.teammates.length; j++) {
        let teammate = sprintCapacity.teammates[j];
        if (ownerUserId && ownerUserId !== teammate.userId) {
          continue;
        }
        const teamSkill = getTaskTypeFromSpecialtyName(teammate.skill);
        if (
          teamSkill.includes(taskSkillType) &&
          teammate.remainingCapacity >= storyPoint
        ) {
          teammate.remainingCapacity -= storyPoint;
          sprintCapacity.remainingCapacity.set(
            taskSkillType,
            capacity - storyPoint
          );
          taskAssigned = true;
          assignedSprintIndex = i;
          assignedUser = teammate;
          break;
        }
      }
    }
    if (taskAssigned) {
      break;
    }
  }
  return [assignedSprintIndex, assignedUser];
}

function assignTaskToSprint(assignmentData: any) {
  let { sprint, task, story, epic, assignedUser } = assignmentData;
  let existStory = sprint.children.find((us: any) => us.key === story.key);
  let taskStartDateForUser = getTaskStartDateForUser(assignedUser, sprint);
  let taskEndDateForUser = dayjs(taskStartDateForUser)
    .add(Math.ceil((14 / assignedUser.totalCapacity) * task.storyPoint), 'day')
    .format('MM/DD/YYYY');
  let taskToAssign = {
    key: task.key,
    name: task.name,
    type: task.type,
    description: task.description,
    storyPoint: task.storyPoint,
    startDate: taskStartDateForUser,
    endDate: taskEndDateForUser,
    ownerUserId: assignedUser.userId,
  };
  if (!existStory) {
    sprint.children.push({
      key: story.key,
      name: story.name,
      type: story.type,
      description: story.description,
      storyPoint: task.storyPoint,
      totalStoryPoint: story.storyPoint,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      epic: epic.name,
      children: [taskToAssign],
    });
  } else {
    existStory.children.push(taskToAssign);
    existStory.storyPoint += task.storyPoint;
  }
  sprint.storyPoint += task.storyPoint;
}

function getTaskStartDateForUser(user: any, sprint: any) {
  let taskStartDate = sprint.startDate;
  for (let i = 0; i < sprint.children.length; i++) {
    let us = sprint.children[i];
    for (let j = 0; j < us.children.length; j++) {
      let issue = us.children[j];
      if (issue.ownerUserId === user.userId) {
        taskStartDate =
          dayjs(issue.endDate) > dayjs(taskStartDate)
            ? issue.endDate
            : taskStartDate;
      }
    }
  }
  return dayjs(taskStartDate)
    .add(taskStartDate === sprint.startDate ? 0 : 1, 'day')
    .format('MM/DD/YYYY');
}

function getTotalSprints(
  teamSprintCapacity: ITeamSprintCapacity,
  epics: ReadonlyArray<Epic>
): number {
  let specialtiesWithCapacity = teamSprintCapacity.remainingCapacity;

  // calculate total story points for each skill type
  let totalStoryPoints = new Map<string, number>();
  epics.forEach((epic) => {
    epic.children.forEach((story) => {
      story.children.forEach((task) => {
        let taskSkillSearch = task.name.match(/\[(.*?)\]/);
        if (taskSkillSearch && taskSkillSearch.length >= 2) {
          let taskSkillType = taskSkillSearch[1];
          let storyPoint = totalStoryPoints.get(taskSkillType);
          if (storyPoint) {
            totalStoryPoints.set(taskSkillType, storyPoint + task.storyPoint);
          } else {
            totalStoryPoints.set(taskSkillType, task.storyPoint);
          }
        }
      });
    });
  });

  console.log(
    'in server.services.sprintService.getTotalSprints: totalStoryPoints',
    totalStoryPoints
  );
  // iterate through each skill type and calculate total sprints needed
  const capacityIterator = specialtiesWithCapacity.keys();
  let totalSprints = 0;
  for (let skill of capacityIterator) {
    let capacity = specialtiesWithCapacity.get(skill) || 0;
    let workload = totalStoryPoints.get(skill) || 0;
    let sprints = Math.ceil(workload / capacity);
    totalSprints = Math.max(totalSprints, sprints);

    console.log(
      'in server.services.sprintService.getTotalSprints:',
      skill,
      capacity,
      workload,
      sprints,
      totalSprints
    );
  }

  return Math.ceil(totalSprints + 6); // add 6 more sprints for buffer and we will trim unused sprints later
}

export async function updateParentWorkplanProgress(
  workPlanId: string,
  storyPointChange: number,
  action: string
) {
  if (!workPlanId) {
    return;
  }
  let workPlan = await prisma.workPlan.findUnique({
    where: {
      id: workPlanId,
    },
  });
  if (!workPlan) {
    console.error(
      'in server.services.sprintService.updateParentWorkplanProgress: workPlan not found:'
    );
    return;
  }
  let completedStoryPoint = workPlan.completedStoryPoint || 0;
  let storyPoint = workPlan.storyPoint as number;
  switch (action) {
    case 'updateCompletedStoryPoint':
      completedStoryPoint += storyPointChange;
      break;
    case 'updateTotalStoryPoint':
      storyPoint += storyPointChange;
      break;
    case 'updateBothStoryPoint':
      completedStoryPoint += storyPointChange;
      storyPoint += storyPointChange;
      break;
    default:
      throw Error(
        'in server.services.issueService.updateParentIssueProgress, unknown action: ' +
          action
      );
  }

  let newStatus = WorkPlanStatus.STARTED as string;
  if (completedStoryPoint === workPlan.storyPoint) {
    newStatus = WorkPlanStatus.COMPLETED;
  } else if (completedStoryPoint < storyPoint) {
    newStatus = WorkPlanStatus.STARTED;
  }
  await prisma.workPlan.update({
    where: {
      id: workPlanId,
    },
    data: {
      completedStoryPoint,
      storyPoint,
      progress: storyPoint
        ? Math.floor((completedStoryPoint / storyPoint) * 100)
        : 50, // default to 50% if story point is not set
      status: <WorkPlanStatus>newStatus,
    },
  });
  if (workPlan.parentWorkPlanId) {
    await updateParentWorkplanProgress(
      workPlan.parentWorkPlanId,
      storyPointChange,
      action
    );
  }
}

export async function getSprintsForProject(
  projectId: string
): Promise<WorkPlan[]> {
  const sprints = await prisma.workPlan.findMany({
    where: {
      projectId: projectId,
      type: WorkPlanType.SPRINT,
      status: {
        in: [
          WorkPlanStatus.CREATED,
          WorkPlanStatus.STARTED,
          WorkPlanStatus.COMPLETED,
        ],
      },
    },
  });
  return sprints;
}
