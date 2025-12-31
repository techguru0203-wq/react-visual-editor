import prisma from '../../../db/prisma';
import {
  CommentEvent,
  CommentFromJiraAPI,
  IssueEvent,
  IssueFromJiraAPI,
  JiraIssueStatus,
  ProjectEvent,
  ProjectFromJiraAPI,
  SprintEvent,
  SprintFromJiraApi,
  WorkLogEvent,
  WorkLogFromJiraApi,
} from '../../types/jiraTypes';
import {
  Access,
  DocumentStatus,
  Issue,
  IssueStatus,
  IssueType,
  Project,
  ProjectStatus,
  User,
  UserRole,
  WorkPlan,
  WorkPlanStatus,
  WorkPlanType,
} from '@prisma/client';
import dayjs from 'dayjs';
import {
  getJiraDataWithValidToken,
  getSprintAndStoryPointsFieldIds,
} from '../../../services/jiraService';
import { updateParentIssue } from '../../../lib/issueUpdateShared';
import { generateRandomIssueId } from '../../../services/issueService';
import { StandardResponse } from '../../../types/response';

export async function getIssueForJiraIssueId(id: string) {
  return await prisma.issue.findFirst({
    where: { jiraId: id },
  });
}
const PARENT_ISSUE_STATIC_ID = 'IssueParentAssociation';

