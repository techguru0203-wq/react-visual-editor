import { IssueStatus, IssueType, Prisma, WorkPlanType } from '@prisma/client';
import { ICreateIssueWorkPlanInput, INameToIDMap } from './types';
import prisma from '../db/prisma';
import { IAddIssueInput } from '../routes/types/entityType';
import { addIssue } from './llmService/addIssue';
import { DevPlan, Epic } from '../types/schedulingTypes';

export async function createWorkPlanAndIssues(
  input: ICreateIssueWorkPlanInput
) {
  const { projectId } = input;
  const { milestones, sprints, epics, userStories, tasks } =
    parseDataRecords(input);

  let projectStoryPoints = 0;

  let project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  // use a issue index serial number here to make batch generating short name faster
  // may do a performance test compare to generateRandomIssueId when i have time.
  let issueStartIndex =
    (await prisma.issue.count({
      where: { projectId: projectId },
    })) * 2;

  // 1: create WorkPlan for milestones
  const milestoneNameToIDMap = await createMilestones(milestones);

  // 2: update sprints parentWorkPlanId, and create sprints
  sprints.forEach((s) => {
    s.parentWorkPlanId = milestoneNameToIDMap[s.parentWorkPlanId as string];
    projectStoryPoints += s.storyPoint || 0;
    s.organizationId = project?.organizationId;
  });
  const sprintNameToIdMap = await createSprints(sprints);

  // 3: update epic workplanId with actual milestone id, and create epics
  epics.forEach((e) => {
    e.workPlanId = milestoneNameToIDMap[e.workPlanId as string];
  });
  const epicNameToIdMap = await createEpics(
    project!.shortName,
    issueStartIndex,
    epics
  );
  issueStartIndex += epics.length;

  // 4: update user story workPlanId with actual sprint id, parentIssueId with epic id, and create user story
  userStories.forEach((u) => {
    // console.log('in server.services.issueService.stories:', u);
    u.workPlanId = sprintNameToIdMap[u.workPlanId as string];
    u.parentIssueId = epicNameToIdMap[u.parentIssueId as string];
  });
  const userStoryNameToIdMap = await createStoryOrTasks(
    project!.shortName,
    issueStartIndex,
    userStories
  );
  issueStartIndex += userStories.length;

  // 5: update task workPlanId with actual sprint id, parentIssueId with user story id, and create task
  tasks.forEach((t) => {
    // console.log('in server.services.issueService.tasks:', t);
    t.workPlanId = sprintNameToIdMap[t.workPlanId as string];
    t.parentIssueId = userStoryNameToIdMap[t.parentIssueId as string];
  });
  // 6: create stories and tasks
  await createStoryOrTasks(project!.shortName, issueStartIndex, tasks);
  issueStartIndex += tasks.length;

  // 7: update project with story point
  await prisma.project.update({
    where: {
      id: projectId,
    },
    data: {
      storyPoint: projectStoryPoints,
    },
  });
}

async function createStoryOrTasks(
  projectShortName: string,
  issueStartIndex: number,
  issueData: Prisma.IssueUncheckedCreateInput[]
) {
  console.log('in server.services.issueService.createStoryOrTasks:', issueData);
  let issuesCreated;
  try {
    issuesCreated = await Promise.all(
      issueData.map(async (data) => {
        issueStartIndex += 1;
        return await prisma.issue.create({
          data: {
            ...data,
            shortName: generateIssueIdFromIndex(
              projectShortName,
              issueStartIndex
            ),
          },
          include: { workPlan: true },
        });
      })
    );
    console.log(
      'in server.services.issueService.createStoryOrTasks.success:',
      issuesCreated
    );
  } catch (e) {
    console.error(
      'in server.services.issueService.createStoryOrTasks.error:',
      e
    );
  }
  let issueNameToIdMap = (issuesCreated || []).reduce(
    (acct: INameToIDMap, i: any) => {
      acct[i.workPlan.name + i.name] = i.id;
      return acct;
    },
    {}
  );
  console.log(
    'in server.services.issueService.createStoryOrTasks:',
    issueNameToIdMap
  );
  return issueNameToIdMap;
}

