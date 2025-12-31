import {
  IssueStatus,
  IssueType,
  RecordStatus,
  WorkPlan,
  WorkPlanStatus,
  WorkPlanType,
  Project,
  Access,
  DocumentPermissionStatus,
  DocumentPermissionTypes,
  ProjectStatus,
} from '@prisma/client';
import prisma from '../db/prisma';
import { Prisma } from '@prisma/client';
import { ProjectOutput, ProjectInfo } from '../../shared/types';
import { VisibleIssues } from '../routes/types/issueTypes';
import { JiraEntity } from '../../shared/types/jiraTypes';
import { generateKey } from './jiraService';
import { AuthenticatedUserWithProfile } from '../types/authTypes';
import { getVisibleProjectsWhereClause } from '../routes/types/teamTypes';
import { isEmail } from '../lib/util';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ACTIVE_OPENAI_MODEL_ID_PROD } from './llmService/uiux/ai_utils';
import { MilestonesAndBacklog } from '../routes/types/projectIncludes';
const model = new ChatOpenAI({
  modelName: ACTIVE_OPENAI_MODEL_ID_PROD,
  temperature: 1,
});
export async function checkProjectAccess(
  dbProject: Project,
  email: string,
  userId: string | null,
  organizationId: string | null
): Promise<{
  hasAccess: boolean;
  projectPermission: DocumentPermissionTypes;
}> {
  let hasAccess = false;
  let projectPermission: DocumentPermissionTypes = DocumentPermissionTypes.VIEW;

  // 1. Creator has full access
  if (userId && userId === dbProject.creatorUserId) {
    hasAccess = true;
    projectPermission = DocumentPermissionTypes.EDIT;
  }

  // 2. Direct email/user permission
  else if (isEmail(email)) {
    const projectPermissionWithEmail = await prisma.projectPermission.findFirst(
      {
        where: {
          projectId: dbProject.id,
          email,
          status: DocumentPermissionStatus.ACTIVE,
        },
      }
    );

    if (projectPermissionWithEmail !== null) {
      hasAccess = true;
      projectPermission = projectPermissionWithEmail.permission;
    }
  }

  // 3. Access level logic
  if (!hasAccess && userId) {
    switch (dbProject.access) {
      case Access.SELF:
        hasAccess = userId === dbProject.creatorUserId;
        break;
      case Access.ORGANIZATION:
        hasAccess = organizationId === dbProject.organizationId;
        break;
      case Access.TEAM:
        if (dbProject.teamId) {
          const membership = await prisma.userTeam.findFirst({
            where: {
              userId,
              teamId: dbProject.teamId,
              status: RecordStatus.ACTIVE,
            },
          });
          hasAccess = membership != null;
        }
        break;
      case Access.PUBLIC:
        hasAccess = true;
        break;
      default:
        break;
    }
  }

  // 4. Public access fallback
  if (!hasAccess && dbProject.access === Access.PUBLIC) {
    hasAccess = true;
  }

  return {
    hasAccess,
    projectPermission,
  };
}