export async function handleIssueUpdated(
  data: {
    issue: IssueFromJiraAPI;
    changelog: {
      items: Array<{
        toString: string;
        field: string;
        fieldId: string;
        to: string;
      }>;
    };
    user: IssueFromJiraAPI['fields']['assignee'];
  },
  res: StandardResponse<string>
) {
  const jiraIssueId = data?.issue?.id;
  let updateObject = await (async () => {
    switch (data.changelog.items[0].field) {
      case 'description':
        return {
          description: data.changelog.items[0].toString,
        };
      case 'summary':
        return {
          name: data.changelog.items[0].toString,
        };
      case 'resolution':
      case 'status':
        let itemIndex = 0;
        let toStringValue = data.changelog.items[itemIndex].toString;
        if (data.changelog.items.length > 1 && !toStringValue) {
          toStringValue = data.changelog.items[1].toString;
        }
        return {
          status: (() => {
            if (toStringValue == JiraIssueStatus[0]) {
              return IssueStatus.STARTED;
            } else if (toStringValue == JiraIssueStatus[1]) {
              return IssueStatus.CREATED;
            } else if (toStringValue == JiraIssueStatus[2]) {
              return IssueStatus.COMPLETED;
            } else {
              return IssueStatus.CREATED;
            }
          })(),
        };
      case 'Story point estimate':
        return {
          storyPoint: parseInt(data.changelog.items[0].toString),
        };
      case 'assignee':
        return {
          ownerUserId: (
            await prisma.user.findFirst({
              where: { jiraUserId: data.changelog.items[0].to },
            })
          )?.id,
        };
      case 'reporter':
        return {
          creatorUserId: (
            await prisma.user.findFirst({
              where: { jiraUserId: data.changelog.items[0].to },
            })
          )?.id,
        };
      default: {
        // handle parent issue update
        if (data.changelog.items?.[1]?.field === PARENT_ISSUE_STATIC_ID) {
          return {
            parentIssueId: (
              await prisma.issue.findFirst({
                where: { jiraId: data.changelog.items[0].to },
              })
            )?.id,
          };
        }

        const user = (await prisma.user.findFirst({
          where: { jiraUserId: data.user.accountId }, // possibly might not have jira linked in omniflow
        })) as User;

        const { sprintFieldId, storyPointsFieldId } =
          await getJiraDataWithValidToken(
            async () =>
              await getSprintAndStoryPointsFieldIds(
                user?.id,
                (user.meta as any)?.jira_profile?.resource?.id
              ),
            user.id
          );
        // Field ids to be taken since names
        // aren't reliable for the remaining the fields - story points, epic/story, sprint
        switch (data.changelog.items[0].fieldId) {
          case storyPointsFieldId:
            return {
              storyPoint: parseInt(data.changelog.items[0].toString),
            };
          case sprintFieldId:
            return {
              workPlanId: (
                (await prisma.workPlan.findFirst({
                  where: {
                    jiraSprintId: `${data.changelog.items[0].to}`,
                  },
                })) as WorkPlan
              ).id,
            };
          default:
            return undefined;
        }
      }
    }
  })();

  if (jiraIssueId && updateObject) {
    const issueUpdateUser = (await prisma.user.findFirst({
      where: { jiraUserId: data.user.accountId },
    })) as User;

    let newUpdateData: any = updateObject;
    if (updateObject.status === IssueStatus.STARTED) {
      newUpdateData = {
        ...updateObject,
        actualStartDate: new Date(),
        actualEndDate: null,
      };
    }
    if (updateObject.status === IssueStatus.COMPLETED) {
      newUpdateData = {
        ...updateObject,
        actualEndDate: new Date(),
      };
    }
    if (updateObject.status === IssueStatus.CREATED) {
      newUpdateData = {
        ...updateObject,
        actualStartDate: null,
        actualEndDate: null,
      };
    }

    const oldIssue = await prisma.issue.findFirst({
      where: { jiraId: data.issue.id },
    });

    if (!oldIssue) {
      console.error(`Issue not found for jiraId: ${data.issue.id}`);
      return;
    }

    const updatePayload: Partial<Issue> = {
      ...oldIssue,
      ...updateObject,
    };

    // Time logic based on issue status
    if (updateObject.status === IssueStatus.STARTED) {
      updatePayload.actualStartDate = new Date();
      updatePayload.actualEndDate = null;
    }
    if (updateObject.status === IssueStatus.COMPLETED) {
      updatePayload.actualEndDate = new Date();
    }
    if (updateObject.status === IssueStatus.CREATED) {
      updatePayload.actualStartDate = null;
      updatePayload.actualEndDate = null;
    }

    // Ensure the status of the parent task and its only child task are consistent.
    // If the parent task's status is updated, propagate the same status to its child
    if (updatePayload.type === 'STORY') {
      const subTasks = await prisma.issue.findMany({
        where: {
          parentIssueId: updatePayload.id!,
        },
      });

      if (subTasks.length === 1) {
        const child = subTasks[0];
        if (child.status !== updatePayload.status) {
          await prisma.issue.update({
            where: { id: child.id },
            data: {
              status: updatePayload.status,
            },
          });
          console.log(
            `Subtask ${child.shortName} status has been synchronized to ${updatePayload.status}`
          );
        }
      }
    }

    await updateParentIssue(
      {
        email: issueUpdateUser?.email,
        organizationId: issueUpdateUser?.organizationId,
        userId: issueUpdateUser?.id,
        userName: issueUpdateUser?.username,
      },
      updatePayload as Issue,
      res
    );
  }
}