async function createEpics(
  projectShortName: string,
  issueStartIndex: number,
  epicData: Omit<Prisma.IssueUncheckedCreateInput, 'parentIssueId'>[]
): Promise<INameToIDMap> {
  let epicsCreated;
  try {
    epicsCreated = await Promise.all(
      epicData.map(async (data) => {
        issueStartIndex += 1;
        return await prisma.issue.create({
          data: {
            ...data,
            shortName: generateIssueIdFromIndex(
              projectShortName,
              issueStartIndex
            ),
          },
          include: { workPlan: true },
        });
      })
    );
    console.log(
      'in server.services.issueService.createEpics.success:',
      epicsCreated
    );
  } catch (e) {
    console.error('in server.services.issueService.createEpics.error:', e);
  }
  let epicNameToIdMap = (epicsCreated || []).reduce(
    (acct: INameToIDMap, e: any) => {
      acct[e.workPlan.name + e.name] = e.id;
      return acct;
    },
    {}
  );
  console.log(
    'in server.services.issueService.epicNameToIdMap:',
    epicNameToIdMap
  );
  return epicNameToIdMap;
}

async function createSprints(
  sprintData: Prisma.WorkPlanUncheckedCreateInput[]
): Promise<INameToIDMap> {
  let sprintsCreated;
  try {
    sprintsCreated = await Promise.all(
      sprintData.map(async (data) => prisma.workPlan.create({ data }))
    );
    console.log(
      'in server.services.issueService.createSprints.success:',
      sprintsCreated
    );
  } catch (e) {
    console.error('in server.services.issueService.createSprints.error:', e);
  }
  let sprintNameToIdMap = (sprintsCreated || []).reduce(
    (acct: INameToIDMap, s: any) => {
      acct[s.name] = s.id;
      return acct;
    },
    {}
  );
  console.log(
    'in server.services.issueService.sprintNameToIdMap:',
    sprintNameToIdMap
  );
  return sprintNameToIdMap;
}

async function createMilestones(
  milestoneData: Omit<Prisma.WorkPlanUncheckedCreateInput, 'parentWorkPlanId'>[]
): Promise<INameToIDMap> {
  let milestonesCreated;
  try {
    milestonesCreated = await Promise.all(
      milestoneData.map(async (data) => prisma.workPlan.create({ data }))
    );
    console.log(
      'in server.services.issueService.createMilestones.success:',
      milestonesCreated
    );
  } catch (e) {
    console.error('in server.services.issueService.createMilestones.error:', e);
  }
  let milestoneNameToIdMap = (milestonesCreated || []).reduce(
    (acct: INameToIDMap, m: any) => {
      acct[m.name] = m.id;
      return acct;
    },
    {}
  );
  console.log(
    'in server.services.issueService.milestoneNameToIdMap:',
    milestoneNameToIdMap
  );
  return milestoneNameToIdMap;
}

type WorkPlanDataRecordInputs = {
  milestones: Omit<Prisma.WorkPlanUncheckedCreateInput, 'parentWorkPlanId'>[];
  sprints: Prisma.WorkPlanUncheckedCreateInput[];
  epics: Omit<Prisma.IssueUncheckedCreateInput, 'parentIssueId'>[];
  userStories: Prisma.IssueUncheckedCreateInput[];
  tasks: Prisma.IssueUncheckedCreateInput[];
};