export async function getProjectById(
  currentUser: AuthenticatedUserWithProfile,
  projectId: string,
  organizationId: string
): Promise<ProjectOutput | undefined> {
  // Optimized query with selective loading
  const dbProject = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      // Only load essential document fields
      documents: {
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          issueId: true,
          url: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      creator: {
        select: {
          id: true,
          username: true,
          email: true,
          firstname: true,
          lastname: true,
        },
      },
      owner: {
        select: {
          id: true,
          username: true,
          email: true,
          firstname: true,
          lastname: true,
        },
      },
      team: {
        select: {
          id: true,
          name: true,
          members: {
            where: { status: RecordStatus.ACTIVE },
            select: {
              userId: true,
              teamId: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                  firstname: true,
                  lastname: true,
                },
              },
            },
          },
        },
      },
      // Load issues with minimal data and only essential relations
      // PERFORMANCE: Using select instead of include to reduce payload size
      issues: {
        where: {
          ...VisibleIssues,
        },
        orderBy: {
          plannedStartDate: { sort: 'asc', nulls: 'last' },
        },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          description: true,
          shortName: true,
          storyPoint: true,
          completedStoryPoint: true,
          progress: true,
          plannedStartDate: true,
          plannedEndDate: true,
          workPlanId: true,
          parentIssueId: true,
          projectId: true,
          meta: true,
          createdAt: true,
          updatedAt: true,
          ownerUserId: true,
          creatorUserId: true,
          // Only load child issue IDs, not full objects to avoid N+1
          childIssues: {
            where: {
              status: { not: IssueStatus.CANCELED },
            },
            select: {
              id: true,
              type: true,
              parentIssueId: true,
            },
          },
          owner: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      },
      // Load workPlans with minimal data
      // PERFORMANCE: Exclude CANCELED workplans and only load essential fields
      workPlans: {
        where: {
          status: {
            notIn: [WorkPlanStatus.OVERWRITTEN, WorkPlanStatus.CANCELED],
          },
        },
        orderBy: {
          plannedStartDate: { sort: 'asc', nulls: 'last' },
        },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          plannedStartDate: true,
          plannedEndDate: true,
          parentWorkPlanId: true,
          // Load issues for workPlans but with minimal data
          issues: {
            where: {
              ...VisibleIssues,
            },
            select: {
              id: true,
              name: true,
              type: true,
              status: true,
              storyPoint: true,
              completedStoryPoint: true,
              progress: true,
              workPlanId: true,
              parentIssueId: true,
              childIssues: {
                where: {
                  ...VisibleIssues,
                },
                select: {
                  id: true,
                  type: true,
                  parentIssueId: true,
                },
              },
              owner: {
                select: {
                  id: true,
                  username: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!dbProject) {
    return undefined;
  }

  const { hasAccess } = await checkProjectAccess(
    dbProject,
    currentUser.email,
    currentUser.userId,
    organizationId
  );

  if (!hasAccess) {
    return undefined;
  }

  const { issues, workPlans, ...project } = dbProject;
  const backlog = dbProject.workPlans.find(
    (wp) => wp.type === WorkPlanType.BACKLOG
  );
  const startTime = new Date().valueOf();

  const sprints = dbProject.workPlans
    .filter((wp) => wp.type === WorkPlanType.SPRINT)
    .sort((wp) => wp.plannedStartDate?.getSeconds() || 1)
    .map((sprint) => ({
      ...sprint,
      issues: sprint.issues.filter(
        (issue) => !issue.childIssues || issue.childIssues.length === 0
      ),
    }));

  const projectOutput: ProjectOutput = {
    ...project,
    buildables: issues.filter((i) => i.type === IssueType.BUILDABLE),
    backlog: backlog && {
      ...backlog,
      stories: issues
        .filter(
          (i) => i.type === IssueType.STORY && i.workPlanId === backlog.id
        )
        .map((story) => ({
          ...story,
          tasks: issues.filter(
            (i) => i.type === IssueType.TASK && i.parentIssueId === story.id
          ),
        })),
      tasks: issues.filter(
        (i) =>
          i.type === IssueType.TASK &&
          !i.parentIssueId &&
          i.workPlanId === backlog.id
      ),
    },
    backlogIssues: backlog?.issues || [],
    backlogId: backlog?.id,
    issues: issues,
    sprints: sprints,
    activeSprintInd: getTargetSprintInd(startTime, sprints),
    milestones: workPlans
      .filter((wp) => wp.type === WorkPlanType.MILESTONE)
      .map((milestone) => ({
        ...milestone,
        epics: issues
          .filter(
            (i) => i.type === IssueType.EPIC && i.workPlanId === milestone.id
          )
          .map((epic) => ({
            ...epic,
            stories: issues
              .filter(
                (i) => i.type === IssueType.STORY && i.parentIssueId === epic.id
              )
              .map((story) => ({
                ...story,
                tasks: issues.filter(
                  (i) =>
                    i.type === IssueType.TASK && i.parentIssueId === story.id
                ),
              })),
          })),
        sprints: workPlans
          .filter(
            (wp) =>
              wp.type === WorkPlanType.SPRINT &&
              wp.parentWorkPlanId === milestone.id
          )
          .map((sprint) => ({
            ...sprint,
            stories: issues
              .filter(
                (issue) =>
                  issue.type === IssueType.STORY &&
                  issues.some(
                    (child) =>
                      child.type === IssueType.TASK &&
                      child.workPlanId === sprint.id &&
                      child.parentIssueId === issue.id
                  )
              )
              .map((story) => {
                const tasks = issues.filter(
                  (child) =>
                    child.type === IssueType.TASK &&
                    child.workPlanId === sprint.id &&
                    child.parentIssueId === story.id
                );
                const { totals } = tasks.reduce(
                  ({ totals }, child) => {
                    if (child.status === IssueStatus.CANCELED) {
                      return { totals };
                    }
                    totals.storyPoint += child.storyPoint || 0;
                    (totals.completedStoryPoint +=
                      child.completedStoryPoint || 0),
                      (totals.progress =
                        totals.storyPoint !== 0
                          ? Math.floor(
                              (totals.completedStoryPoint / totals.storyPoint) *
                                100
                            )
                          : 0);

                    return { totals };
                  },
                  {
                    totals: {
                      storyPoint: 0,
                      completedStoryPoint: 0,
                      progress: 0,
                    },
                  }
                );

                return {
                  ...story,
                  ...totals,
                  tasks,
                  totalStoryPoint: story.storyPoint,
                  totalCompletedStoryPoint: story.completedStoryPoint,
                  totalProgress: story.progress,
                };
              }),
          })),
      }))
      .sort((a, b) => {
        // sort the milestones by start date and end date
        return (
          a.plannedStartDate!.getTime() - b.plannedStartDate!.getTime() ||
          a.plannedEndDate!.getTime() - b.plannedEndDate!.getTime()
        );
      }),
  };

  return projectOutput;
}

export async function getProjectsInfoByOrganizationId(
  userId: string,
  isAdmin: boolean,
  organizationId: string
): Promise<ProjectInfo[]> {
  console.log(
    'in server.services.projectService.getProjectsInfoByOrganizationId:',
    isAdmin
  );
  const dbProjects = await prisma.project.findMany({
    where: {
      organizationId: organizationId,
      ...getVisibleProjectsWhereClause(isAdmin, userId),
    },
  });

  const projectInfos: ProjectInfo[] = dbProjects.map((dbProject) => {
    let meta = (dbProject?.meta as Prisma.JsonObject) ?? {};
    const projectInfo: ProjectInfo = {
      name: dbProject.name,
      id: dbProject.id,
      jira_key: meta.jira ? (meta.jira as JiraEntity).key : '',
    };
    return projectInfo;
  });
  return projectInfos;
}

export async function getAllAccessibleProjectsInfo(
  currentUser: AuthenticatedUserWithProfile
): Promise<ProjectInfo[]> {
  const { email, userId } = currentUser;

  // Fetch all potentially accessible projects
  const dbProjects = await prisma.project.findMany({
    where: {
      status: {
        in: [
          ProjectStatus.CREATED,
          ProjectStatus.STARTED,
          ProjectStatus.PAUSED,
        ],
      },
    },
  });

  // Check access in parallel
  const accessChecks = await Promise.all(
    dbProjects.map(async (dbProject) => {
      const { hasAccess } = await checkProjectAccess(
        dbProject,
        email,
        userId,
        dbProject.organizationId
      );
      return hasAccess ? dbProject : null;
    })
  );

  // Filter and map to ProjectInfo
  return accessChecks
    .filter((p): p is Project => p !== null)
    .map((project) => {
      const meta = (project.meta as Prisma.JsonObject) ?? {};
      return {
        id: project.id,
        name: project.name,
        jira_key: meta.jira ? (meta.jira as JiraEntity).key : '',
      };
    });
}

function getTargetSprintInd(targetTime: number, sprints: WorkPlan[]): number {
  const targetSprintInd = sprints.findIndex((sprint) => {
    const startTime =
      sprint.plannedStartDate && sprint.plannedStartDate.getTime();

    const endTime = sprint.plannedEndDate && sprint.plannedEndDate.getTime();

    return startTime! <= targetTime && endTime! >= targetTime;
  });
  if (!targetSprintInd || targetSprintInd < 0) return 0;
  return targetSprintInd;
}

export async function saveJiraProfileForProject(
  projectId: string,
  profile: JiraEntity
): Promise<Project | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  // Update Jira information only.
  let newMeta = (project?.meta as Prisma.JsonObject) ?? {};
  newMeta.jira = profile;

  return await prisma.project.update({
    where: {
      id: projectId,
    },
    data: {
      jiraId: `${profile.id}`,
      meta: newMeta,
    },
  });
}

export async function getVisibleProjectsForUser({
  userId,
  organizationId,
  email,
}: {
  userId?: string;
  organizationId: string;
  email: string;
}) {
  // Load permissions and team memberships
  const [projectPermissionsByEmail, userTeams] = await Promise.all([
    prisma.projectPermission.findMany({
      where: {
        email,
        status: DocumentPermissionStatus.ACTIVE,
      },
    }),
    userId
      ? prisma.userTeam.findMany({
          where: {
            userId,
            status: RecordStatus.ACTIVE,
          },
        })
      : [],
  ]);

  const sharedProjectIds = projectPermissionsByEmail.map((p) => p.projectId);
  const userTeamIds = new Set(userTeams.map((t) => t.teamId));
  const projectPermissionsMap = new Map(
    projectPermissionsByEmail.map((p) => [p.projectId, p.permission])
  );

  // Fetch both org projects AND shared projects from other orgs
  const allProjects = await prisma.project.findMany({
    where: {
      OR: [
        {
          // Projects in current organization
          organizationId,
          status: {
            in: [
              ProjectStatus.CREATED,
              ProjectStatus.STARTED,
              ProjectStatus.PAUSED,
            ],
          },
        },
        {
          // Shared projects from other organizations
          id: { in: sharedProjectIds },
          status: {
            in: [
              ProjectStatus.CREATED,
              ProjectStatus.STARTED,
              ProjectStatus.PAUSED,
            ],
          },
        },
      ],
    },
    include: {
      issues: { where: VisibleIssues },
      workPlans: { where: MilestonesAndBacklog },
      owner: { select: { id: true, username: true } },
      documents: {
        select: {
          id: true,
          type: true,
          meta: true,
          url: true,
        },
      },
    },
  });

  // Filter visible projects
  const filteredProjects = allProjects.filter((project) => {
    // User is creator
    if (userId && project.creatorUserId === userId) return true;

    // Project is shared with user
    if (projectPermissionsMap.has(project.id)) return true;

    // Check access level for org projects
    switch (project.access) {
      case Access.SELF:
        return userId === project.creatorUserId;
      case Access.ORGANIZATION:
        return organizationId === project.organizationId;
      case Access.TEAM:
        return project.teamId ? userTeamIds.has(project.teamId) : false;
      default:
        return false;
    }
  });

  return filteredProjects;
}

export async function getVisibleProjectsForUserLightweight({
  userId,
  organizationId,
  email,
  page = 1,
  limit = 20,
}: {
  userId?: string;
  organizationId: string;
  email: string;
  page?: number;
  limit?: number;
}): Promise<{
  projects: ReadonlyArray<Readonly<Project>>;
  total: number;
  hasMore: boolean;
}> {
  // Load permissions and team memberships in parallel
  const [projectPermissionsByEmail, userTeams] = await Promise.all([
    prisma.projectPermission.findMany({
      where: {
        email,
        status: DocumentPermissionStatus.ACTIVE,
      },
      select: { projectId: true, permission: true },
    }),
    userId
      ? prisma.userTeam.findMany({
          where: {
            userId,
            status: RecordStatus.ACTIVE,
          },
          select: { teamId: true },
        })
      : [],
  ]);

  const sharedProjectIds = projectPermissionsByEmail.map((p) => p.projectId);
  const userTeamIds = Array.from(new Set(userTeams.map((t) => t.teamId)));

  // Build WHERE clause to filter at database level (much faster than in-memory filtering)
  const whereClause: Prisma.ProjectWhereInput = {
    status: {
      in: [ProjectStatus.CREATED, ProjectStatus.STARTED, ProjectStatus.PAUSED],
    },
    OR: [
      // User is creator
      ...(userId ? [{ creatorUserId: userId }] : []),
      // Project is shared with user
      ...(sharedProjectIds.length > 0
        ? [{ id: { in: sharedProjectIds } }]
        : []),
      // Organization-level access projects
      {
        organizationId,
        access: Access.ORGANIZATION,
      },
      // Team-level access projects (user is member of the team)
      ...(userTeamIds.length > 0
        ? [
            {
              organizationId,
              access: Access.TEAM,
              teamId: { in: userTeamIds },
            },
          ]
        : []),
      // Self-access projects (only if user is creator, already covered above)
    ],
  };

  // Use database-level pagination instead of fetching all and filtering in memory
  const skip = (page - 1) * limit;
  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        description: true,
        storyPoint: true,
        dueDate: true,
        progress: true,
        status: true,
        meta: true,
        createdAt: true,
        updatedAt: true,
        organizationId: true,
        templateProjectId: true,
        creatorUserId: true,
        teamId: true,
        ownerUserId: true,
        access: true,
        shortName: true,
        completedStoryPoint: true,
        jiraId: true,
        owner: {
          select: {
            id: true,
            username: true,
          },
        },
        documents: {
          select: {
            id: true,
            type: true,
            meta: true,
            url: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.project.count({
      where: whereClause,
    }),
  ]);

  const hasMore = skip + projects.length < total;

  return {
    projects: projects as unknown as ReadonlyArray<Readonly<Project>>,
    total,
    hasMore,
  };
}

export async function generateShortNameForProject(
  name: string
): Promise<string> {
  let key = generateKey(name);

  // Count how many projects whose shortName starts with this key prefix
  const existingProjects = await prisma.project.findMany({
    where: {
      shortName: {
        startsWith: key,
      },
    },
  });

  const count = existingProjects.length;

  if (count === 0) {
    // First time this shortName is used, return it as-is
    return key;
  } else {
    // Append current count to ensure uniqueness
    return `${key}${count}`;
  }
}
export async function generateProjectTitleFromDescription(
  description: string
): Promise<string> {
  const messages = [
    new SystemMessage(
      'You are an assistant that generates concise and catchy project titles from verbose descriptions. Generate a title that is 1-2 words long using the same language as the description.'
    ),
    new HumanMessage(description),
  ];

  const response = await model.invoke(messages);
  return (response.content as string).replace(/[^\p{L}\p{N} ]/gu, '').trim();
}

export async function updateProjectStoryPointProgress(
  projectId: string,
  storyPointChange: number,
  action: string
): Promise<Project | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) {
    throw Error('Project not found.');
  }

  let storyPoint = project.storyPoint || 0;
  let completedStoryPoint = project.completedStoryPoint || 0;

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
        'in server.services.projectService.updateProjectStoryPointProgress, unknown action: ' +
          action
      );
  }

  return await prisma.project.update({
    where: {
      id: projectId,
    },
    data: {
      storyPoint,
      completedStoryPoint,
      progress:
        storyPoint !== 0
          ? Math.floor((completedStoryPoint / storyPoint) * 100)
          : 0,
    },
  });
}