export async function handleIssueCreated(
  issueFromData: { issue: IssueFromJiraAPI },
  res: StandardResponse<string>
) {
  const issueCheck = await prisma.issue.findFirst({
    where: {
      jiraId: issueFromData.issue.id,
    },
  });

  if (issueCheck?.id) {
    return;
  }

  // Not custom IDs as issue types are pre-defined by JIRA
  const issueType = (() => {
    const jiraIssueType = issueFromData.issue.fields.issuetype.id;
    switch (jiraIssueType) {
      case '10000':
        return IssueType.EPIC;
      case '10001':
        return IssueType.TASK;
      case '10002':
      case '10003':
      case '10006':
        return IssueType.SUBTASK;
      case '10004':
        return IssueType.BUG;
      case '10005':
        return IssueType.TASK;
      default:
        return IssueType.TASK;
    }
  })();

  // project has been created before this issue or already exists in our DB
  const issueProject = (await prisma.project.findFirst({
    where: { jiraId: issueFromData.issue.fields.project.id },
  })) as Project;

  const issueUser = (await prisma.user.findFirst({
    where: { jiraUserId: issueFromData.issue.fields.creator.accountId },
  })) as User;

  const { sprintFieldId, storyPointsFieldId } = await getJiraDataWithValidToken(
    async () =>
      await getSprintAndStoryPointsFieldIds(
        issueUser?.id,
        (issueUser.meta as any)?.jira_profile?.resource?.id
      ),
    issueUser.id
  );

  //if sprint does not exist, get default backlog as workPlan
  let issueWorkplan;
  let actualDates;
  if (!issueFromData.issue.fields[sprintFieldId]) {
    issueWorkplan = (await prisma.workPlan.findFirst({
      where: {
        projectId: `${issueProject.id}`,
        type: WorkPlanType.BACKLOG,
      },
    })) as WorkPlan;
    let startDateValue = undefined;
    let endDateValue = undefined;

    if (issueWorkplan.actualStartDate) {
      startDateValue = dayjs(issueWorkplan.actualStartDate).toDate();
    }
    if (issueWorkplan.actualEndDate) {
      endDateValue = dayjs(issueWorkplan.actualEndDate).toDate();
    }
    actualDates = {
      startDate: startDateValue,
      endDate: endDateValue,
    };
  } else {
    issueWorkplan = (await prisma.workPlan.findFirst({
      where: {
        jiraSprintId: `${issueFromData.issue.fields[sprintFieldId][0].id}`,
      },
    })) as WorkPlan;

    actualDates = (() => {
      const startDate = issueFromData.issue.fields[sprintFieldId][0]?.startDate;
      const endDate = issueFromData.issue.fields[sprintFieldId][0]?.endDate;

      return {
        startDate: startDate ? dayjs(startDate).toDate() : undefined,
        endDate: endDate ? dayjs(endDate).toDate() : undefined,
      };
    })();
  }

  const parentIssue = await prisma.issue.create({
    data: {
      name: 'Parent issue for task',
      shortName: await generateRandomIssueId(issueProject.shortName),
      type: 'STORY',
      workPlanId: issueWorkplan.id,
      creatorUserId: issueUser?.id as string,
      projectId: issueProject.id,
      ownerUserId: issueProject.creatorUserId,
      description: `Parent issue for ${issueFromData.issue.key} created in Jira`,
    },
  });

  const createdIssue = await prisma.issue.create({
    data: {
      jiraId: issueFromData.issue.id,
      name: issueFromData.issue.fields.summary,
      shortName: issueFromData.issue.key,
      type: issueType,
      actualStartDate: actualDates.startDate,
      actualEndDate: actualDates.endDate,
      storyPoint: issueFromData.issue?.fields[storyPointsFieldId] ?? 0,
      description: issueFromData.issue.fields.description,
      updatedAt: dayjs(issueFromData.issue.fields.updated).toDate(),
      createdAt: dayjs(issueFromData.issue.fields.created).toDate(),
      plannedEndDate: new Date(),
      plannedStartDate: new Date(),
      parentIssueId: parentIssue.id,

      // If a user not connected in omniflow updates the issue, assign issue to issueProject.creatorUserId since
      // a project has to have a omniflow user who created it. If newly created issue is an EPIC it won't have parentIssue
      // so that's not reliable to get a creatorUserId.
      creatorUserId: issueUser?.id ?? issueProject.creatorUserId,
      projectId: issueProject.id,
      status: 'CREATED',
      progress: issueFromData.issue.fields.aggregateprogress.progress,
      completedStoryPoint: 0,
      workPlanId: issueWorkplan.id, // jira sprint
      ownerUserId: issueProject.creatorUserId,
    },
  });

  // update workplan with newly created issue
  await prisma.workPlan.update({
    where: {
      id: issueWorkplan.id,
    },
    data: {
      storyPoint:
        (issueWorkplan.storyPoint ?? 0) + (createdIssue.storyPoint ?? 0),
    },
  });

  await updateParentIssue(
    {
      email: issueUser?.email as any,
      organizationId: issueUser?.organizationId as any,
      userId: issueUser?.id as any,
      userName: issueUser?.username as any,
    },
    createdIssue,
    res
  );

  await prisma.issueChangeHistory.create({
    data: {
      modifiedAttribute: JSON.stringify(createdIssue),
      createdAt: new Date(),
      issueId: createdIssue.id,

      // if there's no assignee use creatorUserId
      userId: createdIssue.ownerUserId ?? createdIssue.creatorUserId,
    },
  });
}