function parseDataRecords(
  input: ICreateIssueWorkPlanInput
): WorkPlanDataRecordInputs {
  const { devPlan, creatorUserId, projectId, organizationId } = input;
  const milestones = devPlan.milestones;
  console.log('in server.services.issueService.parseDataRecords:', milestones);

  let dataRecords = milestones.reduce(
    (acc: WorkPlanDataRecordInputs, m: any) => {
      // add milestones - TODO: remove milestone type for now (Partial<WorkPlan>), ask a bon later
      const milestone = {
        projectId,
        name: m.name,
        type: WorkPlanType.MILESTONE,
        storyPoint: m.storyPoint,
        plannedStartDate: new Date(m.startDate),
        plannedEndDate: new Date(m.endDate),
        creatorUserId,
        organizationId,
        ownerUserId: m.ownerUserId || creatorUserId,
        meta: { key: m.key },
      };
      acc.milestones.push(milestone);
      // add sprints
      let sprints: WorkPlanDataRecordInputs['sprints'] = m.children.map(
        (s: any) => {
          // add userStories
          let userStories: WorkPlanDataRecordInputs['userStories'] =
            s.children.map((u: any) => {
              // add tasks
              let tasks: WorkPlanDataRecordInputs['tasks'] = u.children.map(
                (i: any) => {
                  return {
                    projectId,
                    name: i.name,
                    description: i.description,
                    type: IssueType.TASK,
                    storyPoint: i.storyPoint,
                    plannedStartDate: new Date(i.startDate),
                    plannedEndDate: new Date(i.endDate),
                    creatorUserId,
                    organizationId,
                    ownerUserId: i.ownerUserId,
                    parentIssueId: s.name + u.name, // TODO - This will be updated to actual parent story id after story creation; note we have to append sprint name because same user story may span across different sprints
                    workPlanId: s.name, // TODO - This will be updated to actual parent sprint id after sprint creation
                    meta: { key: i.key },
                  };
                }
              );
              acc.tasks = acc.tasks.concat(tasks);
              // return user story
              return {
                projectId,
                name: u.name,
                description: u.description,
                type: IssueType.STORY,
                storyPoint: u.storyPoint,
                plannedStartDate: new Date(u.startDate),
                plannedEndDate: new Date(u.endDate),
                creatorUserId,
                organizationId,
                parentIssueId: m.name + u.epic, // TODO - This will be updated to actual parent epic id after epic creation; note we need to attach milestone name because same user story may span across different milestones
                workPlanId: s.name, // TODO - This will be updated to actual parent sprint id after sprint creation
                meta: { key: u.key },
              };
            });
          acc.userStories = acc.userStories.concat(userStories);
          // add sprint
          return {
            projectId,
            name: s.name,
            type: WorkPlanType.SPRINT,
            storyPoint: s.storyPoint,
            plannedStartDate: new Date(s.startDate),
            plannedEndDate: new Date(s.endDate),
            creatorUserId,
            organizationId,
            ownerUserId: s.ownerUserId || creatorUserId,
            parentWorkPlanId: m.name, // TODO - This will be updated to actual parent milestone id after mileston creation
            meta: { key: s.key },
          };
        }
      );
      acc.sprints = acc.sprints.concat(sprints);
      // add epics
      let epics: WorkPlanDataRecordInputs['epics'] = m.epics.map((e: any) => {
        return {
          projectId,
          name: e.name,
          type: IssueType.EPIC,
          storyPoint: e.storyPoint,
          meta: {
            prevStoryPoint: e.prevStoryPoint,
            totalStoryPoint: e.totalStoryPoint,
            key: e.key,
          },
          plannedStartDate: new Date(e.startDate),
          plannedEndDate: new Date(e.endDate),
          creatorUserId,
          organizationId,
          workPlanId: m.name, // TODO - This will be updated to actual parent milestone id after milestone creation
        };
      });
      acc.epics = acc.epics.concat(epics);

      return acc;
    },
    { milestones: [], sprints: [], epics: [], userStories: [], tasks: [] }
  );
  return dataRecords;
}

export async function insertIssueToEpicsInDocument(
  issueData: IAddIssueInput,
  projectId: string,
  { epics, sprints, milestones }: DevPlan
): Promise<Epic[]> {
  let newEpics = (await addIssue(issueData, epics)) || [];
  // find all issues in progress and set their sprint key
  let issuesInSprints = await prisma.issue.findMany({
    where: {
      projectId,
      type: IssueType.TASK,
      status: {
        in: [
          IssueStatus.STARTED,
          IssueStatus.INREVIEW,
          IssueStatus.APPROVED,
          IssueStatus.COMPLETED,
        ],
      },
    },
    include: {
      workPlan: true,
    },
  });
  console.log(
    'in server.services.issueService.insertIssueToEpicsInDocument:',
    issuesInSprints
  );
  issuesInSprints.forEach((i: any) => {
    if (i.workPlan.type === WorkPlanType.BACKLOG) {
      return;
    }
    let issueKey = i.meta.key;
    newEpics.forEach((e: any) => {
      let stories = e.children || [];
      stories.forEach((s: any) => {
        let tasks = s.children || [];
        tasks.forEach((t: any) => {
          if (t.key === issueKey) {
            // set sprintKey for this tasks
            t.sprintKey = i.workPlan.meta.key;
            t.ownerUserId = i.ownerUserId;
            t.organizationId = i.organizationId;
            t.status = i.status;
            t.startDate = i.startDate;
            t.endDate = i.endDate;
          }
        });
      });
    });
  });
  return newEpics;
}