export async function handleIssueDeleted(data: { issue: IssueFromJiraAPI }) {
  const issueToDelete = await prisma.issue.findFirst({
    where: {
      jiraId: data.issue.id,
    },
  });

  if (issueToDelete?.parentIssueId) {
    await prisma.issue.update({
      where: { id: issueToDelete?.parentIssueId },
      data: {
        status: 'CANCELED',
        childIssues: {
          update: {
            where: { id: issueToDelete?.id },
            data: { status: 'CANCELED' },
          },
        },
      },
    });
  } else {
    // if issue has no parent, just delete it
    await prisma.issue.update({
      where: { id: issueToDelete?.id },
      data: { status: 'CANCELED' },
    });
  }
}

export async function handleIssueEvent(
  data: any,
  response: StandardResponse<string>,
  eventName: string
) {
  console.log('----handleIssueEvent----', data, eventName);
  switch (eventName) {
    case IssueEvent.ISSUE_CREATED:
      handleIssueCreated(data, response);
      break;
    case IssueEvent.ISSUE_UPDATED:
      handleIssueUpdated(data, response);
      break;
    case IssueEvent.ISSUE_DELETED:
      handleIssueDeleted(data);
      break;
    default:
      console.log('no match issue event handler');
  }
}

export async function handleCommentCreated(data: {
  comment: CommentFromJiraAPI;
  issue: IssueFromJiraAPI;
}) {
  await prisma.comment.create({
    data: {
      jiraCommentId: data.comment.id,
      createdAt: new Date(),
      content: data.comment.body,
      issueId: ((await getIssueForJiraIssueId(data.issue.id)) as Issue)?.id,
      status: 'ACTIVE',
      userId: (
        (await prisma.user.findFirst({
          where: { jiraUserId: data.comment.author.accountId },
        })) as User
      ).id,
    },
  });
}
export async function handleCommentUpdated(data: {
  comment: CommentFromJiraAPI;
  issue: IssueFromJiraAPI;
}) {
  try {
    await prisma.comment.update({
      where: { jiraCommentId: data.comment.id },
      data: {
        updatedAt: new Date(),
        content: data.comment.body,
        issueId: ((await getIssueForJiraIssueId(data.issue.id)) as Issue)?.id,
        status: 'ACTIVE',
        userId: (
          (await prisma.user.findFirst({
            where: { jiraUserId: data.comment.author.accountId },
          })) as User
        ).id,
      },
    });
  } catch {
    // create comment if the comment wasn't in our system
    await handleCommentCreated(data);
  }
}

export async function handleCommentDeleted(data: {
  comment: CommentFromJiraAPI;
  issue: IssueFromJiraAPI;
}) {
  await prisma.comment.update({
    where: { jiraCommentId: data.comment.id },
    data: { status: 'DELETED' },
  });
}

export async function handleCommentEvent(data: any, eventName: string) {
  console.log('----handleCommentEvent----', data, eventName);
  switch (eventName) {
    case CommentEvent.COMMENT_CREATED:
      handleCommentCreated(data);
      break;
    case CommentEvent.COMMENT_UPDATED:
      handleCommentUpdated(data);
      break;
    case CommentEvent.COMMENT_DELETED:
      handleCommentDeleted(data);
      break;
    default:
      console.log('no match comment event handler');
  }
}

export async function handleWorkLogCreated(data: {
  worklog: WorkLogFromJiraApi;
}) {
  console.log('----handleWorkLogCreated----', data);
  try {
    const issueData = await prisma.issue.findFirst({
      where: {
        jiraId: data.worklog.issueId,
      },
    });

    if (!issueData) {
      throw 'Jira issue is not existed in omniflow system.';
    }

    const worklogData = await prisma.issueChangeHistory.findFirst({
      where: {
        workLogId: data.worklog.id,
      },
    });

    if (worklogData) {
      throw 'Jira worklog is already existed in omniflow system.';
    }

    await prisma.issueChangeHistory.create({
      data: {
        workLogId: data.worklog.id,
        issueId: issueData.id,
        userId: issueData.ownerUserId ?? issueData.creatorUserId,
        modifiedAttribute: JSON.stringify({
          comment: data.worklog.comment ?? '',
        }),
      },
    });
  } catch (e) {
    console.error('server.routes.api.workLog.create', e);
  }
}

export async function handleWorkLogUpdated(data: {
  worklog: WorkLogFromJiraApi;
}) {
  console.log('----handleWorkLogUpdated----', data);

  const issueData = await prisma.issue.findFirst({
    where: {
      jiraId: data.worklog.issueId,
    },
  });

  if (!issueData) {
    throw 'Jira issue is not existed in omniflow system.';
  }

  const worklogData = await prisma.issueChangeHistory.findFirst({
    where: {
      workLogId: data.worklog.id,
    },
  });

  if (!worklogData) {
    throw 'Jira worklog is not existed in omniflow system.';
  }

  try {
    await prisma.issueChangeHistory.update({
      data: {
        issueId: issueData.id,
        userId: issueData.ownerUserId ?? undefined,
        modifiedAttribute: JSON.stringify({
          comment: data.worklog.comment ?? '',
        }),
      },
      where: {
        workLogId: data.worklog.id,
      },
    });
  } catch (e) {
    console.error('server.routes.api.workLog.update', e);
  }
}

export async function handleWorkLogDeleted(data: {
  worklog: WorkLogFromJiraApi;
}) {
  console.log('----handleWorkLogDeleted----', data);
  const issueData = await prisma.issue.findFirst({
    where: {
      jiraId: data.worklog.issueId,
    },
  });

  if (!issueData) {
    throw 'Jira issue is not existed in omniflow system.';
  }

  const worklogData = await prisma.issueChangeHistory.findFirst({
    where: {
      workLogId: data.worklog.id,
    },
  });

  if (!worklogData) {
    throw 'Jira worklog is not existed in omniflow system.';
  }

  try {
    await prisma.issueChangeHistory.delete({
      where: {
        workLogId: data.worklog.id,
      },
    });
  } catch (e) {
    console.error('server.routes.api.workLog.delete', e);
  }
}

export async function handleWorkLogEvent(data: any, eventName: string) {
  console.log('----handleWorkLogEvent----', data, eventName);
  switch (eventName) {
    case WorkLogEvent.WORK_LOG_CREATED:
      handleWorkLogCreated(data);
      break;
    case WorkLogEvent.WORK_LOG_UPDATED:
      handleWorkLogUpdated(data);
      break;
    case WorkLogEvent.WORK_LOG_DELETED:
      handleWorkLogDeleted(data);
      break;
    default:
      console.log('no match workLog event handler');
  }
}

export async function handleProjectCreated(data: {
  project: ProjectFromJiraAPI;
}) {
  console.log('----handleProjectCreated----', data);
  const createdUser = await prisma.user.findFirst({
    where: {
      jiraUserId: data.project.projectLead.accountId,
    },
  });
  if (!createdUser) {
    throw 'Jira user is not existed in omniflow system.';
  }

  try {
    await prisma.project.create({
      data: {
        name: data.project.name,
        shortName: data.project.key,
        jiraId: data.project.id.toString(),
        ownerUserId: createdUser.id,
        organizationId: createdUser.organizationId,
        creatorUserId: createdUser.id,
        access: Access.SELF,
        meta: data.project,
        workPlans: {
          create: {
            name: 'Backlog',
            type: WorkPlanType.BACKLOG,
            status: IssueStatus.CREATED,
            creatorUserId: createdUser.id,
            ownerUserId: createdUser.id,
            plannedEndDate: null,
          },
        },
      },
    });
  } catch (e) {
    console.error('server.routes.api.projects.create', e);
  }
}