export async function addIssueToBacklog(
  projectId: string,
  issueName: string,
  creatorUserId: string
) {
  const backlogWorkPlan = await prisma.workPlan.findFirst({
    where: {
      projectId,
      type: WorkPlanType.BACKLOG,
    },
  });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw Error('no project with id: ' + projectId);
  }

  let shortName = await generateRandomIssueId(project.shortName);
  await prisma.issue.create({
    data: {
      name: issueName,
      shortName,
      projectId,
      creatorUserId,
      workPlanId: backlogWorkPlan?.id,
      type: IssueType.TASK,
      status: IssueStatus.CREATED,
    },
  });
}

export async function updateParentIssueProgress(
  parentIssueId: string,
  storyPointChange: number,
  action: string
) {
  if (!parentIssueId) {
    return;
  }
  let parentIssue = await prisma.issue.findUnique({
    where: {
      id: parentIssueId,
    },
  });
  if (!parentIssue) {
    console.error(
      'in server.services.issueService.updateParentIssueProgress: parentIssue not found'
    );
    return;
  }
  console.log(
    'in server.services.issueService.updateParentIssueProgress: parentIssue',
    parentIssue.id,
    storyPointChange
  );
  let completedStoryPoint = parentIssue.completedStoryPoint || 0;
  let storyPoint = parentIssue.storyPoint || 0;

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

  // update totalStoryPoint in parentIssue meta if it is an epic
  let meta = (parentIssue?.meta as Prisma.JsonObject) ?? {};
  if (meta?.totalStoryPoint) {
    meta.totalStoryPoint = (meta.totalStoryPoint as number) + storyPointChange;
  }

  let newStatus = IssueStatus.STARTED as string;
  if (completedStoryPoint === storyPoint) {
    newStatus = IssueStatus.COMPLETED;
  } else if (completedStoryPoint < storyPoint) {
    newStatus = IssueStatus.STARTED;
  }
  await prisma.issue.update({
    where: {
      id: parentIssueId,
    },
    data: {
      completedStoryPoint,
      storyPoint,
      progress: parentIssue.storyPoint
        ? Math.floor((completedStoryPoint / storyPoint) * 100)
        : 50, // default to 50% if story point is not set
      status: <IssueStatus>newStatus,
      meta,
    },
  });
  if (parentIssue.parentIssueId) {
    await updateParentIssueProgress(
      parentIssue.parentIssueId,
      storyPointChange,
      action
    );
  }
}

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export function generateIssueIdFromIndex(
  projectShortName: string,
  index: number
): string {
  let issuePart = '';
  while (index > 0) {
    issuePart += alphabet[index % alphabet.length];
    index = Math.floor(index / alphabet.length);
  }
  while (issuePart.length < 4) issuePart += alphabet[0];
  return projectShortName + '-' + issuePart;
}

export async function generateRandomIssueId(
  projectShortName: string
): Promise<string> {
  let lower_range = 1000;
  let upper_range =
    alphabet.length * alphabet.length * alphabet.length * alphabet.length - 1;
  for (let retryTimes = 0; retryTimes < 3; retryTimes++) {
    let randomIdx =
      Math.floor(Math.random() * (upper_range - lower_range + 1)) + lower_range;
    let shortName = generateIssueIdFromIndex(projectShortName, randomIdx);

    let result = await prisma.issue.findFirst({
      where: { shortName: shortName },
    });

    if (!result) {
      return shortName;
    }
  }

  throw Error('Could not find availble issue short name after retry.');
}

// Get all issues for a project.
export async function getIssues(projectId: string): Promise<any> {
  const issues = await prisma.issue.findMany({
    where: {
      projectId: projectId,
      status: {
        in: [
          IssueStatus.CREATED,
          IssueStatus.INREVIEW,
          IssueStatus.STARTED,
          IssueStatus.COMPLETED,
          IssueStatus.APPROVED,
        ],
      },
    },
    orderBy: {
      plannedStartDate: 'asc',
    },
  });
  return issues;
}