export async function handleProjectUpdated(data: {
  project: ProjectFromJiraAPI;
}) {
  console.log('----handleProjectUpdated----', data);
  const jiraProjectId = data.project.id.toString();

  const omniProjectData = await prisma.project.findFirst({
    where: {
      jiraId: data.project.id.toString(),
    },
  });
  if (!omniProjectData) {
    throw 'Jira project is not existed in omniflow system.';
  }

  let updatingData: any = {
    name: data.project.name,
    shortName: data.project.key,
  };
  const assignedUser = await prisma.user.findFirst({
    where: {
      jiraUserId: data.project.projectLead.accountId,
    },
  });
  if (!assignedUser) {
    console.log('Jira user is not existed in omniflow system.');
  } else {
    updatingData = {
      ...updatingData,
      ownerUserId: assignedUser.id,
    };
  }

  try {
    await prisma.project.update({
      where: {
        id: omniProjectData.id,
      },
      data: {
        ...updatingData,
      },
    });
  } catch (e) {
    console.error('server.routes.api.projects.update', e);
  }
}

export async function handleProjectDeleted(data: {
  project: ProjectFromJiraAPI;
}) {
  console.log('----handleProjectDeleted----', data);

  const projectData = await prisma.project.findFirst({
    where: {
      jiraId: data.project.id.toString(),
    },
  });
  if (!projectData) {
    throw 'Jira project is not existed in omniflow system.';
  }

  const createdUser = await prisma.user.findFirst({
    where: {
      jiraUserId: data.project.projectLead.accountId,
    },
  });
  if (!createdUser) {
    throw 'Jira user is not existed in omniflow system.';
  }

  try {
    let whereClause =
      createdUser.role === UserRole.ADMIN
        ? {
            id: projectData.id,
            organizationId: createdUser.organizationId,
          }
        : {
            id: projectData.id,
            OR: [
              { ownerUserId: createdUser.id },
              { creatorUserId: createdUser.id },
            ],
          };
    await prisma.project.update({
      where: whereClause,
      data: {
        status: ProjectStatus.CANCELED,
      },
    });
  } catch (e) {
    console.error('api.projects.delete.error:', e);
    return;
  }

  // Cascade soft deletion to Issues and Workplans
  try {
    await Promise.all([
      prisma.issue.updateMany({
        where: {
          status: {
            not: IssueStatus.CANCELED,
          },
          project: {
            status: ProjectStatus.CANCELED,
            id: projectData.id,
          },
        },
        data: {
          status: IssueStatus.CANCELED,
        },
      }),
      prisma.workPlan.updateMany({
        where: {
          status: {
            not: WorkPlanStatus.CANCELED,
          },
          project: {
            status: ProjectStatus.CANCELED,
            id: projectData.id,
          },
        },
        data: {
          status: WorkPlanStatus.CANCELED,
        },
      }),
      prisma.document.updateMany({
        where: {
          status: {
            not: WorkPlanStatus.CANCELED,
          },
          project: {
            status: ProjectStatus.CANCELED,
            id: projectData.id,
          },
        },
        data: {
          status: DocumentStatus.CANCELED,
        },
      }),
    ]);
  } catch (e) {
    console.error('server.routes.api.projects.delete', e);
  }
}

export async function handleProjectEvent(data: any, eventName: string) {
  console.log('----handleProjectEvent----', data, eventName);
  switch (eventName) {
    case ProjectEvent.PROJECT_CREATED:
      handleProjectCreated(data);
      break;
    case ProjectEvent.PROJECT_UPDATED:
      handleProjectUpdated(data);
      break;
    case ProjectEvent.PROJECT_DELETED:
      handleProjectDeleted(data);
      break;
    default:
      console.log('no match project event handler');
  }
}

export async function handleSprintUpdated(data: { sprint: SprintFromJiraApi }) {
  const workPlanData = await prisma.workPlan.findFirst({
    where: {
      jiraSprintId: data.sprint.id.toString(),
    },
  });
  if (!workPlanData) {
    console.log('Jira sprint is not existed in omniflow system.');
    return;
  }
  try {
    let statusValue: WorkPlanStatus = WorkPlanStatus.CREATED;
    let dateInfo: any = { actualStartDate: null, actualEndDate: null };
    switch (data.sprint.state) {
      case 'future':
        statusValue = WorkPlanStatus.CREATED;
        break;
      case 'active':
        statusValue = WorkPlanStatus.STARTED;
        dateInfo = {
          actualStartDate: data.sprint.startDate ?? new Date(),
          actualEndDate: null,
        };
        break;
      case 'closed':
        statusValue = WorkPlanStatus.COMPLETED;
        dateInfo = {
          actualEndDate: data.sprint.completeDate ?? new Date(),
        };
        break;
    }
    await prisma.workPlan.update({
      where: {
        id: workPlanData.id,
      },
      data: {
        name: data.sprint.name,
        status: statusValue,
        meta: data.sprint,
        description: data.sprint.goal,
        plannedStartDate: data.sprint.startDate,
        plannedEndDate: data.sprint.endDate,
        ...dateInfo,
      },
    });
  } catch (e) {
    console.error('server.routes.api.sprint.update', e);
  }
}

export async function handleSprintDeleted(data: { sprint: SprintFromJiraApi }) {
  const workPlanData = await prisma.workPlan.findFirst({
    where: {
      jiraSprintId: data.sprint.id.toString(),
    },
  });
  if (!workPlanData) {
    console.log('Jira sprint is not existed in omniflow system.');
    return;
  }
  try {
    await prisma.workPlan.update({
      where: {
        id: workPlanData.id,
      },
      data: {
        status: WorkPlanStatus.CANCELED,
      },
    });
  } catch (e) {
    console.error('server.routes.api.sprint.delete', e);
  }
}

export async function handleSprintStarted(data: { sprint: SprintFromJiraApi }) {
  const workPlanData = await prisma.workPlan.findFirst({
    where: {
      jiraSprintId: data.sprint.id.toString(),
    },
  });
  if (!workPlanData) {
    console.log('Jira sprint is not existed in omniflow system.');
    return;
  }
  try {
    const result = await prisma.workPlan.update({
      where: {
        id: workPlanData.id,
      },
      data: {
        name: data.sprint.name,
        status: WorkPlanStatus.STARTED,
        meta: data.sprint,
        description: data.sprint.goal,
        plannedStartDate: data.sprint.startDate,
        plannedEndDate: data.sprint.endDate,
        actualStartDate: data.sprint.startDate ?? new Date(),
        actualEndDate: null,
      },
    });
  } catch (e) {
    console.error('server.routes.api.sprint.start', e);
  }
}

export async function handleSprintClosed(data: { sprint: SprintFromJiraApi }) {
  const workPlanData = await prisma.workPlan.findFirst({
    where: {
      jiraSprintId: data.sprint.id.toString(),
    },
  });
  if (!workPlanData) {
    console.log('Jira sprint is not existed in omniflow system.');
    return;
  }
  try {
    await prisma.workPlan.update({
      where: {
        id: workPlanData.id,
      },
      data: {
        status: WorkPlanStatus.COMPLETED,
        actualEndDate: data.sprint.completeDate ?? new Date(),
      },
    });
  } catch (e) {
    console.error('server.routes.api.sprint.close', e);
  }
}

export async function handleSprintEvent(
  data: { sprint: SprintFromJiraApi },
  eventName: string
) {
  console.log('----handleSprintEvent----', data, eventName);
  switch (eventName) {
    case SprintEvent.SPRINT_UPDATED:
      handleSprintUpdated(data);
      break;
    case SprintEvent.SPRINT_DELETED:
      handleSprintDeleted(data);
      break;
    case SprintEvent.SPRINT_STARTED:
      handleSprintStarted(data);
      break;
    case SprintEvent.SPRINT_CLOSED:
      handleSprintClosed(data);
      break;
    default:
      console.log('no match sprint event handler');
  }
}
